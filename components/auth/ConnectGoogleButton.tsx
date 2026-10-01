"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

/**
 * Para un usuario que YA inició sesión (con correo/contraseña, por
 * ejemplo) y solo quiere vincular su cuenta de Google a su perfil
 * existente -- a diferencia de GoogleSignInButton, que inicia una
 * sesión nueva, este usa linkIdentity() sobre la sesión activa.
 * Requiere "Allow manual linking" habilitado en Supabase Auth.
 */
export default function ConnectGoogleButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const supabase = await createSupabaseBrowserClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/perfil?google=conectado");

      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });

      if (linkError) {
        setError(linkError.message);
        setLoading(false);
      }
      // En éxito Supabase redirige a Google de inmediato.
    } catch {
      setError("No se pudo iniciar la conexión con Google. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-stone-50 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
          />
          <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3-2.33z" />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        {loading ? "Conectando…" : "Conecta tu cuenta a Google"}
      </button>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
