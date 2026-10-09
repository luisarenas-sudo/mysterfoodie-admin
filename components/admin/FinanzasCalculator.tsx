"use client";

import { useMemo, useState } from "react";
import { PRICE_MXN, SCENARIOS, splitForPrice, type ScenarioKey } from "@/lib/earningsMatrix";
import { PLAN_CATALOG, PLAN_KEYS } from "@/lib/planCatalog";

/** Precios que se pueden simular: el reporte suelto y la tarifa por visita de cada plan. */
const PRICE_OPTIONS: { value: string; label: string; price: number }[] = [
  { value: "report", label: `Reporte suelto · ${PRICE_MXN}`, price: PRICE_MXN },
  ...PLAN_KEYS.map((k) => ({
    value: k,
    label: `Plan ${PLAN_CATALOG[k].name} · ${PLAN_CATALOG[k].pricePerVisit} por visita`,
    price: PLAN_CATALOG[k].pricePerVisit,
  })),
];

const ROLE_LABEL = { admin: "Master Chef (Admin)", sibarita: "Sibarita", foodie: "Foodie" } as const;

function mxn(n: number) {
  return `$${n.toLocaleString("es-MX")} MXN`;
}

/**
 * Calculadora de reparto de ingresos por visita, solo para Admin (ver
 * /finanzas). No lee datos reales de la base -- es una
 * simulación: Luis escribe cuántas visitas hubo en cada acción/
 * escenario y aquí se desglosa cuánto le toca a cada perfil, según la
 * matriz de tarifas exactas que dio. $850 MXN es el precio único del
 * reporte; las 6 filas (1, 2, 3a, 3b, 4, 5) siempre suman $850 por
 * visita, sin excepción.
 */
