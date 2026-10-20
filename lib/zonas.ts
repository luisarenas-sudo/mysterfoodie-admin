/**
 * Sector económico de un MysterFoodie según su código postal de residencia.
 * Zona activa = la franja de Veracruz centro–Boca del Río marcada en el mapa (aprox.); el resto = zona desacelerada.
 * CONFIRMADA por Luis (20 oct 2026). EDITABLE: agrega o quita códigos postales de ZONA_ACTIVA_CP según el mapa de Luis. Solo se usa el CP para clasificar;
 * al negocio NUNCA se le muestra el CP, solo el sector.
 */
export const ZONA_ACTIVA_CP: string[] = [
  // Veracruz (centro, malecón, Zona Dorada)
  "91700", "91709", "91910", "91918", "91919", "91940", "91948",
  // Boca del Río (incluye 94297 aunque en el mapa parezca quedar fuera)
  "94290", "94294", "94297", "94298", "94299",
];

export type Sector = "activa" | "desacelerada";

export function isValidPostalCode(cp: string): boolean {
  return /^\d{5}$/.test(cp.trim());
}

export function sectorFromPostalCode(cp: string | null | undefined): Sector | null {
  const v = (cp ?? "").trim();
  if (!isValidPostalCode(v)) return null;
  return ZONA_ACTIVA_CP.includes(v) ? "activa" : "desacelerada";
}

export const SECTOR_LABEL: Record<Sector, string> = {
  activa: "Zona económicamente activa",
  desacelerada: "Zona desacelerada",
};
