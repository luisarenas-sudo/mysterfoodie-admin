import { getSupabaseServiceClient } from "./supabase";
import { escapeHtml, renderButton, renderEmailShell, sendHtmlEmail } from "./email";
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

export function ticketEmailContent(p: {
  kind: TicketEmailKind;
  businessName: string;
  visitDate: string;
  reportUrl: string;
}): { subject: string; html: string; text: string } {
  const { kind, businessName, visitDate, reportUrl } = p;
  const fecha = visitDateLabel(visitDate);
  const price = `$${FULL_REPORT_PRICE_MXN} MXN`;

  if (kind === "oferta") {
    const subject = `Ya está el ticket de consumo de la visita a ${businessName}`;
    const text =
      `Hola equipo de ${businessName},\n\nEl mystery shopper que visitó ${businessName} el ${fecha} ya subió el ticket de consumo a su visita. ` +
      `Conoce los indicadores evaluados, un reporte completo con todos ellos y el ticket del consumo por solo ${price}.\n\n${reportUrl}`;
    const html = renderEmailShell(`
      <h2 style="margin: 0 0 20px; font-size: 25px; line-height: 1.25; color: #111827;">Ya está el ticket de tu visita</h2>
      <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
      <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.65; color: #4b5563;">
        El mystery shopper que los visitó el <strong>${escapeHtml(fecha)}</strong> ya subió el <strong>ticket de consumo</strong> a su visita.
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.65; color: #4b5563;">
        Conozcan los indicadores evaluados, un <strong>reporte completo</strong> con todos ellos y el ticket del consumo por solo <strong>${price}</strong>.
      </p>
      ${renderButton(reportUrl, `Ver el reporte completo · ${price}`)}
    `);
    return { subject, html, text };
  }

  const subject = `Tu visita a ${businessName} ahora tiene más información`;
  const text =
    `Hola equipo de ${businessName},\n\nEl mystery shopper que los visitó el ${fecha} ya subió el ticket de consumo a su visita. ` +
    `Como ya tienen el reporte completo, no tienen que hacer nada: ahora hay más información en su visita.\n\n${reportUrl}`;
  const html = renderEmailShell(`
    <h2 style="margin: 0 0 20px; font-size: 25px; line-height: 1.25; color: #111827;">Hay más información en tu visita</h2>
    <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
    <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.65; color: #4b5563;">
      El mystery shopper que los visitó el <strong>${escapeHtml(fecha)}</strong> ya subió el <strong>ticket de consumo</strong> a su visita.
    </p>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.65; color: #4b5563;">
      Como ya tienen el reporte completo, no tienen que hacer nada: el ticket ya aparece en su reporte en línea.
    </p>
    ${renderButton(reportUrl, "Ver el ticket en mi reporte")}
  `);
  return { subject, html, text };
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
    const mail = ticketEmailContent({ kind, businessName: client.name, visitDate: form.created_at, reportUrl });
    const outcome = await sendHtmlEmail({ to: client.email, subject: mail.subject, html: mail.html, text: mail.text });

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
