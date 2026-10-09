"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Botón de un Foodie para tomar una visita gratis de la bolsa abierta (días 4 y 5). */
export default function TomarSolicitudButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function take() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/solicitudes/${requestId}/tomar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo tomar la visita");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo tomar la visita");
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={take}
        disabled={busy}
        className="mf-tap mt-3 w-full rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
        style={{ background: "#F24444" }}
      >
        {busy ? "Tomando…" : "Tomar esta visita"}
      </button>
      {error && <p className="mt-2 text-[12.5px]" style={{ color: "#C0271D" }}>{error}</p>}
    </>
  );
}
