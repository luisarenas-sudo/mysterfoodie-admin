import { Resend } from "resend";
import { getVerdict } from "./verdict";
import type { CategoryScore } from "./scoring";
import { TOTAL_ITEM_COUNT } from "./categories";
import { FULL_REPORT_PRICE_MXN } from "./mercadopago";

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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * URL pública de la app, para construir links absolutos y el <img> del
 * logo dentro de los correos (los clientes de correo no pueden cargar
 * rutas relativas ni archivos locales). Si no está configurada se usa
 * el dominio de producción como último recurso - mejor eso que un
 * correo con el logo roto.
 */
function emailBaseUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";
}

/**
 * Nombre que se muestra como remitente. RESEND_FROM_EMAIL normalmente
 * solo trae la dirección (ej. "reportes@mysterfoodie.com"); se envuelve
 * como "MysterFoodie <reportes@mysterfoodie.com>" para que en la bandeja
 * de entrada se vea "MysterFoodie" en vez de la dirección pelona. Si la
 * variable ya trae un nombre (formato "Nombre <correo>") se respeta tal
 * cual, por si algún día se quiere personalizar distinto.
 */
function resolveFromAddress(): string {
  const raw = process.env.RESEND_FROM_EMAIL ?? "reportes@mysterfoodie.com";
  if (raw.includes("<")) return raw;
  return `MysterFoodie <${raw}>`;
}

const BRAND_RED = "#f24444";

/** "#RRGGBB" -> "rgba(r,g,b,a)" (los clientes de correo no siempre entienden #RRGGBBAA). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Escapa HTML y convierte **texto** en negritas (para los párrafos editables). */
function renderRichText(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Botón rojo de ancho completo (CTA principal de los correos). */
function renderButton(href: string, label: string, background = BRAND_RED): string {
  return `<a href="${escapeHtml(href)}" style="display: block; background-color: ${background}; color: #ffffff; text-align: center; text-decoration: none; font-weight: bold; font-size: 15px; line-height: 1.3; padding: 16px 18px; border-radius: 14px;">${label}</a>`;
}

/**
 * Estructura común de TODOS los correos: fondo gris claro, logo completo
 * de MysterFoodie arriba, tarjeta blanca redondeada con el contenido y,
 * abajo, el logo simplificado como firma con el respaldo de Flanco
 * Izquierdo.
 */
function renderEmailShell(cardHtml: string): string {
  const baseUrl = emailBaseUrl();
  return `
    <div style="background-color: #f4f5fa; padding: 32px 12px; font-family: Arial, Helvetica, sans-serif; color: #222222;">
      <div style="max-width: 560px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${baseUrl}/logo-wordmark.png" width="150" alt="MysterFoodie" style="display: inline-block; width: 150px; height: auto;" />
        </div>
        <div style="background-color: #ffffff; border-radius: 24px; padding: 34px 32px;">
          ${cardHtml}
        </div>
        <div style="text-align: center; margin-top: 26px;">
          <img src="${baseUrl}/icon-512.png" width="40" height="40" alt="MysterFoodie" style="display: inline-block; width: 40px; height: 40px; border-radius: 10px;" />
          <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #9ca3af;">
            MysterFoodie · Evaluaciones objetivas e independientes con el respaldo de
            <a href="https://flancoizquierdo.com/" style="color: #9ca3af; text-decoration: underline;">Flanco Izquierdo</a>.
          </p>
        </div>
      </div>
    </div>
  `;
}

/** Caja gris de "Palabra Foodie" (la garantía de honestidad del estudio). */
function renderGuaranteeBlock(): string {
  return `
    <div style="margin: 24px 0; background-color: #f8f9fb; border: 1px solid #eceef2; border-radius: 16px; padding: 20px 22px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; color: #8a8f98; text-transform: uppercase;">
        Palabra Foodie
      </p>
      <p style="margin: 0; font-size: 17px; font-weight: bold; line-height: 1.45; color: #1f2937;">
        &ldquo;Palabra Foodie, orgullo sibarita: ponemos la boca en el plato y la firma en la verdad.&rdquo;
      </p>
    </div>
  `;
}

function renderCategoryRows(categoryScores: CategoryScore[]): string {
  return [...categoryScores]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.average - a.average)
    .map(
      (c) => `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px solid #eef0f3; font-size: 15px; font-weight: bold; color: #111827;">${escapeHtml(c.label)}</td>
          <td style="padding: 14px 0; border-bottom: 1px solid #eef0f3; font-size: 15px; font-weight: bold; color: #111827; text-align: right;">${c.average.toFixed(1)} / 5</td>
        </tr>
      `
    )
    .join("");
}

