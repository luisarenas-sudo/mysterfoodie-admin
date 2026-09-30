/**
 * Utilidades para dibujar "activity rings" estilo iOS con un <circle>
 * de SVG: el truco es animar stroke-dasharray/stroke-dashoffset sobre
 * la circunferencia del círculo.
 */
export function ringMetrics(value: number, max: number, radius: number) {
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const dashArray = `${circumference.toFixed(2)} ${circumference.toFixed(2)}`;
  const dashOffset = (circumference * (1 - pct)).toFixed(2);
  return { dashArray, dashOffset, circumference };
}

/** Paleta fija de colores para los círculos de iniciales (negocios, avatares). */
const AVATAR_COLORS = [
  "#F24444",
  "#F25631",
  "#FF9F0A",
  "#34C759",
  "#007AFF",
  "#AF52DE",
  "#FF2D55",
  "#5856D6",
];

export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Emoji decorativo fijo por categoría real de MysterFoodie. */
export const CATEGORY_EMOJI: Record<string, string> = {
  fachada: "🏠",
  ambiente: "🍃",
  atencion: "🙋",
  alimentos: "🍽️",
  accesibilidad: "♿",
};
