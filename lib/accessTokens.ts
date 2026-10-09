import { createHash, createHmac, randomBytes, randomInt } from "crypto";
import { getSupabaseServiceClient } from "./supabase";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Acceso propio: invitaciones y recuperación de contraseña con link Y código
 * de 6 dígitos, vigentes 5 días. Reemplaza los links de Supabase, que caducan
 * en 1 hora (24 h como máximo) y que los escáneres de correo "gastan" antes de
 * que la persona los abra. Aquí abrir el link NO lo consume: solo se gasta al
 * guardar la contraseña. Solo se guardan hashes (tabla access_tokens).
 */

export const ACCESS_TTL_DAYS = 5;
export const MAX_CODE_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessPurpose = "invite" | "recovery";

export type AccessRow = {
  id: string;
  user_id: string;
  email: string;
  purpose: AccessPurpose;
  expires_at: string;
  used_at: string | null;
  attempts: number;
};

export type AccessFailure = "invalid" | "expired" | "used" | "locked";
export type AccessCheck = { ok: true; row: AccessRow } | { ok: false; reason: AccessFailure; remaining?: number };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashCode(email: string, code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || "mysterfoodie";
  return createHmac("sha256", pepper).update(`${email.trim().toLowerCase()}:${code}`).digest("hex");
}

const COLUMNS = "id, user_id, email, purpose, expires_at, used_at, attempts";

export function accessUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/set-password?t=${encodeURIComponent(token)}`;
}

/** Crea un token nuevo (y deja sin efecto los anteriores de esa persona). */
export async function issueAccessToken(
  db: Db,
  params: { userId: string; email: string; purpose: AccessPurpose }
): Promise<{ token: string; code: string; expiresAt: Date }> {
  const email = params.email.trim().toLowerCase();
  await db
    .from("access_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .is("used_at", null);

  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + ACCESS_TTL_DAYS * DAY_MS);

  const { error } = await db.from("access_tokens").insert({
    user_id: params.userId,
    email,
    purpose: params.purpose,
    token_hash: hashToken(token),
    code_hash: hashCode(email, code),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(error.message);
  return { token, code, expiresAt };
}

function classify(row: AccessRow): AccessFailure | null {
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  if (row.attempts >= MAX_CODE_ATTEMPTS) return "locked";
  return null;
}

export async function checkToken(db: Db, token: string): Promise<AccessCheck> {
  if (!token || token.length < 20) return { ok: false, reason: "invalid" };
  const { data } = await db.from("access_tokens").select(COLUMNS).eq("token_hash", hashToken(token)).maybeSingle();
  if (!data) return { ok: false, reason: "invalid" };
  const row = data as AccessRow;
  const bad = classify(row);
  return bad ? { ok: false, reason: bad } : { ok: true, row };
}

/** Valida correo + código contra el token más reciente de esa persona. Cada fallo cuenta. */
export async function checkCode(db: Db, email: string, code: string): Promise<AccessCheck> {
  const mail = email.trim().toLowerCase();
  if (!mail || !/^\d{6}$/.test(code)) return { ok: false, reason: "invalid" };

  const { data } = await db
    .from("access_tokens")
    .select(`${COLUMNS}, code_hash`)
    .eq("email", mail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: false, reason: "invalid" };

  const row = data as AccessRow & { code_hash: string };
  const bad = classify(row);
  if (bad) return { ok: false, reason: bad };

  if (row.code_hash !== hashCode(mail, code)) {
    const attempts = row.attempts + 1;
    await db.from("access_tokens").update({ attempts }).eq("id", row.id);
    return { ok: false, reason: attempts >= MAX_CODE_ATTEMPTS ? "locked" : "invalid", remaining: Math.max(0, MAX_CODE_ATTEMPTS - attempts) };
  }
  return { ok: true, row };
}

export async function consumeAccessToken(db: Db, id: string): Promise<void> {
  await db.from("access_tokens").update({ used_at: new Date().toISOString() }).eq("id", id);
}

/** Segundos desde el último token emitido a esa persona (para no spamear correos). */
export async function secondsSinceLastToken(db: Db, userId: string): Promise<number | null> {
  const { data } = await db
    .from("access_tokens")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return (Date.now() - new Date(data.created_at as string).getTime()) / 1000;
}

export const FAILURE_MESSAGES: Record<AccessFailure, string> = {
  invalid: "El link o el código no es válido.",
  expired: `Esta invitación ya venció (dura ${ACCESS_TTL_DAYS} días). Pide una nueva.`,
  used: "Este link ya se usó o fue reemplazado por un correo más reciente. Usa el correo más nuevo o pide uno nuevo.",
  locked: "Demasiados intentos con el código. Pide un correo nuevo.",
};
