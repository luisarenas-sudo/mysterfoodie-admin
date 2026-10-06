import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { businessTypePhrase } from "@/lib/categories";
import { categoryScores, type Ratings } from "@/lib/scoring";
import { sendResultEmail } from "@/lib/email";
import { getAutomation, renderTemplate, resultadoVars, DEFAULT_RESULTADO_SUBJECT, DEFAULT_RESULTADO_INTRO } from "@/lib/automations";

/**
 * Reenvia el correo de resultado de una evaluacion ya guardada, o lo
 * manda a un correo alterno (por si el correo original cae en spam o el
 * cliente no tiene acceso a el). Usado por el boton "Reenviar" y por
 * "Enviar a otro correo" en la pantalla de confirmacion tras guardar
 * una visita.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como agente o admin para reenviar el correo" },
      { status: 401 }
    );
  }

  const { formId } = await params;

  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    // cuerpo vacio (reenvio al correo original) es valido
  }

  const overrideTo = body.to?.trim();
  if (overrideTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideTo)) {
    return NextResponse.json({ error: "El correo alterno no es válido" }, { status: 400 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, overall_score, short_code, report_url, waiter_name")
    .eq("id", formId)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
  }

  const { data: client } = await db
    .from("clients")
    .select("name, type, email")
    .eq("id", form.client_id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const recipientEmail = overrideTo || client.email || process.env.ADMIN_EMAIL || "";
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No hay correo destino: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado" },
      { status: 400 }
    );
  }

  const { data: ratingRows } = await db
    .from("form_ratings")
    .select("category_key, score")
    .eq("form_id", form.id);

  const ratings: Ratings = {};
  for (const row of ratingRows || []) {
    ratings[row.category_key] = row.score;
  }

  const { data: flagRows } = await db
    .from("form_flags")
    .select("flag_key, flag_value")
    .eq("form_id", form.id);

  const flags: Record<string, boolean> = {};
  for (const row of flagRows || []) {
    flags[row.flag_key] = row.flag_value;
  }

  const catScores = categoryScores(ratings, flags);

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const reportUrl = form.report_url || `${baseUrl}/r/${form.short_code}`;

  const templateVars = resultadoVars({
    negocio: client.name,
    tipoNegocio: businessTypePhrase(client.type) || "negocio",
    mesero: form.waiter_name,
    promedio: form.overall_score,
  });
  const resultadoAutomation = await getAutomation("resultado_visita");
  const defaultSubject = renderTemplate(DEFAULT_RESULTADO_SUBJECT, templateVars);
  const defaultIntro = renderTemplate(DEFAULT_RESULTADO_INTRO, templateVars);
  const subject =
    resultadoAutomation?.enabled && resultadoAutomation.subjectTemplate
      ? renderTemplate(resultadoAutomation.subjectTemplate, templateVars)
      : defaultSubject;
  const introText =
    resultadoAutomation?.enabled && resultadoAutomation.bodyTemplate
      ? renderTemplate(resultadoAutomation.bodyTemplate, templateVars)
      : defaultIntro;

  const emailOutcome = await sendResultEmail({
    to: recipientEmail,
    businessName: client.name,
    subject,
    introText,
    score: form.overall_score,
    reportUrl,
    categoryScores: catScores,
  });

  await db.from("email_confirmations").insert({
    form_id: form.id,
    recipient_email: recipientEmail,
    subject,
    status: emailOutcome.status,
    provider_id: emailOutcome.providerId || null,
    error: emailOutcome.error || null,
  });

  return NextResponse.json({
    email: emailOutcome,
    recipientEmail,
  });
}
