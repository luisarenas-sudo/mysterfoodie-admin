import { Resend } from "resend";
import { getVerdict } from "./verdict";
import type { CategoryScore } from "./scoring";
import { TOTAL_ITEM_COUNT } from "./categories";
import { FULL_REPORT_PRICE_MXN } from "./mercadopago";
import { PALABRA_FOODIE_QUOTE } from "./brand";

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

/**
 * Las cuentas de envío (reportes@, etc.) no reciben correo: cualquier
 * respuesta debe llegar a la cuenta de soporte. Se puede cambiar con
 * RESEND_REPLY_TO.
 */
export const SUPPORT_EMAIL = "hola@mysterfoodie.com";
function resolveReplyTo(): string {
  return process.env.RESEND_REPLY_TO || SUPPORT_EMAIL;
}

export const BRAND_RED = "#f24444";

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
export function renderButton(href: string, label: string, background = BRAND_RED): string {
  return `<a href="${escapeHtml(href)}" style="display: block; background-color: ${background}; color: #ffffff; text-align: center; text-decoration: none; font-weight: bold; font-size: 15px; line-height: 1.3; padding: 16px 18px; border-radius: 14px;">${label}</a>`;
}

/**
 * Estructura común de TODOS los correos: fondo gris claro, logo completo
 * de MysterFoodie arriba, tarjeta blanca redondeada con el contenido y,
 * abajo, el logo simplificado como firma con el respaldo de Flanco
 * Izquierdo.
 */
export function renderEmailShell(cardHtml: string): string {
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
          <p style="margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: #9ca3af;">
            ¿Dudas? Escríbenos a <a href="mailto:hola@mysterfoodie.com" style="color: #9ca3af; text-decoration: underline;">hola@mysterfoodie.com</a>.
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
        &ldquo;${PALABRA_FOODIE_QUOTE}&rdquo;
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
      replyTo: resolveReplyTo(),
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
      replyTo: resolveReplyTo(),
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

/** Envía un correo con HTML ya armado (con renderEmailShell) y su versión en texto plano. */
export async function sendHtmlEmail(params: { to: string; subject: string; html: string; text?: string }): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "skipped_no_api_key" };
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromAddress(),
      replyTo: resolveReplyTo(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) return { status: "failed", error: result.error.message };
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
  /** Visita de un plan mensual: cambia el asunto y el encabezado para mostrar el avance ("2 de 3"). */
  planProgress?: { done: number; total: number; monthLabel: string; planName: string };
};

