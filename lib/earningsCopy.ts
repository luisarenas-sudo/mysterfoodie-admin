import { scenarioByKey, formatMxn } from "./earningsMatrix";

/**
 * Textos de "cuánto podrías ganar" para sibaritas cuando se les asigna u ofrece una visita.
 * Las cifras salen de la matriz de reparto (lib/earningsMatrix.ts), así que si cambia el reparto cambian aquí solas.
 * Master Chef vende y asigna al sibarita: si él mismo visita (Acción 3 variante) gana $550; si asigna a un Shopper
 * (Acción 3) gana $150 y el Shopper $400.
 */
export type EmailCallout = { title: string; lines: string[] };

const own = () => scenarioByKey("3b").sibarita;
const delegated = () => scenarioByKey("3a").sibarita;
const shopper = () => scenarioByKey("3a").foodie;

export function sibaritaEarningsCallout(kind: "gratis" | "programada"): EmailCallout {
  return {
    title: "💰 Lo que podrías ganar con esta visita",
    lines: [
      kind === "programada"
        ? "Esta visita la contrató el negocio ($850 MXN + consumo)."
        : "Esta visita es gratis para el negocio; tu ganancia llega cuando él contrata su reporte completo ($850 MXN).",
      `Si la haces tú: ${formatMxn(own())} para ti.`,
      `Si la asignas a un Shopper: ${formatMxn(delegated())} para ti (el Shopper gana ${formatMxn(shopper())}).`,
      "Si el negocio contrata un plan mensual, esa ganancia se repite en cada visita, mes con mes.",
    ],
  };
}

/** Versión corta para pantallas (tarjetas de "Visitas gratis disponibles", Pendientes). */
export function sibaritaEarningsShort(): string {
  return `Si el negocio contrata su reporte: ganas hasta ${formatMxn(own())} si la haces tú, o ${formatMxn(delegated())} si la asignas a un Shopper.`;
}
