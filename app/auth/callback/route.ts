import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Callback de OAuth (Google Sign-In). Supabase redirige aquí con un
 * `code` en la query string; lo intercambiamos por una sesión y, de
 * paso, copiamos la foto/nombre que entregó Google al perfil, para
 * que el avatar se vea bien en toda la app.
 *
 * Usamos APP_URL en vez de req.nextUrl.origin por la misma razón que
 * en app/api/integrations/google/callback/route.ts: detrás del proxy
 * de GoDaddy el origin de la petición puede resolver a una dirección
 * interna en vez del dominio público.
 */
// Nunca cachear este route handler: cada code de Google es de un solo
// uso, así que una respuesta "congelada" por el cache de rutas de
// Next.js podría servirse para un code distinto al que realmente llegó.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/";
  const oauthError = req.nextUrl.searchParams.get("error_description");

  // Si "next" apunta a /perfil, este callback viene del botón "Conecta tu
  // cuenta a Google" (un usuario ya logueado vinculando su identidad, no
  // un inicio de sesión) - en ese caso un error debe regresar a /perfil,
  // no mandar a alguien con sesión activa a la pantalla de /login.
  const errorRedirectPath = next.startsWith("/perfil") ? next.split("?")[0] : "/login";

  if (oauthError) {
    const qs = new URLSearchParams({ error: oauthError });
    return NextResponse.redirect(new URL(`${errorRedirectPath}?${qs.toString()}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL(errorRedirectPath, baseUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const qs = new URLSearchParams({ error: error?.message || "No se pudo completar la conexión con Google." });
    return NextResponse.redirect(new URL(`${errorRedirectPath}?${qs.toString()}`, baseUrl));
  }

  // Copiamos foto y nombre de Google al perfil (con service role porque
  // la policy de UPDATE en profiles no deja tocar columnas fuera de las
  // suyas desde el cliente). No pisamos un full_name que el usuario ya
  // haya puesto a mano en la app, solo lo rellenamos si está vacío.
  const meta = data.user.user_metadata || {};
  const googleAvatar = (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;
  const googleName = (meta.full_name as string | undefined) || (meta.name as string | undefined) || null;

  if (googleAvatar || googleName) {
    const db = getSupabaseServiceClient();
    const { data: existing } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    const patch: Record<string, string> = {};
    if (googleAvatar) patch.avatar_url = googleAvatar;
    if (googleName && !existing?.full_name) patch.full_name = googleName;

    if (Object.keys(patch).length > 0) {
      await db.from("profiles").update(patch).eq("id", data.user.id);
    }
  }

  return NextResponse.redirect(new URL(next, baseUrl));
}
