import { Resend } from "resend";
import { getVerdict } from "./verdict";
import type { CategoryScore } from "./scoring";

export type SendResultEmailParams = {
  to: string;
  businessName: string;
  score: number;
  reportUrl: string;
  categoryScores: CategoryScore[];
  /** Asunto ya renderizado (plantilla de Automatizaciones "resultado_visita" o el texto por default). */
  subject: string;
  /** Párrafo de introducción ya renderizado (plantilla de Automatizaciones "resultado_visita" o el texto por default). Variables ya sustituidas. */
  introText: string;
};

export type SendEmailOutcome = {
  status: "sent" | "skipped_no_api_key" | "failed";
  providerId?: string;
  error?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCategoryRows(categoryScores: CategoryScore[]): string {
  return categoryScores
    .filter((c) => c.count > 0)
    .map(
      (c) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #44403c;">${c.label}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #222222; font-weight: bold; text-align: right;">${c.average} / 5</td>
        </tr>
      `
    )
    .join("");
}

function renderEmailHtml(params: SendResultEmailParams): string {
  const { businessName, introText, score, reportUrl, categoryScores } = params;
  const verdict = getVerdict(score);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      <p style="font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #f24444; text-transform: uppercase;">MysterFoodie</p>
      <h2 style="color: #222222; margin-top: 4px;">Resultado de tu evaluación Mystery Shopper</h2>
      <p>Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
      <p style="white-space: pre-line;">${escapeHtml(introText)}</p>
      <p style="font-size: 28px; font-weight: bold; color: #f24444; margin-bottom: 4px;">${score} de 5 estrellas</p>
      <p style="display: inline-block; font-size: 12px; font-weight: bold; color: ${verdict.color}; border: 1px solid ${verdict.color}; border-radius: 999px; padding: 4px 12px; margin-top: 0;">
        ${verdict.label}
      </p>
      <p style="color: #57534e;">${verdict.summary}</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; border-top: 1px solid #e7e5e4;">
        ${renderCategoryRows(categoryScores)}
      </table>

      <p style="margin-top: 20px;">
        Este es solo un resumen por categoría. El reporte completo incluye el detalle de cada
        uno de los indicadores evaluados dentro de cada categoría, comparativo con el sector y
        recomendaciones específicas.
      </p>
      <p>
        <a href="${reportUrl}" style="background-color: #f24444; background-image: linear-gradient(180deg, #f24444, #f25631); color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Ver reporte y solicitar el detalle completo
        </a>
      </p>
      <p style="font-size: 12px; color: #78716c; margin-top: 32px;">
        MysterFoodie - evaluaciones Mystery Shopper para restaurantes y bares.
      </p>
    </div>
  `;
}

/** Correo con el resultado de una visita, mandado al negocio. El párrafo
 * introductorio (y el asunto) son editables desde Automatizaciones (clave
 * "resultado_visita"); el resto del correo (estrellas, veredicto, tabla de
 * categorías, botón) siempre se arma igual. */
export async function sendResultEmail(
  params: SendResultEmailParams
): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "reportes@mysterfoodie.com";

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: renderEmailHtml(params),
    });

    if (result.error) {
      return { status: "failed", error: result.error.message };
    }

    return { status: "sent", providerId: result.data?.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// Automatizaciones: todas las plantillas editables (asesoría de
// seguimiento, resultado de visita, asignación a un Foodie,
// confirmación de asesoría agendada, DM de Instagram) usan el mismo
// mecanismo: texto plano ya renderizado (variables {{...}} ya
// sustituidas vía renderTemplate, ver lib/automations.ts) envuelto en
// el mismo wrapper visual simple. Ver /automatizaciones.
// ============================================================

export type SendTemplatedEmailParams = {
  to: string;
  subject: string;
  /** Texto plano ya renderizado (variables {{...}} ya reemplazadas). */
  bodyText: string;
};

function renderPlainEmailHtml(bodyText: string): string {
  const escaped = escapeHtml(bodyText);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      <p style="font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #f24444; text-transform: uppercase;">MysterFoodie</p>
      <div style="white-space: pre-line; font-size: 15px; line-height: 1.6;">${escaped}</div>
    </div>
  `;
}

/** Envía un correo a partir de una plantilla de Automatizaciones ya renderizada. */
export async function sendTemplatedEmail(params: SendTemplatedEmailParams): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "reportes@mysterfoodie.com";

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: renderPlainEmailHtml(params.bodyText),
    });

    if (result.error) {
      return { status: "failed", error: result.error.message };
    }
    return { status: "sent", providerId: result.data?.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Formatea un rango de horario en español (CDMX), ej. "lunes 15 de septiembre, 10:00 a 10:20 (hora CDMX)". */
export function formatSlot(start: Date, end: Date): string {
  const dateFmt = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  });
  const timeFmt = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  });
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} a ${timeFmt.format(end)} (hora CDMX)`;
}
