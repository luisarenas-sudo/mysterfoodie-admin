import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { isRequestedVisit } from "./visitRequests";
import { FULL_REPORT_PRICE_MXN } from "./mercadopago";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Seguimiento del reporte público (/r/<código>): aperturas y toques en
 * "Comprar", guardados en la propia visita (supabase/seguimiento_reporte.sql).
 * Cuando el negocio abre su reporte y aún no lo compra, el Master Chef recibe
 * un correo; para no llenarlo de avisos si lo abre varias veces seguidas, entre
 * un aviso y el siguiente del mismo reporte pasan al menos
 * REPORT_VIEW_ALERT_COOLDOWN_HOURS horas (las aperturas igual se cuentan).
 */
export const REPORT_VIEW_ALERT_COOLDOWN_HOURS = 6;

const baseUrlOf = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";

/** WhatsApp con el mensaje ya escrito (sin mencionar que se supo de la apertura). null si no hay teléfono usable. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

/**
 * Registra una apertura del reporte (ya filtrada: es una persona, no el equipo ni un rastreador de vista previa)
 * y, si toca, avisa al Master Chef. Un reporte ya comprado no se cuenta.
 */
export async function recordReportView(shortCode: string): Promise<{ counted: boolean; alerted: boolean }> {
  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, client_id, created_at, overall_score, report_unlocked_at, view_count, first_viewed_at, view_alert_sent_at, checkout_clicked_at")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form || form.report_unlocked_at) return { counted: false, alerted: false };

  const nowIso = new Date().toISOString();
  const views = ((form.view_count as number) ?? 0) + 1;
  const { error } = await db
    .from("forms")
    .update({ view_count: views, last_viewed_at: nowIso, first_viewed_at: (form.first_viewed_at as string | null) ?? nowIso })
    .eq("id", form.id as string);
  if (error) {
    console.error("No se pudo registrar la apertura del reporte:", error.message);
    return { counted: false, alerted: false };
  }

  // Reclama el aviso de forma atómica: si dos aperturas llegan a la vez, solo una lo envía.
  const cutoff = new Date(Date.now() - REPORT_VIEW_ALERT_COOLDOWN_HOURS * 3600 * 1000).toISOString();
  const { data: claimed } = await db
    .from("forms")
    .update({ view_alert_sent_at: nowIso })
    .eq("id", form.id as string)
    .or(`view_alert_sent_at.is.null,view_alert_sent_at.lt.${cutoff}`)
    .select("id");
  if (!claimed || claimed.length === 0) return { counted: true, alerted: false };

  const [{ data: client }, { data: admins }, requested] = await Promise.all([
    db.from("clients").select("name, contact_name, phone, city").eq("id", form.client_id as string).maybeSingle(),
    db.from("profiles").select("email").eq("role", "admin").not("email", "is", null),
    isRequestedVisit(db, { id: form.id as string, client_id: form.client_id as string, created_at: form.created_at as string }).catch(() => false),
  ]);
  const negocio = (client?.name as string) ?? "Un negocio";
  const baseUrl = baseUrlOf();
  const wa = whatsappLink(
    client?.phone as string | null,
    `Hola, equipo de ${negocio}. Les escribo de MysterFoodie. Por si les surgió alguna duda sobre el resultado de su visita, con gusto les ayudo.`
  );
  const veces = views === 1 ? "Es la primera vez que lo abren." : `Lo han abierto ${views} veces.`;
  const toco = form.checkout_clicked_at ? "Ya tocaron «Comprar» alguna vez y no completaron el pago.\n" : "";
  const siguiente = requested
    ? `Fue una visita que ellos solicitaron: puede interesarles programar una visita con reporte completo ($${FULL_REPORT_PRICE_MXN} + consumo) o conocer los paquetes.`
    : `Fue una visita sorpresa: puede comprar el reporte completo en línea por $${FULL_REPORT_PRICE_MXN} MXN sin IVA.`;
  const bodyText =
    `${negocio} abrió su reporte (${form.overall_score} de 5) y todavía no lo compra. ${veces}\n` +
    toco +
    `${siguiente}\n\n` +
    (client?.contact_name ? `Contacto: ${client.contact_name}\n` : "") +
    `Negocio en la app: ${baseUrl}/negocios/${form.client_id}\n` +
    `Reporte público: ${baseUrl}/r/${shortCode}\n\n` +
    `Si quieres escribirle, es buen momento. Sin presionar: pregúntale si le surgió alguna duda.\n` +
    (wa ? `\n${wa}\n` : "");
  let sent = false;
  for (const a of admins || []) {
    const out = await sendTemplatedEmail({
      to: a.email as string,
      subject: `Abrieron el reporte de ${negocio}`,
      bodyText,
      ctaLabel: wa ? "Escribirle por WhatsApp" : undefined,
    });
    if (out.status === "sent") sent = true;
  }
  return { counted: true, alerted: sent };
}

/** Anota que el negocio tocó "Comprar" (queda la fecha del último toque). */
export async function markCheckoutClick(db: Db, formId: string): Promise<void> {
  const { error } = await db.from("forms").update({ checkout_clicked_at: new Date().toISOString() }).eq("id", formId);
  if (error) console.error("No se pudo registrar el toque en Comprar:", error.message);
}

export type ReportFunnel = { days: number; sent: number; opened: number; email: number | null; clicked: number; paid: number };

/** Embudo de los últimos `days` días: visitas con reporte, abiertos, con toque en Comprar y pagados. Null si el SQL de seguimiento aún no se corrió. */
export async function getReportFunnel(db: Db, days = 30): Promise<ReportFunnel | null> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const base = () => db.from("forms");
  // «Dejaron correo» vive en otro SQL (seguimiento_recordatorios.sql): si aún no está, el embudo sigue sin ese paso.
  const withLead = await base()
    .select("first_viewed_at, checkout_clicked_at, report_unlocked_at, lead_email")
    .is("plan_id", null)
    .gte("created_at", since)
    .limit(2000);
  const leadOk = !withLead.error;
  const { data, error } = leadOk
    ? withLead
    : await base().select("first_viewed_at, checkout_clicked_at, report_unlocked_at").is("plan_id", null).gte("created_at", since).limit(2000);
  if (error || !data) return null;
  const rows = data as { first_viewed_at: string | null; checkout_clicked_at: string | null; report_unlocked_at: string | null; lead_email?: string | null }[];
  return {
    days,
    sent: rows.length,
    opened: rows.filter((f) => f.first_viewed_at || f.report_unlocked_at).length,
    email: leadOk ? rows.filter((f) => f.lead_email).length : null,
    clicked: rows.filter((f) => f.checkout_clicked_at || f.report_unlocked_at).length,
    paid: rows.filter((f) => f.report_unlocked_at).length,
  };
}
