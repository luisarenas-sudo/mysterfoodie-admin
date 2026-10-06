import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServiceClient } from "./supabase";

export type Role = "admin" | "agente" | "cliente" | "sibarita";

export type SessionProfile = {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  /** true si el usuario ya tiene a Google como identidad vinculada (login o conectar cuenta). */
  hasGoogleIdentity: boolean;
  role: Role;
  clientId: string | null;
};

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers: lee/escribe la sesión vía cookies (usa la anon key, no la
 * service role key). En un Server Component puro las cookies son de
 * solo lectura; el try/catch de abajo lo tolera porque el middleware
 * ya se encarga de refrescar la sesión en ese caso.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // llamado desde un Server Component sin permiso de escritura
        }
      },
    },
  });
}

/**
 * Sesión actual + rol, o null si no hay usuario logueado. Valida el
 * usuario contra el servidor de Supabase Auth (no solo lee la cookie).
 *
 * Va envuelta en cache() de React: dentro de una misma petición (layout,
 * header y página lo llaman por separado) se resuelve una sola vez en
 * lugar de ir a Supabase Auth y a "profiles" por cada llamada.
 */
export const getSessionProfile = cache(async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getSupabaseServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, full_name, avatar_url, client_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    hasGoogleIdentity: (user.identities ?? []).some((i) => i.provider === "google"),
    role: profile.role as Role,
    clientId: profile.client_id,
  };
});

/**
 * Usar en Server Components y Route Handlers como defensa adicional
 * detrás del middleware. Lanza si no hay sesión o el rol no coincide.
 */
export async function requireRole(...roles: Role[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile || !roles.includes(profile.role)) {
    throw new Error("No autorizado");
  }
  return profile;
}
