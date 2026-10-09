import { getSupabaseServiceClient } from "./supabase";
import { categoryScores, overallScore, type Ratings } from "./scoring";
import { buildReportPdf } from "./reportPdf";
import { fullReportSubject, sendFullReportEmail, type SendEmailOutcome } from "./email";
import { monthLabel } from "./months";

export type UnlockedForm = {
  id: string;
  overall_score: number;
  client_id: string;
  report_url: string | null;
  short_code: string;
  created_at: string;
};

/** Genera el PDF del reporte completo y lo manda por correo al
 * comprador (o, si MercadoPago no entregó su correo, al correo del
 * negocio ya registrado), con el link al reporte en línea y el botón
 * de WhatsApp si está configurado. */
export type FullReportOutcome = (SendEmailOutcome | { status: "skipped_no_email" }) & { to?: string | null };

export type PlanProgress = { done: number; total: number; monthLabel: string; planName: string };

export async function deliverFullReportEmail(
  db: ReturnType<typeof getSupabaseServiceClient>,
  form: UnlockedForm,
  opts: {
    /** Correo del comprador (MercadoPago); si no hay, se usa el del negocio. */
    recipientEmail?: string | null;
    /** Visita de un plan mensual: el correo muestra "visita X de N". */
    planProgress?: { done: number; total: number; monthLabel: string; planName: string };
  } = {}
): Promise<FullReportOutcome> {
  const { data: client } = await db
    .from("clients")
    .select("name, type, city, email")
    .eq("id", form.client_id)
    .maybeSingle();

  const recipientEmail = opts.recipientEmail || client?.email;
  if (!recipientEmail) {
    // Sin a quién mandarlo (ni el pago ni el negocio tienen correo
    // registrado); el reporte ya quedó desbloqueado en la página
    // pública, así que no es un error fatal.
    console.error(`No hay correo para mandar el PDF del reporte completo (form ${form.id}).`);
    return { status: "skipped_no_email", to: null };
  }

  const { data: ratingRows } = await db
    .from("form_ratings")
    .select("category_key, score")
    .eq("form_id", form.id);

  const ratings: Ratings = {};
  for (const row of ratingRows ?? []) {
    if (typeof row.score === "number") ratings[row.category_key as string] = row.score;
  }

  const { data: flagRows } = await db
    .from("form_flags")
    .select("flag_key, flag_value")
    .eq("form_id", form.id);

  const flags: Record<string, boolean> = {};
  for (const row of flagRows ?? []) {
    flags[row.flag_key as string] = Boolean(row.flag_value);
  }

  const catScores = categoryScores(ratings, flags);
  const score = form.overall_score || overallScore(ratings, flags);

  const pdfBuffer = await buildReportPdf({
    businessName: client?.name || "Negocio",
    clientType: client?.type ?? null,
    city: client?.city ?? null,
    visitDate: new Date(form.created_at),
    overallScore: score,
    categoryScores: catScores,
    shortCode: form.short_code,
  });

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";
  const reportUrl = form.report_url || `${baseUrl}/r/${form.short_code}`;

  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const whatsappLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(
        `Hola, tengo una duda sobre el reporte completo de ${client?.name ?? ""} (código ${form.short_code}).`
      )}`
    : null;

  const outcome = await sendFullReportEmail({
    to: recipientEmail,
    businessName: client?.name || "Negocio",
    score,
    reportUrl,
    whatsappLink,
    pdfBuffer,
    pdfFilename: `reporte-completo-${form.short_code}.pdf`,
    planProgress: opts.planProgress,
  });

  // Queda en el registro de correos: se ve en la visita y, si falla, avisa en Pendientes.
  await db.from("email_confirmations").insert({
    form_id: form.id,
    recipient_email: recipientEmail,
    subject: fullReportSubject(client?.name || "Negocio", opts.planProgress),
    status: outcome.status,
    provider_id: outcome.providerId || null,
    error: outcome.error || null,
  });
  return { ...outcome, to: recipientEmail };
}

/**
 * Reporte completo de una visita de un plan mensual: calcula el avance del
 * mes ("visita 2 de 4") y manda el correo con el PDF. Lo usan el guardado de
 * la visita y el reenvío desde la pantalla de la visita.
 */
export async function deliverPlanReportEmail(
  db: ReturnType<typeof getSupabaseServiceClient>,
  form: UnlockedForm,
  opts: { to?: string | null } = {}
): Promise<{ outcome: FullReportOutcome; progress: PlanProgress | null }> {
  let progress: PlanProgress | null = null;
  const { data: assignment } = await db
    .from("visit_assignments")
    .select("plan_id, plan_month")
    .eq("completed_form_id", form.id)
    .maybeSingle();

  if (assignment?.plan_id && assignment.plan_month) {
    const [{ data: plan }, { count }] = await Promise.all([
      db.from("client_plans").select("plan_name, visits_per_month").eq("id", assignment.plan_id).maybeSingle(),
      db
        .from("visit_assignments")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", assignment.plan_id)
        .eq("plan_month", assignment.plan_month)
        .eq("status", "completada"),
    ]);
    progress = {
      done: count ?? 1,
      total: plan?.visits_per_month ?? 1,
      monthLabel: monthLabel(assignment.plan_month as string),
      planName: plan?.plan_name ?? "mensual",
    };
  }

  const outcome = await deliverFullReportEmail(db, form, { recipientEmail: opts.to, planProgress: progress ?? undefined });
  return { outcome, progress };
}
