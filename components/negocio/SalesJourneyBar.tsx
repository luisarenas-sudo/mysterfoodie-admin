import Link from "next/link";
import { Pix } from "@/components/ui/Pix";
import type { SalesJourney, StageKey } from "@/lib/salesJourney";

/**
 * Proceso de venta del negocio como barra «caramelo» (rayas diagonales en rojo MysterFoodie). Cuatro etapas:
 * muestra (visita gratis) → ticket y recordatorios → compra del reporte → expansión (perfil, asesoría y paquetes).
 * `variant="team"`: versión para el equipo, con el paso siguiente y el detalle de cada correo.
 * `variant="owner"`: versión para el negocio, en tono «ustedes»; si ya es VIP lo celebra aparte (VipCard).
 * Estilos en app/globals.css (.candy-*).
 */
const SHORT: Record<StageKey, { team: string; owner: string }> = {
  muestra: { team: "Muestra", owner: "Visita" },
  ticket: { team: "Ticket", owner: "Resultado" },
  compra: { team: "Compra", owner: "Reporte" },
  expansion: { team: "Expansión", owner: "Crecer" },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }) : null;

export default function SalesJourneyBar({ journey, variant, className = "" }: { journey: SalesJourney; variant: "team" | "owner"; className?: string }) {
  const { stages, vip } = journey;
  const team = variant === "team";
  const doneCount = stages.filter((s) => s.state === "done").length;
  const current = stages.find((s) => s.state === "current");
  const pctLabel = `${Math.round(((doneCount + (current ? 0.5 : 0)) / stages.length) * 100)}%`;

  return (
    <section className={`card p-4 md:p-5 ${className}`} aria-label={team ? "Proceso de venta" : "Su camino con MysterFoodie"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold md:text-[16px]">{team ? "Proceso de venta" : "Su camino con MysterFoodie"}</h2>
        <div className="flex items-center gap-2">
          {vip && <span className="candy-vip"><Pix e="⭐" size={14} /> VIP</span>}
          <span className="text-[12.5px] font-bold tabular-nums" style={{ color: "rgba(60,60,67,0.6)" }}>{pctLabel}</span>
        </div>
      </div>

      <div
        className={`candy mt-3${vip ? " candy-is-vip" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stages.length}
        aria-valuenow={doneCount}
        aria-valuetext={`${doneCount} de ${stages.length} etapas completas${current ? `; en curso: ${team ? current.title : current.ownerTitle}` : ""}`}
      >
        {stages.map((s, i) => (
          <div key={s.key} className="candy-col">
            <div className="candy-track">
              <div className={`candy-fill ${s.state}`} style={{ ["--w" as string]: s.state === "done" ? "100%" : s.state === "current" ? "52%" : "0%" }} />
            </div>
            <div className={`candy-label ${s.state}`}>
              <span className="candy-n" aria-hidden="true">{s.state === "done" ? "✓" : i + 1}</span>
              <span>{team ? SHORT[s.key].team : SHORT[s.key].owner}</span>
            </div>
          </div>
        ))}
      </div>

      {team ? (
        <p className="mt-4 text-[14px] leading-snug">
          <span className="font-bold">Siguiente: </span>
          {journey.nextTeam}
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-[14.5px] leading-snug">{journey.nextOwner.text}</p>
          {journey.nextOwner.ctas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {journey.nextOwner.ctas.map((c, i) => {
                const external = c.href.startsWith("http");
                const cls = i === 0 ? "btn-primary" : "btn-secondary";
                return external ? (
                  <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={`${cls} text-sm`}>{c.label}</a>
                ) : (
                  <Link key={c.href} href={c.href} className={`${cls} text-sm`}>{c.label}</Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {team && (
        <details className="mt-3">
          <summary className="mf-tap mf-disclosure cursor-pointer py-1 text-[13.5px] font-semibold" style={{ color: "#F24444" }}>
            Ver los pasos y correos de cada etapa
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {stages.map((s) => (
              <div key={s.key}>
                <h3 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: s.state === "todo" ? "rgba(60,60,67,0.45)" : "#1C1C1E" }}>
                  {s.title}{s.state === "current" ? " · en curso" : ""}
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {s.steps.map((st) => (
                    <li key={st.label} className="flex items-start gap-2 text-[13.5px] leading-snug" style={{ color: st.done ? "#1C1C1E" : "rgba(60,60,67,0.55)" }}>
                      <span aria-hidden="true" className="mt-px w-4 flex-shrink-0 text-center font-bold" style={{ color: st.done ? "#248A3D" : "rgba(60,60,67,0.35)" }}>{st.done ? "✓" : "○"}</span>
                      <span>
                        {st.label}
                        {st.at && <span style={{ color: "rgba(60,60,67,0.55)" }}> · {when(st.at)}</span>}
                        {!st.done && st.hint && <span className="block text-[12px]" style={{ color: "rgba(60,60,67,0.5)" }}>{st.hint}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
