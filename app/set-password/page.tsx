"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // El flujo implícito (links de recuperación generados desde el
      // dashboard de Supabase) llega con el token en el hash de la URL
      // (#access_token=...&type=recovery) y el SDK lo procesa de forma
      // asíncrona, disparando este evento cuando termina.
      if (settled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setReady(true);
      }
    });

    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      // Flujo PKCE (links generados por la propia app con `code=...`).
      if (code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        if (data.session) {
          settled = true;
          setReady(true);
          return;
        }
      }

      // Puede que el SDK ya haya procesado el hash de la URL antes de
      // que este efecto corriera.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settled = true;
        setReady(true);
        return;
      }

      // Como último recurso, le damos un momento al SDK para terminar
      // de procesar el hash de la URL (flujo implícito) antes de
      // marcar el link como inválido.
      window.setTimeout(async () => {
        if (settled) return;
        const { data: retryData } = await supabase.auth.getSession();
        if (retryData.session) {
          settled = true;
          setReady(true);
        } else {
          setInvalid(true);
        }
      }, 1200);
    })();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Crea tu contraseña</h1>

      {!ready && !invalid && (
        <p className="mt-6 text-sm text-stone-500">Validando invitación...</p>
      )}

      {invalid && (
        <p className="mt-6 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          Este link de invitación ya no es válido o expiró. Pide al equipo que te reenvíe la
          invitación.
        </p>
      )}

      {ready && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Nueva contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Confirma la contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input mt-1"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar y entrar"}
          </button>
        </form>
      )}
    </main>
  );
}
