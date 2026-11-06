import { getSupabaseServiceClient } from "./supabase";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Términos y condiciones del servicio. Vive en mysterfoodie.com/terminos/ (fuente: web/_src/build.py).
 * Al publicar cambios importantes a las condiciones, sube esta versión: queda registrada en cada aceptación.
 */
export const TERMS_VERSION = "2026-11-06";
export const TERMS_URL = "https://mysterfoodie.com/terminos/";
export const PRIVACY_URL = "https://mysterfoodie.com/privacidad/";
export const TERMS_REQUIRED_MESSAGE = "Marca la casilla para aceptar los términos y condiciones del servicio.";

export const ADULT_REQUIRED_MESSAGE = "Marca la casilla para confirmar que eres mayor de 18 años.";

export type TermsVia = "password" | "google" | "sesion";

/**
 * ¿Esta persona todavía no ha aceptado los términos? Si la columna aún no existe (falta correr
 * supabase/terminos_aceptacion.sql) se responde que no, para no bloquear a nadie por un error de configuración.
 */
export async function needsTermsAcceptance(db: Db, userId: string): Promise<boolean> {
  const { data, error } = await db.from("profiles").select("terms_accepted_at").eq("id", userId).maybeSingle();
  if (error) return false;
  return !data?.terms_accepted_at;
}

/**
 * Deja constancia de la aceptación (fecha, versión y vía) y de la confirmación de ser mayor de 18 años
 * (misma fecha). Si la columna adult_confirmed_at aún no existe, guarda lo demás para no bloquear a nadie.
 * Devuelve false si no se pudo guardar.
 */
export async function recordTermsAcceptance(db: Db, userId: string, via: TermsVia): Promise<boolean> {
  const now = new Date().toISOString();
  const base = { terms_accepted_at: now, terms_version: TERMS_VERSION, terms_accepted_via: via };
  let { error } = await db.from("profiles").update({ ...base, adult_confirmed_at: now }).eq("id", userId);
  if (error) ({ error } = await db.from("profiles").update(base).eq("id", userId));
  if (error) console.error("No se pudo registrar la aceptación de términos:", error.message);
  return !error;
}
