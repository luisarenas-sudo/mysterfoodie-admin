import type { ScenarioKey } from "./earningsMatrix";

export type EarnRole = "admin" | "sibarita" | "agente";

/**
 * Explica en una frase POR QUÉ un perfil gana su parte en una visita, según la
 * acción del reparto (ver lib/earningsMatrix.ts). Módulo sin dependencias de servidor.
 */
export function whyShare(role: EarnRole, scenario: ScenarioKey | null): string {
  if (!scenario) return "Esta visita aún no encaja en ninguna acción del reparto; el Master Chef la clasifica.";
  const t: Record<EarnRole, Record<ScenarioKey, string>> = {
    admin: {
      "1": "Vendiste el negocio y visitaste tú: te toca todo.",
      "2": "Vendiste el negocio y asignaste la visita directo a un Shopper: tu parte es por la venta y la gestión.",
      "3a": "Vendiste el negocio; un Sibarita gestionó la visita y un Shopper la hizo.",
      "3b": "Vendiste el negocio; el Sibarita al que se la asignaste la hizo él mismo.",
      "4": "Un Sibarita vendió y visitó: tu parte es por el uso de la plataforma.",
      "5": "Un Sibarita vendió y un Shopper visitó: tu parte es por el uso de la plataforma.",
    },
    sibarita: {
      "1": "—",
      "2": "—",
      "3a": "Gestionaste: el Master Chef te asignó la visita y tú la asignaste a un Shopper.",
      "3b": "El Master Chef te asignó la visita y la hiciste tú mismo.",
      "4": "Diste de alta el negocio y visitaste tú mismo: vendes y visitas.",
      "5": "Diste de alta el negocio y asignaste la visita a un Shopper: tu parte es por la venta y la gestión.",
    },
    agente: {
      "1": "—",
      "2": "Hiciste la visita que te asignó el Master Chef.",
      "3a": "Hiciste la visita que te asignó un Sibarita.",
      "3b": "—",
      "4": "—",
      "5": "Hiciste la visita que te asignó el Sibarita que dio de alta el negocio.",
    },
  };
  return t[role][scenario];
}
