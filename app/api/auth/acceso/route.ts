import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  FAILURE_MESSAGES,
  checkCode,
  checkToken,
  consumeAccessToken,
  type AccessCheck,
} from "@/lib/accessTokens";

export const dynamic = "force-dynamic";

/**
 * Pública (la usa /set-password). Tres acciones:
 *  - validate {token}: ¿el link sigue vigente? Devuelve el correo.
 *  - verify {email, code}: ¿el código de 6 dígitos es correcto?
 *  - accept {token | email+code, password}: guarda la contraseña y gasta el token.
 * Después de aceptar, la pantalla inicia sesión con correo + contraseña.
 */
type Body = { action?: string; token?: string; email?: string; code?: string; password?: string };

function failure(check: Extract<AccessCheck, { ok: false }>) {
  const status = check.reason === "locked" ? 429 : 400;
  let error = FAILURE_MESSAGES[check.reason];
  if (check.reason === "invalid" && check.remaining !== undefined) {
    error = `El código no es correcto. Te quedan ${check.remaining} ${check.remaining === 1 ? "intento" : "intentos"}.`;
  }
  return NextResponse.json({ ok: false, reason: check.reason, error }, { status });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "El servicio no está disponible por ahora." }, { status: 500 });
  }

  const resolve = async (): Promise<AccessCheck> => {
    if (body.token) return checkToken(db, body.token);
    return checkCode(db, body.email || "", (body.code || "").trim());
  };

  if (body.action === "validate" || body.action === "verify") {
    const check = await resolve();
    if (!check.ok) return failure(check);
    return NextResponse.json({ ok: true, email: check.row.email, purpose: check.row.purpose });
  }

  if (body.action === "accept") {
    const password = body.password || "";
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    const check = await resolve();
    if (!check.ok) return failure(check);

    const { error } = await db.auth.admin.updateUserById(check.row.user_id, { password, email_confirm: true });
    if (error) {
      return NextResponse.json({ error: "No se pudo guardar la contraseña. Intenta de nuevo." }, { status: 500 });
    }
    await consumeAccessToken(db, check.row.id);
    return NextResponse.json({ ok: true, email: check.row.email });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
