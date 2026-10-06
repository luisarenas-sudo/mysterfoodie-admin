/**
 * Convierte un error de `fetch` en un mensaje entendible. Sin esto, la
 * gente veía textos del navegador como "Failed to fetch" o "Load failed"
 * (en inglés) cuando no tenía internet.
 */
export function friendlyError(
  err: unknown,
  options: { offline?: string; fallback?: string } = {}
): string {
  const offline = options.offline ?? "Sin conexión. Revisa tu internet e intenta de nuevo.";
  const fallback = options.fallback ?? "Algo salió mal. Intenta de nuevo en un momento.";

  if (err instanceof TypeError) return offline; // fetch rechaza con TypeError al no poder conectar
  if (err instanceof Error && /failed to fetch|load failed|network ?error|network request failed|offline/i.test(err.message)) {
    return offline;
  }
  if (err instanceof SyntaxError) return fallback; // la respuesta no era JSON
  return fallback;
}
