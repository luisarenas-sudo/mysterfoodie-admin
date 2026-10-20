import { CATEGORIES } from "./categories";

/**
 * Etiquetas rápidas para el cierre de la visita: el Shopper toca en vez de
 * escribir. Se convierten en frases dentro del campo de comentarios, que es
 * lo que ya leen el reporte, el PDF y el tablero (no hace falta columna nueva).
 */
export const QUICK_TAGS = {
  good: [
    "Trato excelente",
    "Comida deliciosa",
    "Lugar muy limpio",
    "Buen ambiente",
    "Servicio rápido",
    "Buena presentación",
  ],
  improve: [
    "Servicio lento",
    "Menú desactualizado",
    "Falta limpieza",
    "Poca variedad",
    "Ambiente ruidoso",
    "Faltó atención al llegar",
  ],
} as const;

export type CommentParts = {
  good: string[];
  improve: string[];
  /** Nota opcional por categoría (key de categoría -> texto). */
  notes: Record<string, string>;
  /** Texto libre final. */
  free: string;
};

/**
 * Une etiquetas, notas por categoría y texto libre en un solo texto legible.
 * Si solo hay texto libre, lo devuelve tal cual (igual que antes).
 */
export function composeComments(parts: CommentParts): string {
  const blocks: string[] = [];
  const good = parts.good.filter(Boolean);
  const improve = parts.improve.filter(Boolean);
  const lines: string[] = [];
  if (good.length) lines.push(`Lo mejor: ${good.join(", ")}.`);
  if (improve.length) lines.push(`Para mejorar: ${improve.join(", ")}.`);
  if (lines.length) blocks.push(lines.join("\n"));

  const noteLines: string[] = [];
  for (const cat of CATEGORIES) {
    const text = (parts.notes[cat.key] || "").trim();
    if (text) noteLines.push(`${cat.label}: ${text}`);
  }
  if (noteLines.length) blocks.push(noteLines.join("\n"));

  const free = parts.free.trim();
  if (free) blocks.push(blocks.length ? `Otros comentarios: ${free}` : free);

  return blocks.join("\n\n");
}

/** Cuántas cosas escribió/tocó el Shopper en el cierre (para el borrador). */
export function commentPartsHaveContent(p: CommentParts): boolean {
  return (
    p.good.length > 0 ||
    p.improve.length > 0 ||
    Boolean(p.free.trim()) ||
    Object.values(p.notes).some((t) => t.trim())
  );
}
