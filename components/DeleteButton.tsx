"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botón de "Eliminar" con confirmación inline de dos pasos (nada de
 * window.confirm, para mantener el estilo visual de la app). Se usa
 * tanto para borrar un negocio (app/negocios/[id]) como una visita
 * (app/visitas/[formId]), en su versión de escritorio y la móvil.
 */
export default function DeleteButton({
  endpoint,
  confirmText,
  redirectTo,
  triggerLabel = "Eliminar",
  variant = "desktop",
}: {
  endpoint: string;
  confirmText: string;
  redirectTo: string;
  triggerLabel?: string;
  variant?: "desktop" | "mobile";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar.");
        setBusy(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Error de red, intenta de nuevo.");
      setBusy(false);
    }
  }

  if (variant === "mobile") {
    if (!confirming) {
      return (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mf-tap mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold"
          style={{ background: "#fff", color: "#F24444", border: "1.5px solid rgba(242,68,68,0.35)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z"
              stroke="#F24444"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {triggerLabel}
        </button>
      );
    }

    return (
      <div
        className="mt-3.5 rounded-2xl p-3.5"
        style={{ background: "rgba(242,68,68,0.06)", border: "1.5px solid rgba(242,68,68,0.3)" }}
      >
        <p className="text-[13px] font-medium" style={{ color: "#B32E2E" }}>
          {confirmText}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mf-tap flex-1 rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: "#F24444" }}
          >
            {busy ? "Eliminando…" : "Sí, eliminar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="mf-tap flex-1 rounded-xl py-2.5 text-[14px] font-semibold disabled:opacity-60"
            style={{ background: "#fff", color: "rgba(60,60,67,0.7)", border: "1.5px solid rgba(60,60,67,0.15)" }}
          >
            Cancelar
          </button>
        </div>
        {error && <p className="mt-2 text-[12px]" style={{ color: "#F24444" }}>{error}</p>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
      <p className="text-sm text-brand-700">{confirmText}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="w-full text-xs text-brand-600">{error}</p>}
    </div>
  );
}
