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
  },
  customTemplate?: string
): string {
  const { businessName, score, reportUrl, waiterName } = params;

  if (customTemplate) {
    return renderTemplate(customTemplate, {
      negocio: businessName,
      mesero: waiterName?.trim() || "",
      promedio: String(score),
      link_reporte: reportUrl,
    });
  }

  const waiterPart = waiterName?.trim() ? ` Nos atendió ${waiterName.trim()}.` : "";
  return (
    `Hola equipo de ${businessName}, hoy los visitamos e hicimos un Mystery Shopper.` +
    `${waiterPart} Obtuvimos ${score} estrellas de promedio. ` +
    `Aquí puedes ver el reporte completo: ${reportUrl}`
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