/** Tarjeta con la calificación general: número grande, veredicto y resumen. */
function renderScoreCard(score: number): string {
  const verdict = getVerdict(score);
  return `
    <div style="margin: 24px 0 20px; border: 1px solid #e5e7eb; border-radius: 20px; padding: 24px 20px; text-align: center;">
      <p style="margin: 0; line-height: 1;">
        <span style="font-size: 46px; font-weight: bold; color: ${BRAND_RED};">${score}</span><span style="font-size: 22px; font-weight: bold; color: #9ca3af;"> / 5</span>
      </p>
      <p style="display: inline-block; margin: 14px 0 0; padding: 5px 16px; border-radius: 999px; background-color: ${hexToRgba(verdict.color, 0.12)}; color: ${verdict.color}; font-size: 14px; font-weight: bold;">
        ${verdict.label}
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: #6b7280;">${verdict.summary}</p>
    </div>
  `;
}

function renderEmailHtml(params: SendResultEmailParams): string {
  const { businessName, introText, score, reportUrl, categoryScores } = params;
  const rated = categoryScores.filter((c) => c.count > 0).length;

  return renderEmailShell(`
    <h2 style="margin: 0 0 20px; font-size: 25px; line-height: 1.25; color: #111827;">Resultado de tu evaluación Mystery Shopper</h2>
    <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
    <p style="white-space: pre-line; margin: 0; font-size: 15px; line-height: 1.65; color: #4b5563;">${renderRichText(introText)}</p>

    ${renderScoreCard(score)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      ${renderCategoryRows(categoryScores)}
    </table>

    ${renderGuaranteeBlock()}

    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.65; color: #6b7280;">
      Este resumen muestra solo las ${rated} categorías generales. El estudio completo evalúa
      <strong>${TOTAL_ITEM_COUNT} indicadores detallados</strong> (tiempos de atención, temperatura, limpieza, etc.),
      desarrollado bajo la metodología técnica de <strong>Flanco Izquierdo</strong>.
    </p>

    ${renderButton(reportUrl, `👉 Obtener Reporte Completo de ${TOTAL_ITEM_COUNT} Indicadores ($${FULL_REPORT_PRICE_MXN} MXN)`)}
    <p style="margin: 10px 0 0; text-align: center; font-size: 12.5px; color: #9ca3af;">Acceso inmediato por correo tras confirmar la solicitud.</p>
  `);
}

/** Correo con el resultado de una visita, mandado al negocio. El párrafo
 * introductorio (y el asunto) son editables desde Automatizaciones (clave
 * "resultado_visita"); el resto del correo (estrellas, veredicto, tabla de
 * categorías, botón) siempre se arma igual. */
export async function sendResultEmail(
  params: SendResultEmailParams
): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromAddress(),
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
// seguimiento, asignación a un Foodie, confirmación de asesoría
// agendada) usan el mismo mecanismo: texto plano ya renderizado
// (variables {{...}} ya sustituidas vía renderTemplate, ver
// lib/automations.ts) envuelto en el mismo wrapper visual simple, con
// el logo y el crédito de Flanco Izquierdo para que se sienta parte de
// la misma app aunque el cuerpo sea texto plano. Ver /automatizaciones.
// ============================================================

