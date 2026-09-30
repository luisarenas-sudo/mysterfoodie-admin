export function buildDmMessage(params: {
  businessName: string;
  score: number;
  reportUrl: string;
  waiterName?: string | null;
}): string {
  const { businessName, score, reportUrl, waiterName } = params;
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
