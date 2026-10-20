"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AspiranteActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"aprobar" | "rechazar" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (action: "aprobar" | "rechazar") => {
    if (action === "rechazar" && !confirm(`¿Rechazar la solicitud de ${name}?`)) return;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/aspirantes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar");
      if (data.warning) setMsg(data.warning);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex gap-2.5">
        <button type="button" disabled={!!busy} onClick={() => act("rechazar")} className="mf-tap min-h-[44px] flex-1 rounded-[12px] text-[14px] font-semibold" style={{ background: "rgba(60,60,67,0.08)" }}>
          {busy === "rechazar" ? "…" : "Rechazar"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => act("aprobar")} className="mf-tap min-h-[44px] flex-1 rounded-[12px] text-[14px] font-bold text-white" style={{ background: "#34C759" }}>
          {busy === "aprobar" ? "Creando cuenta…" : "Aprobar y mandar acceso"}
        </button>
      </div>
      {msg && <p className="mt-2 text-[12.5px]" style={{ color: "#C7301E" }}>{msg}</p>}
    </div>
  );
}
