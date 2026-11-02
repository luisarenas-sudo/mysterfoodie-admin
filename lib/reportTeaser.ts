import { CATEGORIES } from "./categories";
import type { Ratings } from "./scoring";

/**
 * Adelanto concreto del candado del reporte (antes del pago): cuántos indicadores
 * de ESA visita salieron bajos, sin decir cuáles. Solo cuenta los indicadores con
 * estrellas (46 de los 52). Se calcula en el servidor y a la página solo viaja el
 * texto, nunca las calificaciones por indicador.
 */
export type ReportTeaser = {
  emoji: string;
  title: string;
  detail: string;
};

export function buildTeaser(ratings: Ratings): ReportTeaser | null {
  let low = 0; // 2 estrellas o menos
  let mid = 0; // 3 estrellas
  let rated = 0;
  const lowByCategory = new Map<string, number>();

  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      if (item.type !== "star") continue;
      const v = ratings[item.key];
      if (typeof v !== "number" || v <= 0) continue; // sin calificar o «No aplica»
      rated += 1;
      if (v <= 2) {
        low += 1;
        lowByCategory.set(cat.label, (lowByCategory.get(cat.label) ?? 0) + 1);
      } else if (v === 3) {
        mid += 1;
      }
    }
  }
  if (rated === 0) return null;

  if (low > 0) {
    const [topCat, topN] = [...lowByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const where = low > 1 && topN > 1 ? `, la mayoría en ${topCat}` : low === 1 ? ` (en ${topCat})` : "";
    return {
      emoji: "🔎",
      title: low === 1 ? `1 indicador salió con 2 estrellas o menos${where}` : `${low} indicadores salieron con 2 estrellas o menos${where}`,
      detail: "En el reporte completo ves cuáles son y qué mover primero.",
    };
  }
  if (mid > 0) {
    return {
      emoji: "🔎",
      title: mid === 1 ? "1 indicador quedó en 3 estrellas (regular)" : `${mid} indicadores quedaron en 3 estrellas (regular)`,
      detail: "Suelen ser los más fáciles de mejorar. El reporte completo te dice cuáles.",
    };
  }
  return {
    emoji: "🌟",
    title: "Todos los indicadores salieron en 4 o 5 estrellas",
    detail: "El reporte completo muestra el detalle, los comentarios del MysterFoodie y qué conviene mantener.",
  };
}