function renderFullReportEmailHtml(params: SendFullReportEmailParams): string {
  const { businessName, score, reportUrl, whatsappLink, planProgress } = params;
  const verdict = getVerdict(score);
  const heading = planProgress
    ? `Visita ${planProgress.done} de ${planProgress.total} de ${planProgress.monthLabel.toLowerCase()}`
    : "¡Gracias por tu compra!";
  const progressBar = planProgress
    ? `<p style="margin: 0 0 18px; font-size: 14px; line-height: 1.5; color: #6b7280;">Plan ${escapeHtml(planProgress.planName)}: ${"●".repeat(Math.min(planProgress.done, planProgress.total))}${"○".repeat(Math.max(planProgress.total - planProgress.done, 0))} ${planProgress.done} de ${planProgress.total} visitas del mes.</p>`
    : "";

  return renderEmailShell(`
    <h2 style="margin: 0 0 20px; font-size: 25px; line-height: 1.25; color: #111827;">${escapeHtml(heading)}</h2>
    ${progressBar}
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

/** Asunto del correo del reporte completo (también se guarda en el registro de correos). */
export function fullReportSubject(
  businessName: string,
  planProgress?: { done: number; total: number }
): string {
  return planProgress
    ? `Visita ${planProgress.done} de ${planProgress.total}: reporte de ${businessName}`
    : `Tu reporte completo de ${businessName} ya está listo`;
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
      replyTo: resolveReplyTo(),
      to: params.to,
      subject: fullReportSubject(params.businessName, params.planProgress),
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

// ============================================================
// Ticket de servicio (plan contratado): se manda al contratar un plan de
// visitas, con aspecto de ticket de restaurante -- los servicios
// contratados, la tarifa y lo que no incluye (el consumo se reembolsa
// aparte contra ticket). Después de este correo, el equipo contacta al
// cliente de forma personal.
// ============================================================

export type SendPlanTicketParams = {
  to: string;
  /** Copia oculta para el equipo (ADMIN_EMAIL), opcional. */
  bcc?: string | null;
  businessName: string;
  /** Contratación de varias sucursales: nombres de todas (si no, un plan de un solo negocio). */
  sucursales?: string[];
  planName: string;
  tagline: string;
  /** Visitas al mes por sucursal. */
  visitsPerMonth: number;
  pricePerVisit: number;
  startMonthLabel: string;
  folio: string;
  includes: string[];
  issuedAt: Date;
  whatsappLink?: string | null;
};

function mxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderPlanTicketHtml(p: SendPlanTicketParams): string {
  const mono = "font-family: 'Courier New', Courier, monospace;";
  const dash = `<div style="border-top: 2px dashed #c9ccd3; margin: 14px 0;"></div>`;
  const row = (left: string, right: string, bold = false) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr>
        <td style="padding: 3px 0; ${mono} font-size: 14px; color: #111827; ${bold ? "font-weight: bold;" : ""}">${left}</td>
        <td style="padding: 3px 0; ${mono} font-size: 14px; color: #111827; text-align: right; white-space: nowrap; ${bold ? "font-weight: bold;" : ""}">${right}</td>
      </tr>
    </table>`;
  const branches = p.sucursales?.length ?? 1;
  const totalVisits = p.visitsPerMonth * branches;
  const total = totalVisits * p.pricePerVisit;
  const issued = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(p.issuedAt);

  const includes = p.includes
    .map((i) => `<div style="padding: 2px 0; ${mono} font-size: 13px; line-height: 1.5; color: #374151;">+ ${escapeHtml(i)}</div>`)
    .join("");

  return renderEmailShell(`
    <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Hola equipo de <strong>${escapeHtml(p.businessName)}</strong>, gracias por sentarse a la mesa. Este es el ticket de su servicio:</p>

    <div style="background-color: #fbfaf7; border: 1px solid #e7e3d8; border-radius: 6px; padding: 24px 22px; ${mono}">
      <div style="text-align: center;">
        <div style="${mono} font-size: 18px; font-weight: bold; letter-spacing: 0.18em; color: #111827;">MYSTERFOODIE</div>
        <div style="${mono} font-size: 12px; letter-spacing: 0.12em; color: #6b7280; margin-top: 2px;">TICKET DE SERVICIO</div>
      </div>
      ${dash}
      ${row("FOLIO", escapeHtml(p.folio))}
      ${row("FECHA", escapeHtml(issued))}
      ${row(branches > 1 ? "MARCA" : "MESA", escapeHtml(p.businessName.toUpperCase()))}
      ${row("INICIO", escapeHtml(p.startMonthLabel.toUpperCase()))}
      ${dash}
      <div style="${mono} font-size: 12px; letter-spacing: 0.1em; color: #6b7280; padding-bottom: 4px;">CANT  DESCRIPCIÓN</div>
      ${row(`${totalVisits} &nbsp;Visitas Mystery Shopper / mes`, mxn(total))}
      <div style="${mono} font-size: 12px; color: #6b7280; padding: 0 0 6px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Plan ${escapeHtml(p.planName)} (${escapeHtml(p.tagline)}) · ${branches > 1 ? `${branches} sucursales × ${p.visitsPerMonth} visitas × ` : `${p.visitsPerMonth} × `}${mxn(p.pricePerVisit)}</div>
      ${row("Consumo en cada visita", "REEMBOLSO")}
      <div style="${mono} font-size: 12px; color: #6b7280; padding: 0 0 6px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Se cubre contra ticket del consumo</div>
      ${dash}
      ${row("TOTAL MENSUAL", mxn(total) + " MXN", true)}
      ${row("+ Reembolso del ticket de consumo", "según ticket")}
      ${dash}
      ${
        p.sucursales && p.sucursales.length > 1
          ? `<div style="${mono} font-size: 12px; letter-spacing: 0.1em; color: #6b7280; padding-bottom: 4px;">SUCURSALES (${p.sucursales.length})</div>` +
            p.sucursales
              .map((n) => `<div style="padding: 2px 0; ${mono} font-size: 13px; line-height: 1.5; color: #374151;">&bull; ${escapeHtml(n)} &middot; ${p.visitsPerMonth} visitas/mes</div>`)
              .join("") +
            dash
          : ""
      }
      <div style="${mono} font-size: 12px; letter-spacing: 0.1em; color: #6b7280; padding-bottom: 4px;">INCLUYE</div>
      ${includes}
      ${dash}
      <div style="text-align: center; ${mono} font-size: 13px; line-height: 1.6; color: #374151;">
        *** GRACIAS POR SU PREFERENCIA ***<br />
        ${escapeHtml(PALABRA_FOODIE_QUOTE)}
      </div>
    </div>

    <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.65; color: #4b5563;">
      En breve nos pondremos en contacto contigo para coordinar el arranque, resolver dudas y acordar la forma de pago.
      No tienes que hacer nada más por ahora.
    </p>
    ${p.whatsappLink ? `<div style="margin-top: 18px;">${renderButton(p.whatsappLink, "¿Dudas? Escríbenos por WhatsApp", "#25D366")}</div>` : ""}
  `);
}

/** Ticket de servicio del plan contratado (con copia oculta al equipo si hay ADMIN_EMAIL). */
export async function sendPlanTicketEmail(params: SendPlanTicketParams): Promise<SendEmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "skipped_no_api_key" };

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromAddress(),
      replyTo: resolveReplyTo(),
      to: params.to,
      ...(params.bcc && params.bcc.toLowerCase() !== params.to.toLowerCase() ? { bcc: params.bcc } : {}),
      subject: `Tu ticket de servicio · Plan ${params.planName} · ${params.businessName}`,
      html: renderPlanTicketHtml(params),
    });
    if (result.error) return { status: "failed", error: result.error.message };
    return { status: "sent", providerId: result.data?.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
