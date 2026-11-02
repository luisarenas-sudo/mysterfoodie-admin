import { Pix } from "@/components/ui/Pix";
import { GROUP_LABEL, type BitacoraEntry } from "@/lib/bitacora";

/** Línea de tiempo de un negocio (solo Master Chef): fecha, hora y acción, de lo más nuevo a lo más viejo. */
const INK_SOFT = "rgba(60,60,67,0.6)";
const VISIBLE = 30;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });

function List({ entries }: { entries: BitacoraEntry[] }) {
  let last = "";
  return (
    <ol className="space-y-0">
      {entries.map((e, i) => {
        const d = dayKey(e.at);
        const head = d !== last;
        last = d;
        return (
          <li key={`${e.at}-${i}`}>
            {head && (
              <div className={`${i === 0 ? "" : "mt-4"} mb-1.5 text-[11.5px] font-bold uppercase tracking-wide`} style={{ color: INK_SOFT }}>
                {d}
              </div>
            )}
            <div className="flex items-start gap-2.5 py-1.5">
              <span className="w-[62px] flex-shrink-0 pt-px text-[12px] tabular-nums" style={{ color: INK_SOFT }}>
                {hour(e.at)}
              </span>
              <Pix e={e.emoji} size={18} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-snug" style={e.warn ? { color: "#C7301E" } : undefined}>
                  {e.title}
                </div>
                {e.detail && (
                  <div className="text-[12.5px] leading-snug" style={{ color: INK_SOFT }}>
                    {e.detail}
                  </div>
                )}
                <div className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.4)" }}>
                  {GROUP_LABEL[e.group]}
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
  const first = entries.slice(0, VISIBLE);
  const rest = entries.slice(VISIBLE);
  return (
    <section className="card p-5" aria-label="Bitácora del negocio">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Pix e="📜" size={22} /> Bitácora
      </h2>
      <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: INK_SOFT }}>
        Todo lo que ha pasado con este negocio: quién hizo qué, los correos y las automatizaciones. Solo la ve el Master Chef.
      </p>
      <div className="mt-4">
        {entries.length === 0 ? (
          <p className="text-[13px]" style={{ color: INK_SOFT }}>Aún no hay movimientos registrados.</p>
        ) : (
          <>
            <List entries={first} />
            {rest.length > 0 && (
              <details className="mt-3">
                <summary className="mf-tap cursor-pointer text-[13.5px] font-semibold" style={{ color: "#F24444" }}>
                  Ver {rest.length} movimientos más antiguos
                </summary>
                <div className="mt-3">
                  <List entries={rest} />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
