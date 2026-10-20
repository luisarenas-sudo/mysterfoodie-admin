import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPlansOverview } from "@/lib/plans";
import { getMonthEarnings, type PaidVisit } from "@/lib/earnings";
import { SCENARIOS, formatMxn, splitForPrice } from "@/lib/earningsMatrix";
import { PLAN_CATALOG } from "@/lib/planCatalog";
import { whyShare, type EarnRole } from "@/lib/earningsWhy";
import { currentMonthCdmx, monthLabel } from "@/lib/months";
import { PACKAGES_URL } from "@/lib/links";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";

export const dynamic = "force-dynamic";

const MUTED = "rgba(60,60,67,0.6)";

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" }).format(new Date(iso));
}

/** Lo que le toca a cada perfil de una visita de plan, y por qué. */
function myShare(role: EarnRole, userId: string, v: PaidVisit): number {
  if (!v.scenario) return 0;
  if (role === "admin") return v.admin;
  if (role === "sibarita") return v.sibaritaId === userId ? v.sibarita : 0;
  return v.foodieId === userId ? v.foodie : 0;
}

function VisitRows({ visits, role, userId, pending }: { visits: PaidVisit[]; role: EarnRole; userId: string; pending: boolean }) {
  return (
    <div className="card overflow-hidden">
      {visits.map((v, idx) => (
        <div key={v.formId} className="px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{v.negocio}</div>
              <div className="text-[12px]" style={{ color: MUTED }}>
                {v.planName ? `Plan ${v.planName} · ` : ""}visita del {formatDay(v.soldAt)} · vale {formatMxn(v.price)}
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              <div className="text-[15px] font-bold">{formatMxn(myShare(role, userId, v))}</div>
              <span
                className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={pending ? { background: "#FFF3D6", color: "#946200" } : { background: "#E8F8EC", color: "#248A3D" }}
              >
                {pending ? "Por cobrar" : "Ya cuenta"}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[12.5px] leading-snug" style={{ color: MUTED }}>
            <span className="font-semibold">¿Por qué? </span>
            {whyShare(role, v.scenario)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cuánto le toca a este perfil, de antemano, por una visita de cada plan según cómo participe. */
function ShareGuide({ role }: { role: EarnRole }) {
  const plans = [PLAN_CATALOG.starter, PLAN_CATALOG.appetizer, PLAN_CATALOG.main_course];
  const rows = SCENARIOS.map((s) => ({
    s,
    amounts: plans.map((p) => {
      const sp = splitForPrice(s, p.pricePerVisit);
      return role === "admin" ? sp.admin : role === "sibarita" ? sp.sibarita : sp.foodie;
    }),
    why: whyShare(role, s.key),
  })).filter((r) => r.amounts.some((a) => a > 0));

  return (
    <div className="card mt-4 p-5">
      <div className="text-[15px] font-bold">Así se reparte cada visita de plan</div>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: MUTED }}>
        Cada visita entregada de un plan cuenta como una venta y se reparte según lo que hiciste. Es recurrente: se repite cada mes que el plan siga activo.
      </p>
      <div className="mt-3 space-y-3">
        {rows.map(({ s, amounts, why }) => (
          <div key={s.key} className="rounded-xl p-3" style={{ background: "#F2F2F7" }}>
            <div className="text-[13.5px] font-semibold">{why}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]" style={{ color: MUTED }}>
              {plans.map((p, i) => (
                <span key={p.key}>
                  {p.name} ({formatMxn(p.pricePerVisit)}): <strong style={{ color: "#1C1C1E" }}>{formatMxn(amounts[i])}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed" style={{ color: MUTED }}>
        Lo hecho cuenta como ganancia cuando se marca como cobrado el mes del plan; antes aparece como «Por cobrar». El reembolso del ticket de consumo no es ganancia: se paga aparte al Shopper.
      </p>
    </div>
  );
}

/**
 * Planes de visitas (segunda etapa). Todos los perfiles ven aquí sus visitas de plan del mes,
 * cuánto les toca por cada una y por qué. El Master Chef además ve el avance de todas las sucursales.
 * La comparativa de planes vive solo en la web.
 */
export default async function PlanesPage() {
  const profile = await requireRole("admin", "sibarita", "agente");
  const role = profile.role as EarnRole;
  const month = currentMonthCdmx();
  const isAdmin = role === "admin";

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;
  const [overview, earnings] = await Promise.all([
    isAdmin ? getPlansOverview(baseUrl) : Promise.resolve(null),
    getMonthEarnings(month).catch(() => null),
  ]);

  const paid = (earnings?.visits ?? []).filter((v) => v.kind === "plan" && myShare(role, profile.userId, v) > 0);
  const pending = (earnings?.pendingPlan ?? []).filter((v) => myShare(role, profile.userId, v) > 0);
  const paidTotal = paid.reduce((a, v) => a + myShare(role, profile.userId, v), 0);
  const pendingTotal = pending.reduce((a, v) => a + myShare(role, profile.userId, v), 0);

  const rows = overview?.rows ?? [];
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
        <p className="mt-1 text-sm text-stone-500">
          {isAdmin ? "Visitas mensuales contratadas por sucursal" : "Tus visitas de plan: cuánto ganas y por qué"} · {monthLabel(month)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Ya cuenta</div>
            <div className="mt-1 text-[22px] font-bold text-brand-500">{formatMxn(paidTotal)}</div>
            <div className="text-[12px]" style={{ color: MUTED }}>{paid.length} {paid.length === 1 ? "visita" : "visitas"} de plan cobradas</div>
          </div>
          <div className="card p-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Por cobrar</div>
            <div className="mt-1 text-[22px] font-bold">{formatMxn(pendingTotal)}</div>
            <div className="text-[12px]" style={{ color: MUTED }}>{pending.length} {pending.length === 1 ? "visita hecha" : "visitas hechas"}, mes sin cobrar</div>
          </div>
        </div>

        {paid.length > 0 && (
          <>
            <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Visitas de plan que ya cuentan</div>
            <VisitRows visits={paid} role={role} userId={profile.userId} pending={false} />
          </>
        )}
        {pending.length > 0 && (
          <>
            <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Hechas, por cobrar</div>
            <VisitRows visits={pending} role={role} userId={profile.userId} pending />
          </>
        )}
        {paid.length === 0 && pending.length === 0 && (
          <div className="card mt-5 p-5 text-[14px]" style={{ color: MUTED }}>
            Todavía no tienes visitas de plan este mes. Cuando hagas, vendas o gestiones una, aparece aquí con lo que te toca y por qué.
          </div>
        )}

        <ShareGuide role={role} />

        {isAdmin && (
          <>
            <div className="mb-1.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Todas las sucursales con plan</div>
            {rows.length === 0 ? (
              <div className="card p-5 text-[14px]" style={{ color: MUTED }}>
                Todavía no hay planes. Para contratar uno, abre un negocio y toca <strong>Contratar</strong> en su tarjeta de Plan de visitas.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="card mt-4 overflow-hidden">
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
                            {r.unassigned} sin Shopper
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <p className="mt-6 px-1 text-[12.5px]" style={{ color: MUTED }}>
          ¿Quieres ver los planes como los ve un cliente?{" "}
          <a href={PACKAGES_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-500">
            Compáralos en mysterfoodie.com
          </a>
          .
        </p>
      </main>
    </>
  );
}
