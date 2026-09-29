import { CATEGORIES } from "./categories";

/** Calificaciones de indicadores tipo estrella: item key -> score (1-5). */
export type Ratings = Record<string, number>;

export type CategoryScore = {
  key: string;
  label: string;
  average: number;
  count: number;
};

/**
 * Promedio por categoria, calculado solo con los indicadores tipo
 * estrella de esa categoria (los booleanos y selects no puntuan).
 */
export function categoryScores(ratings: Ratings): CategoryScore[] {
  return CATEGORIES.map((cat) => {
    const starKeys = cat.items.filter((i) => i.type === "star").map((i) => i.key);
    const values = starKeys
      .map((k) => ratings[k])
      .filter((v): v is number => typeof v === "number" && v > 0);
    const average =
      values.length > 0
        ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
        : 0;
    return { key: cat.key, label: cat.label, average, count: values.length };
  });
}

/**
 * Promedio general de la visita: promedio de los 5 promedios de
 * categoria (no un promedio plano de los ~50 indicadores).
 */
export function overallScore(ratings: Ratings): number {
  const scores = categoryScores(ratings).filter((c) => c.count > 0);
  if (scores.length === 0) return 0;
  const avg = scores.reduce((sum, c) => sum + c.average, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

/** Categorias mejor y peor evaluadas (solo se usa para la vista interna del agente). */
export function topAndBottomCategories(ratings: Ratings, count = 2) {
  const entries = categoryScores(ratings).filter((c) => c.count > 0);
  const sorted = [...entries].sort((a, b) => b.average - a.average);
  return {
    strengths: sorted.slice(0, count).map((c) => ({ key: c.key, label: c.label, score: c.average })),
    opportunities: sorted
      .slice(-count)
      .reverse()
      .map((c) => ({ key: c.key, label: c.label, score: c.average })),
  };
}
