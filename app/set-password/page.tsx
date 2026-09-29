"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
  const [success, setSuccess] = useState(false);

  // Fallback manual: si el link fue consumido antes de que el usuario le
  // diera clic (por ejemplo, por un escaneo automático de seguridad del
  // proveedor de correo), permitimos ingresar el código de 6 dígitos que
  // también viene en el correo.
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);

  useEffect(() => {
    let settled = false;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const supabase = await createSupabaseBrowserClient();
      if (cancelled) return;

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
      unsubscribe = () => subscription.unsubscribe();

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const emailFromLink = url.searchParams.get("email");
      if (emailFromLink) setOtpEmail(emailFromLink);

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
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setOtpError(null);

    if (!otpEmail) {
      setOtpError("Ingresa tu correo.");
      return;
    }
    if (otpCode.trim().length < 6) {
      setOtpError("Ingresa el código de 6 dígitos que viene en el correo.");
      return;
    }

    setOtpVerifying(true);
    const supabase = await createSupabaseBrowserClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: otpEmail.trim(),
      token: otpCode.trim(),
      type: "recovery",
    });
    setOtpVerifying(false);

    if (verifyError || !data.session) {
      setOtpError(
        verifyError?.message ??
          "El código no es válido o ya expiró. Solicita un nuevo correo de recuperación."
      );
      return;
    }

    setInvalid(false);
    setReady(true);
  }

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
    const supabase = await createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 900);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Crea tu contraseña</h1>

      {!ready && !invalid && (
        <p className="mt-6 text-sm text-stone-500">Validando invitación...</p>
      )}

      {invalid && (
        <div className="mt-6 space-y-4">
          <p className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
            Este link de invitación ya no es válido o expiró. Si el correo también incluye un
            código de 6 dígitos, puedes ingresarlo aquí en vez de usar el link.
          </p>
          <form onSubmit={handleVerifyOtp} className="space-y-3 rounded-md border border-stone-200 p-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Correo</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Código de 6 dígitos</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="input mt-1 tracking-widest"
                placeholder="000000"
              />
            </label>
            {otpError && <p className="text-sm text-red-600">{otpError}</p>}
            <button
              type="submit"
              disabled={otpVerifying}
              className="w-full rounded-md bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {otpVerifying ? "Verificando..." : "Verificar código"}
            </button>
          </form>
          <p className="text-sm text-stone-500">
            ¿No te llegó el correo o ya no tienes el código?{" "}
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
              Pide uno nuevo
            </Link>
            .
          </p>
        </div>
      )}

      {ready && !success && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Nueva contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input mt-1"
            />
          </label>
          <p className="text-xs text-stone-400">Mínimo 8 caracteres.</p>
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

      {success && (
        <p className="mt-6 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          Contraseña guardada. Entrando...
        </p>
      )}
    </main>
  );
}