export default function FinanzasCalculator() {
  const [priceKey, setPriceKey] = useState("report");
  const price = PRICE_OPTIONS.find((o) => o.value === priceKey)?.price ?? PRICE_MXN;
  const [counts, setCounts] = useState<Record<ScenarioKey, string>>({
    "1": "",
    "2": "",
    "3a": "",
    "3b": "",
    "4": "",
    "5": "",
  });

  function setCount(key: ScenarioKey, value: string) {
    setCounts((prev) => ({ ...prev, [key]: value }));
  }

  const rows = useMemo(() => {
    return SCENARIOS.map((s) => {
      const n = Math.max(0, parseInt(counts[s.key], 10) || 0);
      const sp = splitForPrice(s, price);
      return {
        scenario: s,
        n,
        admin: sp.admin * n,
        sibarita: sp.sibarita * n,
        foodie: sp.foodie * n,
        total: price * n,
      };
    });
  }, [counts, price]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        visitas: acc.visitas + r.n,
        admin: acc.admin + r.admin,
        sibarita: acc.sibarita + r.sibarita,
        foodie: acc.foodie + r.foodie,
        bruto: acc.bruto + r.total,
      }),
      { visitas: 0, admin: 0, sibarita: 0, foodie: 0, bruto: 0 }
    );
  }, [rows]);

  // --- Ganancia de un perfil individual ---
  const [indRole, setIndRole] = useState<"admin" | "sibarita" | "foodie">("foodie");
  const [indScenario, setIndScenario] = useState<ScenarioKey>("2");
  const [indCount, setIndCount] = useState("10");

  const applicableScenarios = SCENARIOS.filter((s) => s[indRole] > 0);
  const chosenScenario = SCENARIOS.find((s) => s.key === indScenario) || applicableScenarios[0];
  const indN = Math.max(0, parseInt(indCount, 10) || 0);
  const indRate = chosenScenario ? splitForPrice(chosenScenario, price)[indRole] : 0;
  const indTotal = indRate * indN;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-ink">1. Simulación por volumen de visitas</h2>
        <p className="mt-1 text-sm text-stone-500">
          Escribe cuántas visitas hubo en cada acción/escenario. Cada fila reparte el precio de la
          visita distinto según quién vendió y quién visitó; en los planes se mantiene la misma
          proporción que en el reporte.
        </p>
        <label className="mt-3 block max-w-sm">
          <span className="text-xs font-medium text-stone-500">Precio por visita a simular</span>
          <select value={priceKey} onChange={(e) => setPriceKey(e.target.value)} className="input mt-1 w-full text-sm">
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-3 py-2 font-medium">Escenario</th>
                <th className="w-24 px-3 py-2 font-medium">Visitas</th>
                <th className="px-3 py-2 text-right font-medium">Admin</th>
                <th className="px-3 py-2 text-right font-medium">Sibarita</th>
                <th className="px-3 py-2 text-right font-medium">Foodie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.scenario.key} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{r.scenario.short}</div>
                    <div className="text-xs text-stone-400">{r.scenario.label}</div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={counts[r.scenario.key]}
                      onChange={(e) => setCount(r.scenario.key, e.target.value)}
                      placeholder="0"
                      className="input w-20 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">{mxn(r.admin)}</td>
                  <td className="px-3 py-2 text-right">{mxn(r.sibarita)}</td>
                  <td className="px-3 py-2 text-right">{mxn(r.foodie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-ink">2. Desglose de ganancia neta</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-stone-500">Ingreso bruto</div>
            <div className="mt-1 text-xl font-bold text-ink">{mxn(totals.bruto)}</div>
            <div className="mt-0.5 text-xs text-stone-400">{totals.visitas} reportes pagados</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-stone-500">Master Chef</div>
            <div className="mt-1 text-xl font-bold text-brand-500">{mxn(totals.admin)}</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {totals.bruto > 0 ? Math.round((totals.admin / totals.bruto) * 100) : 0}% del bruto
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-stone-500">Sibaritas</div>
            <div className="mt-1 text-xl font-bold text-ink">{mxn(totals.sibarita)}</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {totals.bruto > 0 ? Math.round((totals.sibarita / totals.bruto) * 100) : 0}% del bruto
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-stone-500">Foodies</div>
            <div className="mt-1 text-xl font-bold text-ink">{mxn(totals.foodie)}</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {totals.bruto > 0 ? Math.round((totals.foodie / totals.bruto) * 100) : 0}% del bruto
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-ink">3. Ganancia de un perfil individual</h2>
        <p className="mt-1 text-sm text-stone-500">
          Por ejemplo: cuánto gana 1 Foodie que hace 10 visitas asignadas, o 1 Sibarita por 5 ventas
          que él mismo visita.
        </p>
        <div className="mt-3 card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-stone-500">Perfil</span>
              <select
                value={indRole}
                onChange={(e) => {
                  const role = e.target.value as "admin" | "sibarita" | "foodie";
                  setIndRole(role);
                  const first = SCENARIOS.find((s) => s[role] > 0);
                  if (first) setIndScenario(first.key);
                }}
                className="input mt-1 w-full text-sm"
              >
                <option value="admin">{ROLE_LABEL.admin}</option>
                <option value="sibarita">{ROLE_LABEL.sibarita}</option>
                <option value="foodie">{ROLE_LABEL.foodie}</option>
              </select>
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs font-medium text-stone-500">Escenario</span>
              <select
                value={indScenario}
                onChange={(e) => setIndScenario(e.target.value as ScenarioKey)}
                className="input mt-1 w-full text-sm"
              >
                {applicableScenarios.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-500">
                Número de {indRole === "sibarita" ? "ventas/visitas" : "visitas"}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={indCount}
                onChange={(e) => setIndCount(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </label>
          </div>

          <div className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-ink">
            A {mxn(indRate)} por visita en ese escenario, <strong>{indN}</strong> visita
            {indN === 1 ? "" : "s"} le dan a 1 {ROLE_LABEL[indRole]} un total de{" "}
            <strong>{mxn(indTotal)}</strong>.
          </div>
        </div>
      </div>

      <div className="rounded-md border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500">
        Esta calculadora es una simulación manual (tú escribes los números); no lee las visitas
        reales de la base de datos todavía.
      </div>
    </div>
  );
}
