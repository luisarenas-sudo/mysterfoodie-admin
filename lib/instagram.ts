export function buildDmMessage(params: {
  businessName: string;
  score: number;
  reportUrl: string;
}): string {
  const { businessName, score, reportUrl } = params;
  return (
    `Hola equipo de ${businessName}, el dia de hoy los visitamos y sin compromiso ` +
    `hicimos un Mystery Shopper aprovechando que ya disfrutamos de ${businessName}, ` +
    `donde encontramos varias cosas super interesantes y ${score} estrellas como promedio. ` +
    `Si gustan saber el reporte completo, aqui pueden verlo: ${reportUrl} y conocer mas ` +
    `de los indicadores lideres en la industria evaluados por MysterFoodie.`
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
