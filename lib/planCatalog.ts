/**
 * Catálogo de planes de visitas. Módulo SIN dependencias de servidor para
 * poder usarlo tanto en pantallas (cliente) como en el cálculo real.
 *
 * Regla de costos: tarifa por visita que baja con el volumen
 * (Starter $700, Appetizer $650, Main course $600). Como el reparto de
 * ganancias es proporcional a la tarifa, ver lib/earningsMatrix.ts.
 */

export type PlanCatalogEntry = {
  key: string;
  name: string;
  /** En lenguaje de cocina. */
  tagline: string;
  /** Mínimo y máximo de sucursales que cubre una contratación. */
  sucursalesMin: number;
  sucursalesMax: number;
  /** Visitas al mes POR SUCURSAL (1 a 4; 4 es el máximo). */
  visitsPerMonth: number;
  /** Tarifa por visita en MXN. */
  pricePerVisit: number;
  /** Solo se ofrece dentro de Veracruz - Boca del Río. */
  zoneRestricted: boolean;
  includes: string[];
};

export const PLAN_CATALOG = {
  starter: {
    key: "starter",
    name: "Starter",
    tagline: "Entrada",
    sucursalesMin: 1,
    sucursalesMax: 1,
    visitsPerMonth: 3,
    pricePerVisit: 700,
    zoneRestricted: false,
    includes: [
      "Visitas Mystery Shopper anónimas, hechas por un Foodie",
      "Reporte completo (PDF) de cada visita, sin costo extra",
      "Avance mes con mes de tu calificación",
      "Seguimiento personalizado del equipo MysterFoodie",
    ],
  },
  appetizer: {
    key: "appetizer",
    name: "Appetizer",
    tagline: "Aperitivo para 3 sucursales",
    sucursalesMin: 3,
    sucursalesMax: 3,
    visitsPerMonth: 4,
    pricePerVisit: 650,
    zoneRestricted: true,
    includes: [
      "4 visitas al mes en cada una de tus 3 sucursales (una por semana)",
      "Reporte completo (PDF) de cada visita, sin costo extra",
      "Mismo protocolo en las 3 sucursales: resultados comparables entre sí",
      "Tarifa por volumen: $650 por visita",
      "Seguimiento personalizado del equipo MysterFoodie",
    ],
  },
  main_course: {
    key: "main_course",
    name: "Main course",
    tagline: "Plato fuerte para 4 a 5 sucursales",
    sucursalesMin: 4,
    sucursalesMax: 5,
    visitsPerMonth: 4,
    pricePerVisit: 600,
    zoneRestricted: true,
    includes: [
      "4 visitas al mes en cada una de tus sucursales, hasta 5 (una por semana)",
      "Reporte completo (PDF) de cada visita, sin costo extra",
      "Mismo protocolo en todas las sucursales: resultados comparables entre sí",
      "Tarifa por volumen: $600 por visita",
      "Seguimiento personalizado del equipo MysterFoodie",
    ],
  },
} satisfies Record<string, PlanCatalogEntry>;

export type PlanKey = keyof typeof PLAN_CATALOG;

export const PLAN_KEYS = Object.keys(PLAN_CATALOG) as PlanKey[];

export function isPlanKey(k: unknown): k is PlanKey {
  return typeof k === "string" && k in PLAN_CATALOG;
}

/** ¿La ciudad cae dentro de Veracruz - Boca del Río? (sin acentos ni mayúsculas) */
export function isInPlanZone(city: string | null | undefined): boolean {
  if (!city) return false;
  const c = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return c.includes("veracruz") || c.includes("boca del rio") || c.includes("boca");
}

export const PLAN_ZONE_LABEL = "Veracruz – Boca del Río";

/** Texto del rango de sucursales: "1", "3", "4 a 5". */
export function sucursalesRangeLabel(p: PlanCatalogEntry): string {
  return p.sucursalesMin === p.sucursalesMax ? String(p.sucursalesMin) : `${p.sucursalesMin} a ${p.sucursalesMax}`;
}
