import { renderTemplate } from "./automations";
import { isLowScore } from "./verdict";

/**
 * Arma el mensaje de DM de Instagram. Si se pasa `customTemplate` (la
 * plantilla editable de Automatizaciones, clave "instagram_dm"), se usa
 * esa en vez del texto por default -- ver {{tags}} disponibles en
 * AUTOMATION_CATALOG.instagram_dm.
 */
export function buildDmMessage(
  params: {
    businessName: string;
    score: number;
    reportUrl: string;
    waiterName?: string | null;
    /** "cafetería", "restaurante"… (ver businessTypePhrase). */
    tipoNegocio?: string;
    /** Demo GRATIS: se les regala el reporte completo y el link lleva el botón de descarga. */
    freeGift?: boolean;
  },
  customTemplate?: string
): string {
  const { businessName, score, reportUrl, waiterName } = params;
  const tipo = params.tipoNegocio?.trim() || "negocio";

  // Demo GRATIS: mensaje de regalo (sin calificación ni plantilla editable; el link abre el botón de descarga).
  if (params.freeGift) {
    const w = waiterName?.trim() ? ` Lo atendió ${waiterName.trim()}.` : "";
    return (
      `Hola equipo de ${businessName}. Un MysterFoodie visitó su ${tipo} sin avisar, pagó su consumo ` +
      `y calificó de forma independiente la experiencia real.${w} ` +
      `Les regalamos su reporte completo, sin ningún costo. Descarga GRATIS tu reporte aquí: ${reportUrl}`
    );
  }

  // Nota baja: sin la calificación en el primer mensaje y con enfoque de ayuda (ignora la plantilla editable, que la menciona).
  if (isLowScore(score)) {
    const w = waiterName?.trim() ? ` Lo atendió ${waiterName.trim()}.` : "";
    return (
      `Hola equipo de ${businessName}. Un MysterFoodie visitó su ${tipo} sin avisar, pagó su consumo ` +
      `y evaluó de forma independiente la experiencia real.${w} ` +
      `Les comparto su resultado: trae oportunidades claras y con gusto les ayudo a ver por dónde empezar. Aquí lo pueden ver: ${reportUrl}`
    );
  }

  if (customTemplate) {
    const waiter = waiterName?.trim() || "";
    return renderTemplate(customTemplate, {
      negocio: businessName,
      tipo_negocio: tipo,
      mesero: waiter,
      // Frase ya armada ("Lo atendió X.", igual que en el correo) para no
      // dejar un hueco raro cuando la visita no tiene mesero capturado.
      mesero_linea: waiter ? ` Lo atendió ${waiter}.` : "",
      promedio: String(score),
      link_reporte: reportUrl,
    });
  }

  // Mismo mensaje que el correo (ver DEFAULT_RESULTADO_INTRO en lib/automations.ts):
  // mismas palabras, misma persona gramatical y UNA sola acción (ver el resultado).
  const waiterPart = waiterName?.trim() ? ` Lo atendió ${waiterName.trim()}.` : "";
  return (
    `Hola equipo de ${businessName}. Un MysterFoodie visitó su ${tipo} sin avisar, pagó su consumo ` +
    `y calificó de forma independiente la experiencia real.${waiterPart} ` +
    `El resultado fue de ${score} de 5 estrellas. Aquí lo pueden ver: ${reportUrl}`
  );
}

export function cleanInstagramUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
}

export function buildInstagramDmLink(usernameRaw: string): string {
  const username = cleanInstagramUsername(usernameRaw);
  return `https://ig.me/m/${username}`;
}

export function buildInstagramProfileLink(usernameRaw: string): string {
  const username = cleanInstagramUsername(usernameRaw);
  return `https://instagram.com/${username}`;
}
