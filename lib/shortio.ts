/**
 * Integracion con Short.io para generar los links cortos publicos de los
 * reportes (go.mysterfoodie.com/xxxxx), igual que el sitio anterior.
 * Requiere la variable de entorno SHORTIO_API_KEY (clave secreta de la
 * API de Short.io, scoped al dominio go.mysterfoodie.com).
 */

const SHORTIO_API_URL = "https://api.short.io/links";
const DEFAULT_DOMAIN = "go.mysterfoodie.com";

export type ShortLinkResult =
  | { ok: true; shortURL: string }
  | { ok: false; error: string };

export async function createShortLink(
  originalURL: string,
  opts?: { title?: string }
): Promise<ShortLinkResult> {
  const apiKey = process.env.SHORTIO_API_KEY;
  const domain = process.env.SHORTIO_DOMAIN || DEFAULT_DOMAIN;

  if (!apiKey) {
    return { ok: false, error: "SHORTIO_API_KEY no configurada" };
  }

  try {
    const res = await fetch(SHORTIO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        domain,
        originalURL,
        title: opts?.title,
        allowDuplicates: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Short.io respondio ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { shortURL?: string };
    if (!data.shortURL) {
      return { ok: false, error: "Short.io no devolvio shortURL" };
    }

    return { ok: true, shortURL: data.shortURL };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
