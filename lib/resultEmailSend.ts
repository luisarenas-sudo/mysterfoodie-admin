import { getSupabaseServiceClient } from "./supabase";
import { businessTypePhrase } from "./categories";
import { categoryScores, type Ratings } from "./scoring";
import { sendResultEmail, type SendEmailOutcome } from "./email";
import { getAutomation, renderTemplate, resultadoVars, DEFAULT_RESULTADO_SUBJECT, DEFAULT_RESULTADO_INTRO, LOW_RESULTADO_SUBJECT, LOW_RESULTADO_INTRO } from "./automations";
import { isLowScore } from "./verdict";
import { glosarioIfFirstEmail } from "./firstContact";
import { isRequestedVisit } from "./visitRequests";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Manda el correo de resultado (el resumen "gancho") de una visita ya guardada a `to` y lo registra en email_confirmations.
 * Lo usan el reenvío del equipo y el correo que el negocio pide desde su reporte público.
 */
export async function sendResultEmailForForm(
  db: Db,
  form: { id: string; client_id: string; overall_score: number; short_code: string; report_url: string | null; waiter_name: string | null; created_at: string },
  client: { name: string; type: string | null },
  to: string,
  baseUrl: string
): Promise<SendEmailOutcome> {
  const [{ data: ratingRows }, { data: flagRows }] = await Promise.all([
    db.from("form_ratings").select("category_key, score").eq("form_id", form.id),
    db.from("form_flags").select("flag_key, flag_value").eq("form_id", form.id),
  ]);
  const ratings: Ratings = {};
  for (const row of ratingRows || []) ratings[row.category_key] = row.score;
  const flags: Record<string, boolean> = {};
  for (const row of flagRows || []) flags[row.flag_key] = row.flag_value;
  const catScores = categoryScores(ratings, flags);

  const reportUrl = form.report_url || `${baseUrl}/r/${form.short_code}`;
  const templateVars = resultadoVars({
    negocio: client.name,
    tipoNegocio: businessTypePhrase(client.type) || "negocio",
    mesero: form.waiter_name,
    promedio: form.overall_score,
  });
  const resultadoAutomation = await getAutomation("resultado_visita");
  const lowScore = isLowScore(Number(form.overall_score));
  const subject = lowScore
    ? renderTemplate(LOW_RESULTADO_SUBJECT, templateVars)
    : resultadoAutomation?.enabled && resultadoAutomation.subjectTemplate
      ? renderTemplate(resultadoAutomation.subjectTemplate, templateVars)
      : renderTemplate(DEFAULT_RESULTADO_SUBJECT, templateVars);
  const introText = lowScore
    ? renderTemplate(LOW_RESULTADO_INTRO, templateVars)
    : resultadoAutomation?.enabled && resultadoAutomation.bodyTemplate
      ? renderTemplate(resultadoAutomation.bodyTemplate, templateVars)
      : renderTemplate(DEFAULT_RESULTADO_INTRO, templateVars);

  const outcome = await sendResultEmail({
    glosario: await glosarioIfFirstEmail(db, to, form.id),
    requested: await isRequestedVisit(db, { id: form.id, client_id: form.client_id, created_at: form.created_at }).catch(() => false),
    to,
    businessName: client.name,
    subject,
    introText,
    hideScore: lowScore,
    score: form.overall_score,
    reportUrl,
    categoryScores: catScores,
  });

  await db.from("email_confirmations").insert({
    form_id: form.id,
    recipient_email: to,
    subject,
    status: outcome.status,
    provider_id: outcome.providerId || null,
    error: outcome.error || null,
  });
  return outcome;
}
