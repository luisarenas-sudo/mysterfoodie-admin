import { getSupabaseServiceClient } from "./supabase";
import { categoryScores, type Ratings } from "./scoring";
import { getVerdict } from "./verdict";

/**
 * Datos PARCIALES de un reporte para compartirlo (tarjeta social / vista
 * previa del enlace en Instagram, WhatsApp, etc.): nombre, calificación
 * general, veredicto y promedio por categoría. Es lo mismo que ya muestra la
 * página pública sin pagar; nunca incluye comentarios ni el detalle por
 * indicador.
 */
export type ShareData = {
  name: string;
  city: string | null;
  score: number;
  verdictLabel: string;
  verdictColor: string;
  verdictSummary: string;
  cats: { label: string; average: number; color: string }[];
};

export async function getShareData(shortCode: string): Promise<ShareData | null> {
  // Solo en desarrollo: /r/__demo/opengraph-image muestra la tarjeta con datos de ejemplo.
  if (shortCode === "__demo" && process.env.NODE_ENV !== "production") {
    const v = getVerdict(4.3);
    const mk = (label: string, average: number) => ({ label, average, color: getVerdict(average).color });
    return {
      name: "La Cantina del Puerto",
      city: "Boca del Río, Veracruz",
      score: 4.3,
      verdictLabel: v.label,
      verdictColor: v.color,
      verdictSummary: v.summary,
      cats: [mk("Fachada", 4.6), mk("Ambiente", 4.1), mk("Atención", 4.4), mk("Alimentos y bebidas", 4.5), mk("Accesibilidad", 3.2)],
    };
  }
  try {
    const db = getSupabaseServiceClient();
    const { data: form } = await db
      .from("forms")
      .select("id, overall_score, client_id")
      .eq("short_code", shortCode)
      .maybeSingle();
    if (!form) return null;

    const [{ data: client }, { data: ratingRows }, { data: flagRows }] = await Promise.all([
      db.from("clients").select("name, city").eq("id", form.client_id).maybeSingle(),
      db.from("form_ratings").select("category_key, score").eq("form_id", form.id),
      db.from("form_flags").select("flag_key, flag_value").eq("form_id", form.id),
    ]);

    const ratings: Ratings = {};
    (ratingRows || []).forEach((r) => {
      ratings[r.category_key] = r.score;
    });
    const flags: Record<string, boolean> = {};
    (flagRows || []).forEach((f) => {
      flags[f.flag_key] = f.flag_value;
    });

    const cats = categoryScores(ratings, flags).filter((c) => c.count > 0);
    const computed = cats.length ? Math.round((cats.reduce((s, c) => s + c.average, 0) / cats.length) * 10) / 10 : 0;
    const score = typeof form.overall_score === "number" && form.overall_score > 0 ? form.overall_score : computed;
    if (!score) return null;
    const verdict = getVerdict(score);

    return {
      name: client?.name || "Tu negocio",
      city: client?.city || null,
      score,
      verdictLabel: verdict.label,
      verdictColor: verdict.color,
      verdictSummary: verdict.summary,
      cats: cats.map((c) => ({ label: c.label, average: c.average, color: getVerdict(c.average).color })),
    };
  } catch {
    return null;
  }
}

/** ★★★★☆ (redondea a la estrella más cercana) para el texto de la vista previa. */
export function starsText(score: number): string {
  const n = Math.max(0, Math.min(5, Math.round(score)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
