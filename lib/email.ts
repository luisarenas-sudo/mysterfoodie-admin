import { Resend } from "resend";
import { getVerdict } from "./verdict";
import type { CategoryScore } from "./scoring";
import { TOTAL_ITEM_COUNT } from "./categories";

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

/** Logo de MysterFoodie centrado, para el encabezado de los correos. */
function renderEmailLogo(): string {
  const baseUrl = emailBaseUrl();
  return `
    <div style="text-align: center; margin-bottom: 22px;">
      <img
        src="${baseUrl}/logo-wordmark.png"
        width="110"
        height="59"
        alt="MysterFoodie"
        style="display: inline-block; width: 110px; height: auto;"
      />
    </div>
  `;
}

/**
 * Bloque gris de "garantía": la cita de Palabra Foodie, el número de
 * indicadores evaluados y el respaldo de Flanco Izquierdo. Es el mismo
 * contenido que ya se usa en /perfil y en la página pública del reporte,
 * pensado para generar confianza justo antes del botón de compra.
 */
function renderGuaranteeBlock(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #f4f4f5; border-radius: 14px;">
      <tr>
        <td style="padding: 20px 22px; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #78716c; text-transform: uppercase;">
            Palabra Foodie
          </p>
          <p style="margin: 0 0 12px; font-size: 13.5px; font-style: italic; line-height: 1.6; color: #57534e;">
            &ldquo;Palabra Foodie, orgullo de gordo: la verdad es mi palabra y pongo mi boca en la verdad.&rdquo;
          </p>
          <p style="margin: 0; font-size: 12.5px; line-height: 1.6; color: #78716c;">
            Nuestros Myster Foodies visitan el negocio de incógnito, pagan su cuenta y califican
            más de ${TOTAL_ITEM_COUNT} indicadores de servicio, sabor, limpieza y experiencia — con total honestidad.
          </p>
          <p style="margin: 14px 0 0; font-size: 11px; color: #a8a29e;">
            <a href="https://flancoizquierdo.com/" style="color: #a8a29e; text-decoration: underline;">Con el respaldo de Flanco Izquierdo</a>
          </p>
        </td>
      </tr>
    </table>
  `;
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

/**
 * Lista de indicadores reales (nombres de item, no de categoría) usada
 * como textura decorativa "desenfocada" detrás de la tarjeta de
 * calificación general - sugiere que hay mucho más detalle disponible
 * sin revelarlo, para generar curiosidad por el reporte completo.
 */
const TEASER_INDICATOR_NAMES = [
  "Atención del mesero",
  "Tiempo de espera",
  "Limpieza de baños",
  "Sabor de los alimentos",
  "Temperatura de la comida",
  "Uniformes del personal",
  "Rapidez de la cuenta",
  "Iluminación",
  "Mobiliario",
  "Accesibilidad",
];

/**
 * Tarjeta con la calificación general: estrellas + veredicto, con una
 * capa decorativa de nombres de indicadores desenfocada de fondo (el
 * efecto de blur lo soportan Apple Mail, Gmail y la mayoría de clientes
 * modernos; en los que lo ignoran - ej. Outlook de escritorio - esa capa
 * simplemente queda oculta detrás/debajo de la tarjeta sólida, nunca se
 * ve rota).
 */
function renderScoreCard(score: number, reportUrl: string): string {
  const verdict = getVerdict(score);
  const teaserText = TEASER_INDICATOR_NAMES.join("   ·   ");

  return `
    <div style="position: relative; margin: 22px 0 18px;">
      <div style="position: absolute; inset: 0; overflow: hidden; border-radius: 16px; display: flex; align-items: center; justify-content: center; padding: 0 18px;">
        <p style="margin: 0; font-size: 12px; line-height: 1.8; color: #d6d3d1; text-align: center; filter: blur(2.5px); -webkit-filter: blur(2.5px);">
          ${teaserText}
        </p>
      </div>
      <div style="position: relative; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 22px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
        <p style="margin: 0 0 2px; font-size: 32px; font-weight: bold; color: #f24444; line-height: 1;">${score}<span style="font-size: 16px; color: #a8a29e; font-weight: normal;"> / 5</span></p>
        <p style="display: inline-block; margin-top: 8px; font-size: 12px; font-weight: bold; color: ${verdict.color}; border: 1px solid ${verdict.color}; border-radius: 999px; padding: 4px 14px;">
          ${verdict.label}
        </p>
        <p style="margin: 10px 0 0; font-size: 13.5px; color: #57534e;">${verdict.summary}</p>
      </div>
    </div>
  `;
}

function renderEmailHtml(params: SendResultEmailParams): string {
  const { businessName, introText, score, reportUrl, categoryScores } = params;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      ${renderEmailLogo()}

      <h2 style="color: #222222; margin: 0 0 14px; font-size: 20px; text-align: center;">Resultado de tu evaluación Mystery Shopper</h2>
      <p style="margin: 0 0 6px;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
      <p style="white-space: pre-line; margin: 0 0 4px;">${escapeHtml(introText)}</p>

      ${renderScoreCard(score, reportUrl)}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 4px; border-top: 1px solid #e7e5e4;">
        ${renderCategoryRows(categoryScores)}
      </table>

      <p style="margin-top: 20px; font-size: 14px; color: #44403c;">
        Este es solo un resumen por categoría. El reporte completo incluye el detalle de cada
        uno de los ${TOTAL_ITEM_COUNT} indicadores evaluados, comparativo con el sector y
        recomendaciones específicas.
      </p>

      ${renderGuaranteeBlock()}

      <p style="text-align: center; margin: 24px 0 8px;">
        <a href="${reportUrl}" style="background-color: #f24444; background-image: linear-gradient(180deg, #f24444, #f25631); color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 15px;">
          Ver reporte y solicitar el detalle completo
        </a>
      </p>

      <p style="font-size: 11px; color: #a8a29e; margin-top: 32px; text-align: center;">
        MysterFoodie · evaluaciones Mystery Shopper para restaurantes y bares.
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
};

function renderPlainEmailHtml(bodyText: string): string {
  const escaped = escapeHtml(bodyText);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      ${renderEmailLogo()}
      <div style="white-space: pre-line; font-size: 15px; line-height: 1.6;">${escaped}</div>
      <p style="font-size: 11px; color: #a8a29e; margin-top: 32px; text-align: center;">
        <a href="https://flancoizquierdo.com/" style="color: #a8a29e; text-decoration: underline;">Con el respaldo de Flanco Izquierdo</a>
      </p>
    </div>
  `;
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

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222222;">
      ${renderEmailLogo()}

      <h2 style="color: #222222; margin: 0 0 14px; font-size: 20px; text-align: center;">¡Gracias por tu compra!</h2>
      <p style="margin: 0 0 6px;">Hola equipo de <strong>${escapeHtml(businessName)}</strong>,</p>
      <p style="margin: 0 0 4px;">
        Aquí está tu reporte completo de la evaluación Mystery Shopper, con calificación general de
        <strong>${score} / 5 (${verdict.label})</strong>. Va adjunto en PDF con el detalle por categoría,
        la metodología del estudio y el respaldo de Flanco Izquierdo.
      </p>

      <p style="text-align: center; margin: 24px 0 10px;">
        <a href="${reportUrl}" style="background-color: #f24444; background-image: linear-gradient(180deg, #f24444, #f25631); color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 15px;">
          Ver el reporte en línea
        </a>
      </p>

      ${
        whatsappLink
          ? `<p style="text-align: center; margin: 0 0 10px;">
              <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 14px;">
                ¿Dudas? Escríbenos por WhatsApp
              </a>
            </p>`
          : ""
      }

      ${renderGuaranteeBlock()}

      <p style="font-size: 11px; color: #a8a29e; margin-top: 32px; text-align: center;">
        MysterFoodie · evaluaciones Mystery Shopper para restaurantes y bares.
      </p>
    </div>
  `;
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
