"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Acciones del reporte de pagos: generar / recalcular el mes, reenviar el correo y bajar el CSV. */
export default function PagosAcciones({ month, hasReport }: { month: string; hasReport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: "generar" | "reenviar") {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pagos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, month }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data.error || "No se pudo completar");
      else {
        setMsg(action === "reenviar" ? "Correo enviado." : hasReport ? "Reporte recalculado. Lo ya pagado no cambió." : "Reporte generado.");
        router.refresh();
      }
    } catch {
      setMsg("Sin conexión. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  const pill = "mf-tap rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-50";
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {!hasReport ? (
          <button type="button" onClick={() => run("generar")} disabled={busy !== null} className={`${pill} text-white`} style={{ background: "#F24444" }}>
            {busy === "generar" ? "Generando…" : "Generar reporte de este mes"}
          </button>
        ) : (
          <>
            <a href={`/api/admin/pagos/csv?mes=${month}`} className={pill} style={{ background: "#fff", color: "#1C1C1E", border: "1px solid rgba(60,60,67,0.2)" }}>Descargar CSV</a>
            <button type="button" onClick={() => run("reenviar")} disabled={busy !== null} className={pill} style={{ background: "#fff", color: "#1C1C1E", border: "1px solid rgba(60,60,67,0.2)" }}>
              {busy === "reenviar" ? "Enviando…" : "Reenviar correo"}
            </button>
            <button type="button" onClick={() => run("generar")} disabled={busy !== null} className={pill} style={{ background: "#fff", color: "#1C1C1E", border: "1px solid rgba(60,60,67,0.2)" }}>
              {busy === "generar" ? "Recalculando…" : "Recalcular"}
            </button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-[13px]" style={{ color: "rgba(60,60,67,0.7)" }}>{msg}</p>}
    </div>
  );
}
