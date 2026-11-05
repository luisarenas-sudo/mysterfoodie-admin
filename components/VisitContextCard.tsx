import { contextRows, type VisitContext } from "@/lib/visitContext";

/** «Contexto de la visita» del reporte completo (solo se pinta si la visita guardó esos datos). */
export default function VisitContextCard({ context, variant }: { context: VisitContext | null; variant: "mobile" | "desktop" }) {
  if (!context) return null;
  const rows = contextRows(context);
  if (rows.length === 0) return null;

  if (variant === "mobile") {
    return (
      <div className="mb-5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
          <span>🕒</span>
          Contexto de la visita
        </div>
        <div className="card overflow-hidden px-4">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex items-start justify-between gap-3 py-2.5"
              style={i < rows.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
            >
              <div className="text-[13.5px]" style={{ color: "rgba(60,60,67,0.8)" }}>
                {r.label}
              </div>
              <div className="text-right text-[13px] font-semibold">{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="heading text-xl text-ink">Contexto de la visita</h2>
      <div className="card mt-3 divide-y divide-stone-100 px-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <span className="text-stone-500">{r.label}</span>
            <span className="text-right font-semibold text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
