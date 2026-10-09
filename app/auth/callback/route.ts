import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { safeNextPath } from "@/lib/safeNext";
import { checkToken, consumeAccessToken } from "@/lib/accessTokens";

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
/** Borra cualquier cookie de "code verifier" (PKCE) que haya quedado de
 * un intento anterior fallido - @supabase/ssr guarda una por cada flujo
 * (sb-<ref>-auth-token-code-verifier, y variantes con sufijo
 * "-flow-<hash>" para flujos concurrentes) y, si un intento falla antes
 * de completarse, esa cookie nunca se limpia sola. Dejarlas acumularse
 * entre reintentos puede hacer crecer el header Cookie lo suficiente
 * para que algo en el camino (el CDN, el propio servidor) la recorte o
 * para que el intercambio lea el verifier equivocado - cualquiera de
 * las dos cosas produce "Unable to exchange external code". Se llama
 * tanto en éxito como en error para que nunca se acumulen. */
async function clearStaleCodeVerifierCookies() {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.includes("code-verifier")) {
      cookieStore.delete(name);
    }
  }
}
// Nunca cachear este route handler: cada code de Google es de un solo
// uso, así que una respuesta "congelada" por el cache de rutas de
// Next.js podría servirse para un code distinto al que realmente llegó.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const oauthError = req.nextUrl.searchParams.get("error_description");

  // Si "next" apunta a /perfil, este callback viene del botón "Conecta tu
  // cuenta a Google" (un usuario ya logueado vinculando su identidad, no
  // un inicio de sesión) - en ese caso un error debe regresar a /perfil,
  // no mandar a alguien con sesión activa a la pantalla de /login.
  const errorRedirectPath = next.startsWith("/perfil") ? next.split("?")[0] : "/login";

  if (oauthError) {
    await clearStaleCodeVerifierCookies();
    const qs = new URLSearchParams({ error: oauthError });
    return NextResponse.redirect(new URL(`${errorRedirectPath}?${qs.toString()}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL(errorRedirectPath, baseUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    await clearStaleCodeVerifierCookies();
    const qs = new URLSearchParams({ error: error?.message || "No se pudo completar la conexión con Google." });
    return NextResponse.redirect(new URL(`${errorRedirectPath}?${qs.toString()}`, baseUrl));
  }

  // --- Cuentas nuevas con Google ---------------------------------------------------
  // El acceso es por invitación. Si esta cuenta de Google es NUEVA (no existía), solo
  // se acepta cuando viene de una invitación vigente: se liga la cuenta a esa
  // invitación (rol y negocio) aunque el correo de Google sea otro. Sin invitación, no
  // se deja una cuenta "cliente" vacía dando vueltas: se elimina y se avisa.
  const inviteToken = req.nextUrl.searchParams.get("invite");
  const adminDb = getSupabaseServiceClient();
  const createdMsAgo = Date.now() - new Date(data.user.created_at).getTime();
  const { data: gProfile } = await adminDb
    .from("profiles")
    .select("role, client_id")
    .eq("id", data.user.id)
    .maybeSingle();
  let boundToInvite = false;
  const isFreshStray = createdMsAgo < 10 * 60 * 1000 && (!gProfile || (gProfile.role === "cliente" && !gProfile.client_id));

  if (inviteToken) {
    const check = await checkToken(adminDb, inviteToken);
    if (check.ok && check.row.purpose === "invite") {
      const invitedId = check.row.user_id;
      if (invitedId === data.user.id) {
        await consumeAccessToken(adminDb, check.row.id); // mismo correo: Supabase ya la vinculó
      } else if (isFreshStray) {
        const { data: invitedAuth } = await adminDb.auth.admin.getUserById(invitedId);
        const { data: invitedProfile } = await adminDb
          .from("profiles")
          .select("full_name, role, client_id")
          .eq("id", invitedId)
          .maybeSingle();
        if (invitedProfile && !invitedAuth?.user?.last_sign_in_at) {
          await adminDb.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email ?? check.row.email,
            full_name: invitedProfile.full_name,
            role: invitedProfile.role,
            client_id: invitedProfile.client_id,
          });
          await adminDb.auth.admin.deleteUser(invitedId); // el perfil provisional se va en cascada
          await consumeAccessToken(adminDb, check.row.id);
          boundToInvite = true;
        }
      }
    }
  }

  if (isFreshStray && !boundToInvite && !next.startsWith("/perfil")) {
    await adminDb.auth.admin.deleteUser(data.user.id);
    await supabase.auth.signOut();
    await clearStaleCodeVerifierCookies();
    const qs = new URLSearchParams({
      error:
        "Ese correo de Google no tiene una invitación a MysterFoodie. Abre el link de tu invitación y elige «Crear cuenta con Google», o usa el mismo correo al que llegó la invitación.",
    });
    return NextResponse.redirect(new URL(`/login?${qs.toString()}`, baseUrl));
  }

  // Copiamos foto y nombre de Google al perfil (con service role porque
  // la policy de UPDATE en profiles no deja tocar columnas fuera de las
  // suyas desde el cliente). No pisamos un full_name que el usuario ya
  // haya puesto a mano en la app, solo lo rellenamos si está vacío.
  //
  // OJO: cuando es un login nuevo, Supabase sí copia el perfil de Google
  // a user_metadata. Pero cuando es "vincular cuenta existente"
  // (linkIdentity), Supabase NUNCA mezcla esos datos en user_metadata -
  // se quedan solo dentro de identities[].identity_data para esa
  // identidad en particular. Por eso hay que revisar ambos lugares,
  // o el avatar nunca se copia cuando el usuario ya tenía cuenta y
  // solo conectó Google desde /perfil.
  const meta = data.user.user_metadata || {};
  const googleIdentity = data.user.identities?.find((i) => i.provider === "google");
  const identityData = googleIdentity?.identity_data || {};
  const googleAvatar =
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    (identityData.avatar_url as string | undefined) ||
    (identityData.picture as string | undefined) ||
    null;
  const googleName =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    (identityData.full_name as string | undefined) ||
    (identityData.name as string | undefined) ||
    null;

  if (googleAvatar || googleName) {
    const db = getSupabaseServiceClient();
    const { data: existing } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();
    // Si la persona eligió su propia foto (o quitó la foto para usar sus
    // iniciales) en Perfil, no la pisamos con la de Google.
    const { data: lockRow } = await db
      .from("profiles")
      .select("avatar_locked")
      .eq("id", data.user.id)
      .maybeSingle();
    const avatarLocked = Boolean(lockRow?.avatar_locked);

    const patch: Record<string, string> = {};
    if (googleAvatar && !avatarLocked) patch.avatar_url = googleAvatar;
    if (googleName && !existing?.full_name) patch.full_name = googleName;

    if (Object.keys(patch).length > 0) {
      await db.from("profiles").update(patch).eq("id", data.user.id);
    }
  }

  await clearStaleCodeVerifierCookies();
  return NextResponse.redirect(new URL(next, baseUrl));
}
