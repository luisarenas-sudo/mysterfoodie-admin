import { RATING_CATEGORIES } from "./categories";

export type Ratings = Record<string, number>;

export function overallScore(ratings: Ratings): number {
  const values = RATING_CATEGORIES.map((c) => ratings[c.key]).filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function topAndBottomCategories(ratings: Ratings, count = 2) {
  const entries = RATING_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    score: ratings[c.key] ?? 0,
  })).filter((e) => e.score > 0);

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    strengths: sorted.slice(0, count),
    opportunities: sorted.slice(-count).reverse(),
  };
}
