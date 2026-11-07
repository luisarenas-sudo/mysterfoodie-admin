import { escapeLike } from "@/lib/sqlLike";
import { rateLimit } from "@/lib/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendResultEmailForForm } from "@/lib/resultEmailSend";
import { ACCESS_TTL_DAYS, accessUrl, issueAccessToken } from "@/lib/accessTokens";

/**
 * «Recibe tu resumen por correo» en el reporte público (aún sin pagar): guarda el correo del negocio (si su ficha no tenía
 * uno), le manda el resumen y lo deja en la secuencia de recordatorios. Límite: 3 envíos por reporte y uno por hora.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "rcorreo", 10, 3600000);
  if (limited) return limited;
  let shortCode = "";
  let email = "";
  try {
    const body = (await req.json()) as { shortCode?: unknown; email?: unknown };
    shortCode = typeof body.shortCode === "string" ? body.shortCode.trim() : "";
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(shortCode)) return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }

  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, client_id, overall_score, short_code, report_url, waiter_name, created_at, report_unlocked_at, plan_id, lead_email_count, lead_email_at")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form || form.report_unlocked_at || form.plan_id) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  const count = (form.lead_email_count as number) ?? 0;
  const last = form.lead_email_at ? new Date(form.lead_email_at as string).getTime() : 0;
  if (count >= 3 || Date.now() - last < 3600 * 1000) {
    return NextResponse.json({ error: "Ya te enviamos el resumen. Revisa tu bandeja y la carpeta de spam." }, { status: 429 });
  }

  const { data: client } = await db.from("clients").select("name, type, email").eq("id", form.client_id as string).maybeSingle();
  if (!client) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  await db
    .from("forms")
    .update({ lead_email: email, lead_email_at: new Date().toISOString(), lead_email_count: count + 1, followup_optout_at: null })
    .eq("id", form.id as string);
  if (!client.email) await db.from("clients").update({ email }).eq("id", form.client_id as string);

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // Primer contacto completo: si ese correo aún no tiene cuenta, se crea la del negocio y el correo trae el acceso.
  let acceso: { link: string; code: string; baseUrl: string; ttlDays: number } | null = null;
  try {
    const { data: profile } = await db.from("profiles").select("id").ilike("email", escapeLike(email)).maybeSingle();
    // Seguridad: el correo lo escribe quien abre el reporte y no está verificado. Solo se crea la cuenta del negocio si la ficha
    // no tiene aún otro correo registrado ni otra cuenta vinculada; si no, se manda solo el resumen (sin acceso a la cuenta).
    const registered = ((client.email as string | null) || "").trim().toLowerCase();
    const emailMatches = !registered || registered === email;
    let hasOtherAccount = false;
    if (!profile) {
      const { count: linked } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("client_id", form.client_id as string);
      hasOtherAccount = (linked ?? 0) > 0;
    }
    if (!profile && emailMatches && !hasOtherAccount) {
      const { data: createdUser, error: userError } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (createdUser?.user && !userError) {
        await db.from("profiles").upsert({ id: createdUser.user.id, email, full_name: client.name as string, role: "cliente", client_id: form.client_id as string });
        const { token, code } = await issueAccessToken(db, { userId: createdUser.user.id, email, purpose: "invite" });
        acceso = { link: accessUrl(baseUrl, token), code, baseUrl, ttlDays: ACCESS_TTL_DAYS };
        await db.from("clients").update({ account_invited_at: new Date().toISOString() }).eq("id", form.client_id as string);
      } else {
        console.error("reporte: createUser", userError?.message);
      }
    }
  } catch (err) {
    console.error("reporte: cuenta del negocio", err instanceof Error ? err.message : err);
  }

  const outcome = await sendResultEmailForForm(
    db,
    { id: form.id as string, client_id: form.client_id as string, overall_score: form.overall_score as number, short_code: form.short_code as string, report_url: form.report_url as string | null, waiter_name: form.waiter_name as string | null, created_at: form.created_at as string },
    { name: client.name as string, type: client.type as string | null },
    email,
    baseUrl,
    acceso
  );
  if (outcome.status === "failed") return NextResponse.json({ error: "No pudimos enviarlo. Intenta de nuevo en unos minutos." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
