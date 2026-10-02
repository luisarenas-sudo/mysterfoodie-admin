import { CATEGORIES } from "./categories";

/** Calificaciones de indicadores tipo estrella: item key -> score (1-5). */
export type Ratings = Record<string, number>;

/** Valores Sí/No de indicadores tipo boolean: item key -> true/false. */
export type Flags = Record<string, boolean>;

export type CategoryScore = {
  key: string;
  label: string;
  average: number;
  count: number;
};

/**
 * Promedio por categoria, calculado con los indicadores tipo estrella de
 * esa categoria (los selects no puntuan). Si una categoria no tiene
 * ningun indicador tipo estrella (ej. Accesibilidad, que es puro Sí/No),
 * se usa en su lugar el % de "Sí" entre sus indicadores booleanos,
 * convertido a una escala de 1 a 5 (todos "No" = 1, todos "Sí" = 5),
 * para que la categoria no desaparezca del reporte.
 */
export function categoryScores(ratings: Ratings, flags: Flags = {}): CategoryScore[] {
  return CATEGORIES.map((cat) => {
    const starKeys = cat.items.filter((i) => i.type === "star").map((i) => i.key);
    const values = starKeys
      .map((k) => ratings[k])
      .filter((v): v is number => typeof v === "number" && v > 0);

    if (values.length > 0) {
      const average = Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
      return { key: cat.key, label: cat.label, average, count: values.length };
    }

    const boolKeys = cat.items.filter((i) => i.type === "boolean").map((i) => i.key);
    const boolValues = boolKeys
      .map((k) => flags[k])
      .filter((v): v is boolean => typeof v === "boolean");
    if (boolValues.length === 0) {
      return { key: cat.key, label: cat.label, average: 0, count: 0 };
    }
    const yesRatio = boolValues.filter(Boolean).length / boolValues.length;
    const average = Math.round((1 + yesRatio * 4) * 10) / 10;
    return { key: cat.key, label: cat.label, average, count: boolValues.length };
  });
}

/**
 * Promedio general de la visita: promedio de los 5 promedios de
 * categoria (no un promedio plano de los ~50 indicadores).
 */
export function overallScore(ratings: Ratings, flags: Flags = {}): number {
  const scores = categoryScores(ratings, flags).filter((c) => c.count > 0);
  if (scores.length === 0) return 0;
  const avg = scores.reduce((sum, c) => sum + c.average, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

/** Categorias mejor y peor evaluadas (solo se usa para la vista interna del agente). */
export function topAndBottomCategories(ratings: Ratings, flags: Flags = {}, count = 2) {
  const entries = categoryScores(ratings, flags).filter((c) => c.count > 0);
  const sorted = [...entries].sort((a, b) => b.average - a.average);
  return {
    strengths: sorted.slice(0, count).map((c) => ({ key: c.key, label: c.label, score: c.average })),
    opportunities: sorted
      .slice(-count)
      .reverse()
      .map((c) => ({ key: c.key, label: c.label, score: c.average })),
  };
}
