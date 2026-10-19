import { renderTemplate } from "./automations";

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
  },
  customTemplate?: string
): string {
  const { businessName, score, reportUrl, waiterName } = params;
  const tipo = params.tipoNegocio?.trim() || "negocio";

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
    `El resultado fue de ${score} de 5 estrellas. Aquí lo puedes ver: ${reportUrl}`
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
