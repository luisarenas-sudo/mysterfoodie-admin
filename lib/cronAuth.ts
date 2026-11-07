import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Autoriza a los crons: header `x-cron-secret` igual a CRON_SECRET.
 * Compara en tiempo constante para no filtrar el secreto por tiempos de respuesta.
 */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
