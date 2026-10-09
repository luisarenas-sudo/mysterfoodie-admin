import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPlansOverview } from "@/lib/plans";
import { formatMxn } from "@/lib/earningsMatrix";
import BackLink from "@/components/BackLink";
import PlanComparison from "@/components/PlanComparison";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";

export const dynamic = "force-dynamic";

const MUTED = "rgba(60,60,67,0.6)";

/**
 * Planes de visitas contratados (segunda etapa), solo Master Chef: el avance
 * del mes de todas las sucursales de un vistazo. Abrir esta pantalla también
 * genera las visitas del mes que falten (respaldo del cron).
 */
export default async function PlanesPage() {
  await requireRole("admin");
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;
  const { monthLabel, rows } = await getPlansOverview(baseUrl);

  const active = rows.filter((r) => r.status === "activo");
  const expected = active.reduce((a, r) => a + r.amount, 0);
  const collected = active.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0);
  const visitsDone = active.reduce((a, r) => a + r.done, 0);
  const visitsTotal = active.reduce((a, r) => a + r.quota, 0);

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <main className="mx-auto max-w-3xl px-5 pb-8 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/perfil" label="Perfil" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Planes</h1>
        <p className="mt-1 text-sm text-stone-500">Visitas mensuales contratadas por sucursal · {monthLabel}</p>

        {rows.length === 0 ? (
          <div className="card mt-5 p-5 text-[14px]" style={{ color: MUTED }}>
            Todavía no hay planes. Para contratar uno, abre un negocio y toca <strong>Contratar</strong> en su tarjeta de Plan de visitas.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Planes activos</div>
                <div className="mt-1 text-[22px] font-bold">{active.length}</div>
                <div className="text-[12px]" style={{ color: MUTED }}>{visitsDone} de {visitsTotal} visitas del mes</div>
              </div>
              <div className="card p-4">
                <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Cobrado del mes</div>
                <div className="mt-1 text-[22px] font-bold">{formatMxn(collected)}</div>
                <div className="text-[12px]" style={{ color: MUTED }}>de {formatMxn(expected)} esperados</div>
              </div>
            </div>

            <div className="card mt-5 overflow-hidden">
              {rows.map((r, idx) => (
                <Link
                  key={r.id}
                  href={`/negocios/${r.clientId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{r.clientName}</div>
                    <div className="text-[12px]" style={{ color: MUTED }}>
                      Plan {r.planName}
                      {r.groupSize > 1 ? ` (${r.groupSize} sucursales)` : ""} · {r.done} de {r.quota} visitas
                      {r.status === "pausado" ? " · en pausa" : ""}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={r.paid ? { background: "#E8F8EC", color: "#248A3D" } : { background: "#FFF3D6", color: "#946200" }}
                    >
                      {r.paid ? "Cobrado" : "Por cobrar"}
                    </span>
                    {r.unassigned > 0 && r.status === "activo" && (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "#FFE5E3", color: "#C0271D" }}>
                        {r.unassigned} sin Foodie
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <PlanComparison />
      </main>
    </>
  );
}
