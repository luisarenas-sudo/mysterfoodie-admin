import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/brand";
import {
  currentMonthCdmx,
  getMonthEarnings,
  isValidMonth,
  monthLabel,
  shiftMonth,
  type PaidVisit,
  type ProfileLite,
  type UnpaidPlanVisits,
} from "@/lib/earnings";
import { formatMxn, scenarioByKey } from "@/lib/earningsMatrix";
import FinanzasCalculator from "@/components/admin/FinanzasCalculator";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";

export const dynamic = "force-dynamic";

const MUTED = "rgba(60,60,67,0.6)";

function formatSoldAt(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="card p-4" style={tone === "warn" ? { background: "#FFF7E6" } : undefined}>
      <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] font-bold leading-tight">{value}</div>
      {hint && (
        <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** "Reporte" o "Visita de plan Starter", para los renglones de ventas. */
function kindLabel(v: PaidVisit): string {
  return v.kind === "plan" ? `Visita de plan ${v.planName ?? ""}`.trim() : "Reporte";
}

function MonthNav({ month }: { month: string }) {
  const isCurrent = month >= currentMonthCdmx();
  return (
    <div className="mt-4 flex items-center justify-between rounded-[14px] bg-white px-2 py-1.5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <Link href={`/finanzas?mes=${shiftMonth(month, -1)}`} className="px-3 py-1.5 text-[20px] font-semibold text-brand-500" aria-label="Mes anterior">
        ‹
      </Link>
      <div className="text-[15px] font-bold">{monthLabel(month)}</div>
      {isCurrent ? (
        <span className="px-3 py-1.5 text-[20px] font-semibold" style={{ color: "rgba(60,60,67,0.2)" }}>
          ›
        </span>
      ) : (
        <Link href={`/finanzas?mes=${shiftMonth(month, 1)}`} className="px-3 py-1.5 text-[20px] font-semibold text-brand-500" aria-label="Mes siguiente">
          ›
        </Link>
      )}
    </div>
  );
}

/** Vista de un Sibarita o un Foodie: solo sus ventas del mes y su ganancia. */
function PersonalView({ role, userId, visits }: { role: "sibarita" | "agente"; userId: string; visits: PaidVisit[] }) {
  const mine = visits.filter((v) => (role === "sibarita" ? v.sibaritaId === userId : v.foodieId === userId));
  const share = (v: PaidVisit) => (role === "sibarita" ? v.sibarita : v.foodie);
  const total = mine.reduce((acc, v) => acc + share(v), 0);
  const bruto = mine.reduce((acc, v) => acc + v.price, 0);
  const appCommission = mine.reduce((acc, v) => acc + (role === "sibarita" ? v.admin : v.price - v.foodie), 0);
  const foodiePay = role === "sibarita" ? mine.reduce((acc, v) => acc + v.foodie, 0) : 0;
  const commissionLabel = role === "sibarita" ? "Comisión por uso de la aplicación" : "Comisión por uso de la aplicación y gestión";

  return (
    <>
      <div className="card mt-4 p-5 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
          Tu ganancia del mes
        </div>
        <div className="mt-1 text-[34px] font-bold leading-tight text-brand-500">{formatMxn(total)}</div>
        <div className="mt-0.5 text-[13px]" style={{ color: MUTED }}>
          {mine.length} {mine.length === 1 ? "venta" : "ventas"} (reportes y visitas de plan)
        </div>
      </div>

      {mine.length > 0 && (
        <div className="card mt-4 p-5">
          <div className="mb-3 text-[15px] font-bold">Resumen del mes</div>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between">
              <span>Ventas ({mine.length})</span>
              <span className="font-semibold">{formatMxn(bruto)}</span>
            </div>
            <div className="flex justify-between" style={{ color: MUTED }}>
              <span>− {commissionLabel}</span>
              <span>−{formatMxn(appCommission)}</span>
            </div>
            {role === "sibarita" && foodiePay > 0 && (
              <div className="flex justify-between" style={{ color: MUTED }}>
                <span>− Pago a Foodies por sus visitas</span>
                <span>−{formatMxn(foodiePay)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-[15px] font-bold">
              <span>Tu ganancia</span>
              <span>{formatMxn(total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Ventas del mes
      </div>
      {mine.length === 0 ? (
        <p className="px-1 text-[14px]" style={{ color: MUTED }}>
          Todavía no hay ventas en este mes.
        </p>
      ) : (
        <div className="card overflow-hidden">
          {mine.map((v, idx) => {
            const commission = role === "sibarita" ? v.admin : v.price - v.foodie;
            return (
              <div key={v.formId} className="px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{v.negocio}</div>
                    <div className="text-[12px]" style={{ color: MUTED }}>
                      {formatSoldAt(v.soldAt)}
                    </div>
                  </div>
                  <div className="text-[15px] font-bold">{formatMxn(share(v))}</div>
                </div>
                <div className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  {kindLabel(v)} {formatMxn(v.price)} · {commissionLabel} −{formatMxn(commission)}
                  {role === "sibarita" && v.foodie > 0 ? ` · Pago al Foodie −${formatMxn(v.foodie)}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed" style={{ color: MUTED }}>
        Una venta cuenta cuando el negocio paga y se le entrega el reporte completo (PDF); el mes se toma de esa fecha.
        En los planes mensuales cuenta cada visita entregada, todos los meses, una vez cobrado el mes del plan. El reembolso
        del ticket de consumo no es ganancia: se paga aparte al Foodie. La comisión por uso de la aplicación cubre la
        plataforma, la gestión de reportes y el cobro.
      </p>
    </>
  );
}

/** Vista del Master Chef: todo el mes, desglose por perfil y sus propias ventas. */
function AdminView({
  visits,
  profiles,
  unpaidPlan,
}: {
  visits: PaidVisit[];
  profiles: Map<string, ProfileLite>;
  unpaidPlan: UnpaidPlanVisits;
}) {
  const bruto = visits.reduce((a, v) => a + v.price, 0);
  const adminTotal = visits.reduce((a, v) => a + v.admin, 0);
  const sibTotal = visits.reduce((a, v) => a + v.sibarita, 0);
  const foodieTotal = visits.reduce((a, v) => a + v.foodie, 0);
  const unclassified = visits.filter((v) => v.scenario === null);

  const byProfile = new Map<string, { profile: ProfileLite; ventas: number; ganancia: number }>();
  const add = (id: string | null, amount: number) => {
    if (!id) return;
    const profile = profiles.get(id);
    if (!profile) return;
    const row = byProfile.get(id) ?? { profile, ventas: 0, ganancia: 0 };
    row.ventas += 1;
    row.ganancia += amount;
    byProfile.set(id, row);
  };
  visits.forEach((v) => {
    add(v.sibaritaId, v.sibarita);
    add(v.foodieId, v.foodie);
  });
  const rows = [...byProfile.values()].sort((a, b) => b.ganancia - a.ganancia);
  const mine = visits.filter((v) => v.admin > 0);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Ventas del mes" value={String(visits.length)} hint={`${formatMxn(bruto)} brutos`} />
        <StatCard label="Mi parte" value={formatMxn(adminTotal)} hint={ROLE_LABELS.admin} />
        <StatCard label="Sibaritas" value={formatMxn(sibTotal)} />
        <StatCard label="Foodies" value={formatMxn(foodieTotal)} />
      </div>
      {unpaidPlan.count > 0 && (
        <div className="mt-3">
          <StatCard
            tone="warn"
            label="Por cobrar (planes)"
            value={formatMxn(unpaidPlan.amount)}
            hint={`${unpaidPlan.count} ${unpaidPlan.count === 1 ? "visita hecha" : "visitas hechas"} de planes cuyo mes aún no marcas como cobrado. No se reparte ganancia hasta cobrar.`}
          />
        </div>
      )}
      {unclassified.length > 0 && (
        <div className="mt-3">
          <StatCard
            tone="warn"
            label="Sin clasificar"
            value={`${unclassified.length} ${unclassified.length === 1 ? "venta" : "ventas"}`}
            hint="No encajan en ninguna acción del reparto (revisa quién vendió y quién visitó). No se les asignó ganancia."
          />
        </div>
      )}

      <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Desglose por perfil
      </div>
      {rows.length === 0 ? (
        <p className="px-1 text-[14px]" style={{ color: MUTED }}>
          Ningún Sibarita ni Foodie tiene ventas este mes.
        </p>
      ) : (
        <div className="card overflow-hidden">
          {rows.map((r, idx) => (
            <div
              key={r.profile.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}
            >
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{r.profile.name}</div>
                <div className="text-[12px]" style={{ color: MUTED }}>
                  {ROLE_LABELS[r.profile.role] ?? r.profile.role} · {r.ventas} {r.ventas === 1 ? "venta" : "ventas"}
                </div>
              </div>
              <div className="text-[15px] font-bold">{formatMxn(r.ganancia)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Mis ventas ({ROLE_LABELS.admin})
      </div>
      {mine.length === 0 ? (
        <p className="px-1 text-[14px]" style={{ color: MUTED }}>
          Todavía no hay ventas este mes.
        </p>
      ) : (
        <div className="card overflow-hidden">
          {mine.map((v, idx) => (
            <div key={v.formId} className="px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{v.negocio}</div>
                  <div className="text-[12px]" style={{ color: MUTED }}>
                    {formatSoldAt(v.soldAt)} · {kindLabel(v)} · {v.scenario ? scenarioByKey(v.scenario).short : ""}
                  </div>
                </div>
                <div className="text-[15px] font-bold">{formatMxn(v.admin)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {unclassified.length > 0 && (
        <>
          <div className="mb-1.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Ventas sin clasificar
          </div>
          <div className="card overflow-hidden">
            {unclassified.map((v, idx) => (
              <div key={v.formId} className="px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
                <div className="truncate text-[15px] font-semibold">{v.negocio}</div>
                <div className="text-[12px]" style={{ color: MUTED }}>
                  {formatSoldAt(v.soldAt)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed" style={{ color: MUTED }}>
        Una venta cuenta cuando el negocio paga y se le entrega el reporte completo (PDF); el mes se toma de esa fecha. En los planes
        mensuales cada visita entregada es una venta (mismo reparto, proporcional a la tarifa por visita), cada mes, una vez que marcas
        el mes del plan como cobrado. Quien visita es quien guardó la visita; quien vende, quien dio de alta el negocio.
      </p>

      <details className="card mt-6 p-4">
        <summary className="cursor-pointer text-[15px] font-bold">Simulador de reparto</summary>
        <div className="mt-4">
          <FinanzasCalculator />
        </div>
      </details>
    </>
  );
}

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const profile = await requireRole("admin", "sibarita", "agente");
  const { mes } = await searchParams;
  const month = isValidMonth(mes) && mes <= currentMonthCdmx() ? mes : currentMonthCdmx();
  const { visits, profiles, unpaidPlan } = await getMonthEarnings(month);

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <main className="mx-auto max-w-3xl px-5 pb-8 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/perfil" label="Perfil" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Finanzas</h1>
        <p className="mt-1 text-sm text-stone-500">
          {profile.role === "admin"
            ? "Ventas y reparto de ganancias de todos los perfiles, por mes."
            : "Tu cálculo de ganancias por mes, según los reportes que se han vendido."}
        </p>

        <MonthNav month={month} />

        {profile.role === "admin" ? (
          <AdminView visits={visits} profiles={profiles} unpaidPlan={unpaidPlan} />
        ) : (
          <PersonalView role={profile.role as "sibarita" | "agente"} userId={profile.userId} visits={visits} />
        )}
      </main>
    </>
  );
}
