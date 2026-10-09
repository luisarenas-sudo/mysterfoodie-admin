import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { getAutomation, renderTemplate } from "./automations";
import { FULL_REPORT_PRICE_MXN } from "./mercadopago";

/**
 * Ticket de consumo de una visita: la foto del ticket que el Foodie sube
 * después de terminar y enviar la visita. Vive en el bucket privado
 * "tickets" de Supabase Storage; se ve con URLs firmadas de vida corta.
 * 3 días después de subirlo, el negocio recibe un aviso (una sola vez):
 * si aún no tiene el reporte completo, con la oferta de $850 MXN; si ya lo
 * pagó (o la visita es de un plan), solo se le avisa que hay más información.
 */
export const TICKET_BUCKET = "tickets";
export const TICKET_EMAIL_DELAY_DAYS = 3;
export const TICKET_MAX_BYTES = 4 * 1024 * 1024;

type Db = ReturnType<typeof getSupabaseServiceClient>;

/** Detecta JPEG/PNG por los primeros bytes (no confía en el tipo que manda el navegador). */
export function sniffImage(buf: Buffer): { ext: "jpg" | "png"; mime: "image/jpeg" | "image/png" } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  return null;
}

/** URL firmada para ver el ticket (por default 5 minutos). */
export async function signedTicketUrl(db: Db, path: string | null, seconds = 300): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(TICKET_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Descarga el ticket (para meterlo al PDF del reporte); null si no existe. */
export async function downloadTicket(db: Db, path: string | null): Promise<Buffer | null> {
  if (!path) return null;
  const { data, error } = await db.storage.from(TICKET_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function visitDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }).format(new Date(iso));
}

export type TicketEmailKind = "oferta" | "aviso";

/** Clave en Automatizaciones y etiqueta del botón de cada variante. */
export const TICKET_AUTOMATION_KEY: Record<TicketEmailKind, string> = {
  oferta: "ticket_oferta",
  aviso: "ticket_aviso",
};
export const TICKET_CTA_LABEL: Record<TicketEmailKind, string> = {
  oferta: "Ver el reporte completo",
  aviso: "Ver el ticket en mi reporte",
};

/** Textos originales (se usan si la plantilla de Automatizaciones está en "Texto original"). */
export const TICKET_DEFAULTS: Record<TicketEmailKind, { subject: string; body: string }> = {
  oferta: {
    subject: "Ya está el ticket de consumo de la visita a {{negocio}}",
    body:
      "Hola equipo de {{negocio}},\n\n" +
      "El mystery shopper que los visitó el {{fecha_visita}} ya subió el ticket de consumo a su visita.\n\n" +
      "Conozcan los indicadores evaluados, un reporte completo con todos ellos y el ticket del consumo por solo {{precio}}.\n\n" +
      "{{link_reporte}}\n\nSaludos,\nMysterFoodie",
  },
  aviso: {
    subject: "Tu visita a {{negocio}} ahora tiene más información",
    body:
      "Hola equipo de {{negocio}},\n\n" +
      "El mystery shopper que los visitó el {{fecha_visita}} ya subió el ticket de consumo a su visita.\n\n" +
      "Como ya tienen el reporte completo, no tienen que hacer nada: ahora hay más información en su visita y el ticket ya aparece en su reporte en línea.\n\n" +
      "{{link_reporte}}\n\nSaludos,\nMysterFoodie",
  },
};

export function ticketEmailVars(p: { businessName: string; visitDate: string; reportUrl: string }): Record<string, string> {
  return {
    negocio: p.businessName,
    fecha_visita: visitDateLabel(p.visitDate),
    precio: `$${FULL_REPORT_PRICE_MXN} MXN`,
    link_reporte: p.reportUrl,
  };
}

/** Asunto y texto finales: la plantilla de Automatizaciones si está activa, o el texto original. */
export async function ticketEmailContent(
  kind: TicketEmailKind,
  vars: Record<string, string>
): Promise<{ subject: string; bodyText: string; source: "plantilla" | "texto original" }> {
  const automation = await getAutomation(TICKET_AUTOMATION_KEY[kind]);
  const custom = Boolean(automation?.enabled && automation.subjectTemplate && automation.bodyTemplate);
  const subjectTpl = custom ? automation!.subjectTemplate : TICKET_DEFAULTS[kind].subject;
  const bodyTpl = custom ? automation!.bodyTemplate : TICKET_DEFAULTS[kind].body;
  return {
    subject: renderTemplate(subjectTpl, vars),
    bodyText: renderTemplate(bodyTpl, vars),
    source: custom ? "plantilla" : "texto original",
  };
}

export type TicketEmailResult = { formId: string; status: string };

/**
 * Manda los avisos de ticket que ya cumplieron sus 3 días. Se llama desde el
 * cron diario (ver app/api/cron/ticket-emails y followup-emails). Una visita
 * recibe el aviso una sola vez (forms.ticket_email_sent_at).
 */
export async function sendDueTicketEmails(
  db: Db,
  baseUrl: string,
  now: Date = new Date()
): Promise<{ sent: number; results: TicketEmailResult[] }> {
  const cutoff = new Date(now.getTime() - TICKET_EMAIL_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: forms, error } = await db
    .from("forms")
    .select("id, client_id, short_code, report_url, created_at, plan_id, report_unlocked_at")
    .not("ticket_photo_path", "is", null)
    .is("ticket_email_sent_at", null)
    .lte("ticket_uploaded_at", cutoff)
    .limit(100);
  if (error) throw new Error(error.message);

  const results: TicketEmailResult[] = [];
  for (const form of forms ?? []) {
    const { data: client } = await db.from("clients").select("name, email").eq("id", form.client_id).maybeSingle();
    if (!client?.email) {
      // Sin correo no se marca como enviado: si después se registra, saldrá en el siguiente corrido.
      results.push({ formId: form.id, status: "sin_correo" });
      continue;
    }

    const kind: TicketEmailKind = form.report_unlocked_at || form.plan_id ? "aviso" : "oferta";
    const reportUrl = form.report_url || `${baseUrl.replace(/\/$/, "")}/r/${form.short_code}`;
    const mail = await ticketEmailContent(
      kind,
      ticketEmailVars({ businessName: client.name, visitDate: form.created_at, reportUrl })
    );
    const outcome = await sendTemplatedEmail({
      to: client.email,
      subject: mail.subject,
      bodyText: mail.bodyText,
      ctaLabel: TICKET_CTA_LABEL[kind],
    });

    await db.from("email_confirmations").insert({
      form_id: form.id,
      recipient_email: client.email,
      subject: mail.subject,
      status: outcome.status,
      provider_id: outcome.providerId || null,
      error: outcome.error || null,
    });
    if (outcome.status === "sent") {
      await db.from("forms").update({ ticket_email_sent_at: now.toISOString() }).eq("id", form.id);
    }
    results.push({ formId: form.id, status: outcome.status });
  }
  return { sent: results.filter((r) => r.status === "sent").length, results };
}