export type SendTemplatedEmailParams = {
  to: string;
  subject: string;
  /** Texto plano ya renderizado (variables {{...}} ya reemplazadas). */
  bodyText: string;
  /** Si se pasa, una línea del texto que sea solo un enlace se muestra como botón rojo con esta etiqueta. */
  ctaLabel?: string;
};

function renderPlainEmailHtml(bodyText: string, ctaLabel?: string): string {
  const urlLine = /^\s*(https?:\/\/\S+)\s*$/;
  const linkify = (escaped: string) =>
    escaped.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color: ${BRAND_RED}; text-decoration: underline;">$1</a>`);
  const textStyle = "white-space: pre-line; font-size: 15px; line-height: 1.7; color: #374151;";

  const parts: string[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    parts.push(`<div style="${textStyle}">${linkify(escapeHtml(buffer.join("\n")))}</div>`);
    buffer = [];
  };
  for (const line of bodyText.split("\n")) {
    const match = ctaLabel ? line.match(urlLine) : null;
    if (match) {
      flush();
      parts.push(`<div style="margin: 18px 0;">${renderButton(match[1], escapeHtml(ctaLabel as string))}</div>`);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return renderEmailShell(parts.join(""));
}

/** Envía un correo a partir de una plantilla de Automatizaciones ya renderizada. */
export async function sendTemplatedEmail(params: SendTemplatedEmailParams): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromAddress(),
      to: params.to,
      subject: params.subject,
      html: renderPlainEmailHtml(params.bodyText, params.ctaLabel),
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

// ============================================================
// Correo del reporte completo (post-compra, MercadoPago aprobado): va
// con el PDF adjunto (ver lib/reportPdf.ts), link al reporte en línea
// y, si está configurado, botón de WhatsApp para dudas.
// ============================================================

export type SendFullReportEmailParams = {
  to: string;
  businessName: string;
  score: number;
  reportUrl: string;
  /** Link de WhatsApp pre-armado (wa.me/...); si no hay ADMIN_CONTACT_WHATSAPP configurado, se omite el botón. */
  whatsappLink?: string | null;
  pdfBuffer: Buffer;
  pdfFilename: string;
};

function renderFullReportEmailHtml(params: SendFullReportEmailParams): string {
  const { businessName, score, reportUrl, whatsappLink } = params;
  const verdict = getVerdict(score);

  return renderEmailShell(`
    <h2 style="margin: 0 0 20px; font-size: 25px; line-height: 1.25; color: #111827;">¡Gracias por tu compra!</h2>
    <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.65; color: #4b5563;">
      Aquí está tu reporte completo de la evaluación Mystery Shopper, con calificación general de
      <strong>${score} / 5 (${verdict.label})</strong>. Va adjunto en PDF con el detalle por categoría,
      la metodología del estudio y el respaldo de Flanco Izquierdo.
    </p>

    ${renderGuaranteeBlock()}

    ${renderButton(reportUrl, "Ver el reporte en línea")}
    ${whatsappLink ? `<div style="margin-top: 12px;">${renderButton(whatsappLink, "¿Dudas? Escríbenos por WhatsApp", "#25D366")}</div>` : ""}
  `);
}

/** Correo con el PDF del reporte completo adjunto, mandado al comprador
 * cuando MercadoPago confirma el pago (ver app/api/mercadopago/webhook). */
export async function sendFullReportEmail(
  params: SendFullReportEmailParams
): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { status: "skipped_no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromAddress(),
      to: params.to,
      subject: `Tu reporte completo de ${params.businessName} ya está listo`,
      html: renderFullReportEmailHtml(params),
      attachments: [
        {
          filename: params.pdfFilename,
          content: params.pdfBuffer,
        },
      ],
    });

    if (result.error) {
      return { status: "failed", error: result.error.message };
    }
    return { status: "sent", providerId: result.data?.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
