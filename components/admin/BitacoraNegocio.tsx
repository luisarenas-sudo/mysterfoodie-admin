import { Pix } from "@/components/ui/Pix";
import type { BitacoraEntry } from "@/lib/bitacora";

/**
 * Bitácora de un negocio (solo Master Chef). Cerrada es UN botón grande con la última acción; al tocarlo se
 * despliega la línea de tiempo (lo más reciente arriba, agrupada por día) y, al final, lo más antiguo.
 */
const INK_SOFT = "rgba(60,60,67,0.6)";
const RECENT = 12;
const TZ = "America/Mexico_City";

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.toLocaleDateString("es-MX", { year: "numeric", timeZone: TZ }) === new Date().toLocaleDateString("es-MX", { year: "numeric", timeZone: TZ });
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: TZ });
};
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const short = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: TZ }).replace(".", "");

function List({ entries }: { entries: BitacoraEntry[] }) {
  let last = "";
  return (
    <ol>
      {entries.map((e, i) => {
        const d = dayLabel(e.at);
        const head = d !== last;
        last = d;
        return (
          <li key={`${e.at}-${i}`}>
            {head && (
              <div className={`${i === 0 ? "" : "mt-3.5"} mb-0.5 text-[11.5px] font-bold uppercase tracking-wide`} style={{ color: INK_SOFT }}>
                {d}
              </div>
            )}
            <div className="flex items-start gap-2.5 py-1.5">
              <Pix e={e.emoji} size={17} className="mt-px flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]" style={e.warn ? { color: "#C7301E" } : undefined}>
                  {e.title}
                </div>
                <div className="text-[12px] leading-snug [overflow-wrap:anywhere]" style={{ color: "rgba(60,60,67,0.5)" }}>
                  {hour(e.at)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function BitacoraNegocio({ entries }: { entries: BitacoraEntry[] }) {
  const recent = entries.slice(0, RECENT);
  const older = entries.slice(RECENT);
  const latest = entries[0];
  return (
    <details className="card group overflow-hidden" aria-label="Bitácora del negocio">
      <summary className="mf-tap flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: "#8E8E93" }} aria-hidden="true">
          <Pix e="📜" size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-tight">Bitácora</span>
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
            {latest ? `${latest.title} · ${short(latest.at)}, ${hour(latest.at)}` : "Aún sin movimientos"}
          </span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0 transition-transform group-open:rotate-90" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid rgba(60,60,67,0.08)" }}>
        <div className="pt-3">
          {entries.length === 0 ? (
            <p className="text-[13px]" style={{ color: INK_SOFT }}>Aún no hay movimientos registrados.</p>
          ) : (
            <>
              <List entries={recent} />
              {older.length > 0 && (
                <details className="mt-3">
                  <summary className="mf-tap mf-disclosure cursor-pointer py-1 text-[13.5px] font-semibold" style={{ color: "#F24444" }}>
                    Ver {older.length} más antiguos
                  </summary>
                  <div className="mt-2">
                    <List entries={older} />
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </details>
  );
}
