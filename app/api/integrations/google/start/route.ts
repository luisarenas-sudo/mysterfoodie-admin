import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireRole } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/lib/googleCalendar";

/**
 * Inicia el flujo de OAuth para conectar Google Calendar (ver
 * Automatizaciones). Solo admin. Guarda un `state` aleatorio en una
 * cookie corta para validar el callback (evita CSRF) y redirige al
 * consentimiento de Google.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let authUrl: string;
  const state = nanoid(24);
  try {
    authUrl = getGoogleAuthUrl(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar la conexión con Google";
    const url = new URL("/automatizaciones", req.nextUrl.origin);
    url.searchParams.set("google_error", message);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
