import { NextResponse, type NextRequest } from "next/server";

/**
 * Límite de intentos por IP para rutas públicas (ventana deslizante en memoria).
 * Es un freno de mejor esfuerzo por instancia del servidor: corta ráfagas y abusos simples
 * sin depender de infraestructura extra. Las rutas sensibles además tienen límites propios en base de datos.
 */
const buckets = new Map<string, number[]>();
let lastSweep = 0;

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "desconocida";
}

/** Devuelve una respuesta 429 si se pasó del límite, o null si puede seguir. */
export function rateLimit(req: NextRequest, name: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, hits] of buckets) {
      if (!hits.length || now - hits[hits.length - 1] > 3_600_000) buckets.delete(k);
    }
  }
  const key = `${name}:${clientIp(req)}`;
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } }
    );
  }
  hits.push(now);
  buckets.set(key, hits);
  return null;
}
