"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PagoRow = {
  personId: string;
  name: string;
  roleLabel: string;
  visits: number;
  profiles: number;
  total: number;
  salesCount: number;
  paidAt: string | null;
};

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const MUTED = "rgba(60,60,67,0.6)";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

/** Lista de pagos del mes: una palomita por persona ("ya le pagué") y los totales al momento. */
export default function PagosMes({ month, rows: initial }: { month: string; rows: PagoRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = rows.reduce((a, r) => a + r.total, 0);
  const paid = rows.filter((r) => r.paidAt).reduce((a, r) => a + r.total, 0);
  const left = total - paid;
  const pendingCount = rows.filter((r) => !r.paidAt).length;

  async function toggle(r: PagoRow) {
    const next = !r.paidAt;
    setBusyId(r.personId);
    setError(null);
    try {
      const res = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pagado", month, personId: r.personId, paid: next }),
      });
      if (!res.ok) throw new Error();
      setRows((all) => all.map((x) => (x.personId === r.personId ? { ...x, paidAt: next ? new Date().toISOString() : null } : x)));
      router.refresh();
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Falta pagar</div>
          <div className="mt-1 text-[19px] font-bold leading-tight" style={{ color: left > 0 ? "#F24444" : "#248A3D" }}>{money(left)}</div>
          <div className="text-[11.5px]" style={{ color: MUTED }}>{pendingCount === 0 ? "Todo pagado" : `${pendingCount} ${pendingCount === 1 ? "persona" : "personas"}`}</div>
        </div>
        <div className="card p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Ya pagado</div>
          <div className="mt-1 text-[19px] font-bold leading-tight">{money(paid)}</div>
          <div className="text-[11.5px]" style={{ color: MUTED }}>de {money(total)}</div>
        </div>
        <div className="card flex items-center justify-center p-3.5">
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Avance</div>
            <div className="mt-1 text-[19px] font-bold leading-tight">{rows.length ? `${rows.filter((r) => r.paidAt).length}/${rows.length}` : "—"}</div>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px]" style={{ color: "#C7301E" }}>{error}</p>}

      <div className="card mt-4 overflow-hidden">
        {rows.length === 0 && <p className="p-4 text-[14px]" style={{ color: MUTED }}>No hay depósitos este mes.</p>}
        {rows.map((r, i) => {
          const done = Boolean(r.paidAt);
          return (
            <div key={r.personId} className="px-4 py-3.5" style={{ borderTop: i > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined, background: done ? "#F4FBF6" : undefined }}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={busyId === r.personId}
                  aria-pressed={done}
                  aria-label={done ? `Quitar pago de ${r.name}` : `Marcar pagado a ${r.name}`}
                  className="mf-tap mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                  style={{ background: done ? "#34C759" : "#fff", border: done ? "none" : "2px solid rgba(60,60,67,0.3)" }}
                >
                  {done && (
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="truncate text-[16px] font-bold" style={{ textDecoration: done ? "none" : undefined }}>{r.name}</div>
                    <div className="text-[18px] font-extrabold">{money(r.total)}</div>
                  </div>
                  <div className="text-[12.5px]" style={{ color: MUTED }}>
                    {r.roleLabel} · {r.salesCount} {r.salesCount === 1 ? "venta" : "ventas"}
                    {done && r.paidAt ? ` · Pagado el ${dayLabel(r.paidAt)}` : ""}
                  </div>
                  <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>
                    Visitas {money(r.visits)}{r.profiles > 0 ? ` · Perfiles ${money(r.profiles)}` : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
