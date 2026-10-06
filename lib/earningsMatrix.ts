/**
 * Matriz de reparto del precio del reporte ($850 MXN) según quién vendió
 * y quién hizo la visita. Archivo sin dependencias de servidor para poder
 * usarlo tanto en la calculadora (cliente) como en el cálculo real.
 * Las 6 filas siempre suman $850 por reporte vendido.
 */

export const PRICE_MXN = 850;

export type ScenarioKey = "1" | "2" | "3a" | "3b" | "4" | "5";

export type Scenario = {
  key: ScenarioKey;
  label: string;
  short: string;
  admin: number;
  sibarita: number;
  foodie: number;
};

export const SCENARIOS: Scenario[] = [
  { key: "1", label: "Acción 1 — Admin vende y Admin visita", short: "Admin vende y visita", admin: 850, sibarita: 0, foodie: 0 },
  { key: "2", label: "Acción 2 — Admin vende y asigna directo a un Foodie", short: "Admin vende, Foodie visita", admin: 450, sibarita: 0, foodie: 400 },
  {
    key: "3a",
    label: "Acción 3 — Admin vende y asigna a un Sibarita, que asigna a un Foodie",
    short: "Admin vende, Sibarita gestiona, Foodie visita",
    admin: 300,
    sibarita: 150,
    foodie: 400,
  },
  {
    key: "3b",
    label: "Acción 3 (variante) — Admin vende y asigna a un Sibarita, que visita él mismo",
    short: "Admin vende, el mismo Sibarita visita",
    admin: 300,
    sibarita: 550,
    foodie: 0,
  },
  { key: "4", label: "Acción 4 — Sibarita vende y el mismo Sibarita visita", short: "Sibarita vende y visita", admin: 150, sibarita: 700, foodie: 0 },
  { key: "5", label: "Acción 5 — Sibarita vende y asigna la visita a un Foodie", short: "Sibarita vende, Foodie visita", admin: 150, sibarita: 300, foodie: 400 },
];

export function scenarioByKey(key: ScenarioKey): Scenario {
  return SCENARIOS.find((s) => s.key === key) as Scenario;
}

export function formatMxn(n: number): string {
  return `$${n.toLocaleString("es-MX")} MXN`;
}
