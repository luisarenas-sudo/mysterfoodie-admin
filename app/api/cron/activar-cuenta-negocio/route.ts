import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getAutomation, renderTemplate } from "@/lib/automations";
import { sendTemplatedEmail } from "@/lib/email";

/**
 * 20 minutos despues de que un negocio compra el reporte completo
 * (report_unlocked_at), le ofrece crear su cuenta: desde ahi puede
 * entrar a ver el historial de sus visitas y, mas adelante, pedir
 * visitas programadas y pagarlas directo. Mismo mecanismo que
 * /api/cron/followup-emails -- un Cron Job de Supabase (Database >
 * Cron) apunta aqui cada 5 minutos con el header
 * `x-cron-secret: ${CRON_SECRET}`.
 *
 * Por que 20 minutos y no al instante: para no encimar este correo
 * con el de resultado de la visita que ya le llega justo al terminar
 * de pagar.
 *
 * No usa inviteUserByEmail (que manda el correo generico de Supabase)
 * sino generateLink(type: "invite"), que crea la cuenta y devuelve el
 * link SIN mandar ningun correo -- asi el negocio solo recibe un
 * correo, con la marca de MysterFoodie, en vez de uno de Supabase y
 * otro nuestro. El link lleva a /set-password, que ahora tambien
 * ofrece "Continuar con Google" como alternativa a poner contraseña.
 *
 * clients.account_invited_at evita invitar dos veces al mismo
 * negocio (tenga 1 visita o 10): en cuanto se intenta una vez, sea
 * cual sea el resultado, se marca y no se vuelve a intentar solo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = getSupabaseServiceClient();

  const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const { data: forms, error: formsError } = await db
    .from("forms")
    .select("client_id, report_unlocked_at")
    .not("report_unlocked_at", "is", null)
    .lte("report_unlocked_at", cutoff);

  if (formsError) {
    return NextResponse.json({ error: formsError.message }, { status: 500 });
  }

  const clientIds = Array.from(new Set((forms || []).map((f) => f.client_id as string)));
  if (clientIds.length === 0) {
    return NextResponse.json({ ok: true, invited: 0 });
  }

  const { data: candidates, error: clientsError } = await db
    .from("clients")
    .select("id, name, email")
    .in("id", clientIds)
    .is("account_invited_at", null)
    .not("email", "is", null);

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, invited: 0 });
  }

  const automation = await getAutomation("activacion_cuenta_negocio");
  const automationEnabled = automation?.enabled && automation.subjectTemplate && automation.bodyTemplate;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const results: { clientId: string; status: string }[] = [];

  for (const client of candidates) {
    // Ya tiene cuenta (ej. el admin la dio de alta a mano desde
    // /admin/usuarios antes de que corriera este cron): no se manda
    // invitación, solo se marca para no revisarlo de nuevo.
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id")
      .eq("client_id", client.id)
      .maybeSingle();

    if (existingProfile) {
      await db.from("clients").update({ account_invited_at: new Date().toISOString() }).eq("id", client.id);
      results.push({ clientId: client.id, status: "ya_tenia_cuenta" });
      continue;
    }

    const { data: generated, error: generateError } = await db.auth.admin.generateLink({
      type: "invite",
      email: client.email as string,
      options: { redirectTo: `${baseUrl}/set-password` },
    });

    if (generateError || !generated?.user) {
      results.push({ clientId: client.id, status: `error_invitacion: ${generateError?.message || "desconocido"}` });
      continue;
    }

    await db.from("profiles").upsert({
      id: generated.user.id,
      email: client.email as string,
      full_name: client.name,
      role: "cliente",
      client_id: client.id,
    });

    const actionLink = generated.properties?.action_link || `${baseUrl}/set-password`;
    const defaultSubject = "Activa tu cuenta en MysterFoodie";
    const defaultBody =
      `Hola equipo de ${client.name},\n\n` +
      `Ya puedes crear tu cuenta en MysterFoodie para ver el historial de visitas de tu negocio, ` +
      `pedir nuevas visitas programadas y revisar tus reportes cuando quieras.\n\n` +
      `Entra aquí para crear tu contraseña (o puedes continuar con tu cuenta de Google desde la misma pantalla):\n${actionLink}\n\n` +
      `Saludos,\nMysterFoodie`;

    const subject = automationEnabled
      ? renderTemplate(automation!.subjectTemplate, { negocio: client.name })
      : defaultSubject;
    const bodyText = automationEnabled
      ? renderTemplate(automation!.bodyTemplate, { negocio: client.name, link_acceso: actionLink })
      : defaultBody;

    const outcome = await sendTemplatedEmail({ to: client.email as string, subject, bodyText });

    await db.from("clients").update({ account_invited_at: new Date().toISOString() }).eq("id", client.id);

    results.push({ clientId: client.id, status: outcome.status });
  }

  return NextResponse.json({ ok: true, invited: results.length, results });
}
