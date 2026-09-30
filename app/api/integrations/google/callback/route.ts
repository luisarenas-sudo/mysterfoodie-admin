import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/googleCalendar";

/**
 * Callback de OAuth de Google (ver /api/integrations/google/start).
 * Intercambia el `code` por tokens y los guarda. Siempre redirige de
 * vuelta a /automatizaciones con un mensaje de éxito o error.
 */
export async function GET(req: NextRequest) {
  const redirectTo = new URL("/automatizaciones", req.nextUrl.origin);

  let profile;
  try {
    profile = await requireRole("admin");
  } catch {
    redirectTo.searchParams.set("google_error", "Necesitas iniciar sesión como admin");
    return NextResponse.redirect(redirectTo);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("google_oauth_state")?.value;
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    redirectTo.searchParams.set("google_error", `Google canceló la conexión (${error})`);
    return NextResponse.redirect(redirectTo);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectTo.searchParams.set("google_error", "El enlace de conexión ya expiró, intenta de nuevo");
    return NextResponse.redirect(redirectTo);
  }

  try {
    await exchangeCodeForTokens(code, profile.email);
    redirectTo.searchParams.set("google_connected", "1");
  } catch (err) {
    redirectTo.searchParams.set(
      "google_error",
      err instanceof Error ? err.message : "No se pudo conectar Google Calendar"
    );
  }

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete("google_oauth_state");
  return res;
}
