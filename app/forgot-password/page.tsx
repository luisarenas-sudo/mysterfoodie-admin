"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Ingresa tu correo.");
      return;
    }

    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setSending(false);

    if (resetError) {
      setError("No pudimos procesar la solicitud. Intenta de nuevo en unos minutos.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Recupera tu contraseña</h1>
      <p className="mt-1 text-sm text-stone-500">
        Te enviaremos un correo con un link para crear una nueva contraseña. Si el link no
        abre, el mismo correo trae un código de 6 dígitos que puedes ingresar a mano.
      </p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
            Si <strong>{email.trim()}</strong> tiene una cuenta, te llegará un correo en los
            próximos minutos. Revisa también spam o promociones.
          </p>
          <Link href="/login" className="block text-sm font-medium text-brand-600 hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Correo</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="tu@correo.com"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-md bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar instrucciones"}
          </button>
          <Link
            href="/login"
            className="block text-center text-sm text-stone-500 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </main>
  );
}
