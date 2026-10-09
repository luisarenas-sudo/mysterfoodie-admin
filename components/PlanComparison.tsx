import { PLAN_CATALOG, PLAN_KEYS, PLAN_ZONE_LABEL, sucursalesRangeLabel, type PlanCatalogEntry } from "@/lib/planCatalog";
import { TOTAL_ITEM_COUNT } from "@/lib/categories";
import { formatMxn } from "@/lib/earningsMatrix";

const MUTED = "rgba(60,60,67,0.6)";
const STARTER = PLAN_CATALOG.starter;

const mx = (n: number) => `$${n.toLocaleString("es-MX")}`;
const range = (a: number, b: number, fmt: (n: number) => string = String) => (a === b ? fmt(a) : `${fmt(a)} a ${fmt(b)}`);

/**
 * Margen de error relativo (estimado): con visitas independientes, el error
 * del promedio baja con la raíz del número de visitas (1/√n). Starter (3
 * visitas en una sucursal) es la base: 0 % de mejora.
 */
function errorReduction(visits: number): number {
  return Math.round((1 - Math.sqrt(STARTER.visitsPerMonth / visits)) * 100);
}
const reductionLabel = (pct: number) => (pct <= 0 ? "Base" : `−${pct}%`);

type Row = { label: string; hint?: string; cells: (p: PlanCatalogEntry) => string; strong?: boolean };

const ROWS: Row[] = [
  { label: "Sucursales", cells: (p) => sucursalesRangeLabel(p) },
  { label: "Visitas por sucursal / mes", cells: (p) => String(p.visitsPerMonth) },
  { label: "Visitas totales / mes", cells: (p) => range(p.visitsPerMonth * p.sucursalesMin, p.visitsPerMonth * p.sucursalesMax) },
  { label: "Cadencia", cells: (p) => (p.visitsPerMonth >= 4 ? "1 por semana" : "1 cada ~10 días") },
  { label: "Tarifa por visita", cells: (p) => mx(p.pricePerVisit), strong: true },
  {
    label: "Ahorro por volumen",
    hint: "vs. la tarifa Starter",
    cells: (p) => (p.pricePerVisit >= STARTER.pricePerVisit ? "—" : `−${Math.round((1 - p.pricePerVisit / STARTER.pricePerVisit) * 100)}% por visita`),
  },
  { label: "Mensual por sucursal", cells: (p) => mx(p.visitsPerMonth * p.pricePerVisit) },
  {
    label: "Mensual total",
    cells: (p) => range(p.visitsPerMonth * p.pricePerVisit * p.sucursalesMin, p.visitsPerMonth * p.pricePerVisit * p.sucursalesMax, mx),
    strong: true,
  },
  {
    label: "Ahorro mensual",
    hint: "contra pagar las mismas visitas a $700",
    cells: (p) => {
      const per = (STARTER.pricePerVisit - p.pricePerVisit) * p.visitsPerMonth;
      return per <= 0 ? "—" : range(per * p.sucursalesMin, per * p.sucursalesMax, mx);
    },
  },
  {
    label: "Consistencia de la información",
    cells: (p) =>
      p.sucursalesMax === 1
        ? "Se compara contra su propio historial mes con mes"
        : `Mismo protocolo de ${TOTAL_ITEM_COUNT} indicadores en ${sucursalesRangeLabel(p)} sucursales: comparables entre sí`,
  },
  {
    label: "Margen de error por sucursal",
    hint: "menor es mejor",
    cells: (p) => reductionLabel(errorReduction(p.visitsPerMonth)),
  },
  {
    label: "Margen de error de la marca",
    hint: "promedio de todas las sucursales",
    cells: (p) => {
      const lo = errorReduction(p.visitsPerMonth * p.sucursalesMin);
      const hi = errorReduction(p.visitsPerMonth * p.sucursalesMax);
      return lo === hi ? reductionLabel(lo) : `${reductionLabel(lo)} a ${reductionLabel(hi)}`;
    },
    strong: true,
  },
  { label: "Zona", cells: (p) => (p.zoneRestricted ? PLAN_ZONE_LABEL : "Sin restricción") },
];

/** Comparativa de los planes: precio y volumen, consistencia de la información y margen de error. */
export default function PlanComparison() {
  const plans = PLAN_KEYS.map((k) => PLAN_CATALOG[k]);
  const cols = `minmax(0,1.25fr) repeat(${plans.length}, minmax(0,1fr))`;

  return (
    <section id="comparativa" className="mt-8 scroll-mt-20">
      <div className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Comparativa de planes
      </div>
      <div className="card overflow-hidden">
        <div className="grid items-end gap-x-2 px-3 py-3" style={{ gridTemplateColumns: cols, background: "#F2F2F7" }}>
          <div />
          {plans.map((p) => (
            <div key={p.key} className="text-center">
              <div className="text-[14px] font-bold leading-tight">{p.name}</div>
              <div className="text-[11px] leading-tight" style={{ color: MUTED }}>
                {formatMxn(p.pricePerVisit)}/visita
              </div>
            </div>
          ))}
        </div>
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="grid gap-x-2 px-3 py-2.5"
            style={{ gridTemplateColumns: cols, borderTop: "1px solid rgba(60,60,67,0.08)" }}
          >
            <div className="text-[12px] font-semibold leading-snug">
              {row.label}
              {row.hint && (
                <div className="font-normal" style={{ color: MUTED }}>
                  {row.hint}
                </div>
              )}
            </div>
            {plans.map((p) => (
              <div key={p.key} className={`text-center text-[12px] leading-snug ${row.strong ? "font-bold" : ""}`}>
                {row.cells(p)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 px-1 text-[12px] leading-relaxed" style={{ color: MUTED }}>
        El margen de error es una estimación: con visitas independientes, el error del promedio baja con la raíz del número de visitas
        (1/√n), tomando como base Starter (3 visitas en una sucursal). Más visitas por semana y en más sucursales distinguen un mal día de
        un patrón. El reembolso del ticket de consumo se suma aparte en todos los planes.
      </p>
    </section>
  );
}
