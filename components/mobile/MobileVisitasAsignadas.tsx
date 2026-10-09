import Link from "next/link";
import type { PendingAssignment } from "@/lib/dashboard";
import type { OpenPoolItem } from "@/lib/visitRequests";
import TomarSolicitudButton from "./TomarSolicitudButton";

const TYPE_LABEL: Record<string, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafeteria: "Cafetería",
};

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Lista de negocios asignados a un Foodie, pendientes de visitar. Un
 * Foodie ya no puede levantar una visita libre (ver /api/visits): solo
 * puede abrir una de estas asignaciones, que lo lleva al wizard
 * pre-cargado con el negocio correspondiente.
 */
export default function MobileVisitasAsignadas({ assignments, pool = [] }: { assignments: PendingAssignment[]; pool?: OpenPoolItem[] }) {
  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col mf-push-in" style={{ background: "#F2F2F7" }}>
      <div
        style={{
          background: "rgba(249,249,251,0.95)",
          borderBottom: "1px solid rgba(60,60,67,0.1)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
          <Link
            href="/"
            aria-label="Atrás"
            className="mf-tap -my-3 flex w-[46px] flex-shrink-0 items-center py-3"
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" stroke="#F24444" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex-1 truncate text-center text-[16px] font-bold">Visitas asignadas</div>
          <div className="w-[46px] flex-shrink-0" />
        </div>
      </div>

      <div className="mf-scroll flex-1 overflow-y-auto px-5 pb-8 pt-5">
        {assignments.length === 0 ? (
          <div className="card mt-6 p-6 text-center">
            <div className="text-[34px]">📭</div>
            <div className="mt-2 text-[15px] font-bold">Sin visitas asignadas</div>
            <div className="mt-1 text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Cuando el admin te asigne un negocio, aparecerá aquí.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/nueva-visita/${a.id}`}
                className="mf-tap card block p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15.5px] font-bold">{a.clientName}</div>
                    <div className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {TYPE_LABEL[a.clientType] ?? "Negocio"} ·{" "}
                      {a.plan ? `Plan ${a.plan.name}` : `Asignada el ${formatDateLong(a.createdAt)}`}
                    </div>
                    {a.plan && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                        <span className="font-semibold">
                          Visita {a.plan.seq} de {a.plan.quota}
                        </span>
                        <span style={{ color: "rgba(60,60,67,0.6)" }}>· {a.plan.windowLabel}</span>
                        {a.plan.overdue && (
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#FFE5E3", color: "#C0271D" }}>
                            atrasada
                          </span>
                        )}
                      </div>
                    )}
                    {a.plan?.notes && (
                      <div className="mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px]" style={{ background: "#FFF9E5", color: "rgba(60,60,67,0.8)" }}>
                        <strong>Indicaciones:</strong> {a.plan.notes}
                      </div>
                    )}
                    {!a.plan && a.note && (
                      <div className="mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px]" style={{ background: "#F2F2F7", color: "rgba(60,60,67,0.7)" }}>
                        {a.note}
                      </div>
                    )}
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" className="mt-0.5 flex-shrink-0">
                    <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pool.length > 0 && (
          <section className="mt-7">
            <h2 className="text-[15px] font-bold">Disponibles para ti</h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Visitas gratis que nadie ha hecho a tiempo. Toma una antes de que venza y haz la visita.
            </p>
            <div className="mt-3 space-y-2.5">
              {pool.map((p) => (
                <div key={p.requestId} className="card p-4">
                  <div className="truncate text-[15.5px] font-bold">{p.clientName}</div>
                  <div className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                    {TYPE_LABEL[p.clientType] ?? "Negocio"}
                    {p.city ? ` · ${p.city}` : ""} · vence el {formatDateLong(p.expiresAt)}
                  </div>
                  <TomarSolicitudButton requestId={p.requestId} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
