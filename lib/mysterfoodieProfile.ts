import { getSupabaseServiceClient } from "@/lib/supabase";
import { wordPool } from "@/lib/homeInsights";
import { CUISINES, DISHES } from "@/lib/foodCatalog";
import { sectorFromPostalCode, SECTOR_LABEL, type Sector } from "@/lib/zonas";

/** Precio del perfil anónimo de un MysterFoodie para cuentas de negocio (MXN, sin IVA, pago único). */
export const MYSTERFOODIE_PROFILE_PRICE_MXN = Number(process.env.MYSTERFOODIE_PROFILE_PRICE_MXN) || 350;

const TZ_MS = 6 * 3600 * 1000; // CDMX (UTC-6, sin horario de verano)
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type MysterfoodieProfile = {
  alias: string;
  /** "Sibarita" o "Shopper": el rango, nunca el nombre real. */
  rankLabel: string;
  monthsActive: number;
  visits: number;
  words: { word: string; count: number }[];
  likes: { good: { tag: string; count: number }[]; improve: { tag: string; count: number }[] };
  tastes: { cuisines: string[]; dishes: string[] };
  visitedTypes: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  party: { avg: number | null; usual: number | null; soloPct: number | null; groupPct: number | null; samples: number };
  consumption: { samples: number; total: number; avgTicket: number | null; avgPerPerson: number | null; maxTicket: number | null };
  sector: { value: Sector | null; label: string | null };
  strictness: { avg: number | null; teamAvg: number | null; label: string | null };
  habits: { day: string | null; slot: string | null };
};

const MONEY_SAMPLE_MIN = 1;

function top<T extends string>(items: T[], limit = 5): { label: T; count: number }[] {
  const m = new Map<T, number>();
  for (const it of items) if (it) m.set(it, (m.get(it) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

function slotOf(hour: number): string {
  if (hour < 12) return "mañana";
  if (hour < 16) return "comida";
  if (hour < 20) return "tarde";
  return "noche";
}

/**
 * Perfil anónimo de un MysterFoodie: solo alias y hábitos agregados. NUNCA incluye nombre real, foto, contacto, código
 * postal exacto, nombres de negocios ni fechas exactas de visitas.
 * Devuelve null si la persona no existe o aún no tiene alias.
 */
export async function buildMysterfoodieProfile(mysterfoodieId: string): Promise<MysterfoodieProfile | null> {
  const db = getSupabaseServiceClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, role, alias, postal_code, food_cuisines, food_dishes, created_at")
    .eq("id", mysterfoodieId)
    .maybeSingle();
  if (!p || !p.alias) return null;

  const { data: forms } = await db
    .from("forms")
    .select("id, client_id, overall_score, created_at, comments, consumption_total, party_size")
    .eq("created_by", mysterfoodieId)
    .order("created_at", { ascending: true })
    .limit(3000);
  const rows = forms ?? [];

  const clientIds = [...new Set(rows.map((f) => f.client_id).filter(Boolean))] as string[];
  const clientMap = new Map<string, { type: string | null; city: string | null }>();
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data: cs } = await db.from("clients").select("id, type, city").in("id", clientIds.slice(i, i + 200));
    for (const c of cs ?? []) clientMap.set(c.id, { type: c.type, city: c.city });
  }

  const pool = wordPool(rows.map((f) => f.comments).filter((c): c is string => Boolean(c)), 24, 2);

  const typeLabel = (t: string | null | undefined) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
  const visitedTypes = top(rows.map((f) => typeLabel(clientMap.get(f.client_id)?.type ?? null)));
  const cities = top(rows.map((f) => (clientMap.get(f.client_id)?.city ?? "").trim()));

  const sizes = rows.map((f) => f.party_size).filter((n): n is number => typeof n === "number" && n > 0);
  const usualMap = new Map<number, number>();
  sizes.forEach((n) => usualMap.set(n, (usualMap.get(n) || 0) + 1));
  const usual = [...usualMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const money = rows
    .filter((f) => f.consumption_total != null)
    .map((f) => ({ total: Number(f.consumption_total), party: f.party_size as number | null }));
  const totalSpent = money.reduce((a, m) => a + m.total, 0);
  const perPerson = money.filter((m) => m.party && m.party > 0).map((m) => m.total / (m.party as number));

  const scores = rows.map((f) => f.overall_score).filter((n): n is number => typeof n === "number");
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const { data: all } = await db.from("forms").select("overall_score").not("overall_score", "is", null).limit(5000);
  const allScores = (all ?? []).map((r) => Number(r.overall_score)).filter((n) => Number.isFinite(n));
  const teamAvg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  let strictLabel: string | null = null;
  if (avg != null && teamAvg != null && scores.length >= 3) {
    const d = avg - teamAvg;
    strictLabel = d <= -0.3 ? "Evaluador exigente" : d >= 0.3 ? "Evaluador generoso" : "Evaluador equilibrado";
  }

  const dayCount = new Map<string, number>();
  const slotCount = new Map<string, number>();
  for (const f of rows) {
    const d = new Date(new Date(f.created_at).getTime() - TZ_MS);
    const day = DAYS[d.getUTCDay()];
    dayCount.set(day, (dayCount.get(day) || 0) + 1);
    const s = slotOf(d.getUTCHours());
    slotCount.set(s, (slotCount.get(s) || 0) + 1);
  }
  const best = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sector = sectorFromPostalCode(p.postal_code);
  const months = Math.max(0, Math.round((Date.now() - new Date(p.created_at).getTime()) / (30 * 86400000)));

  return {
    alias: p.alias,
    rankLabel: p.role === "sibarita" ? "Sibarita" : "Shopper",
    monthsActive: months,
    visits: rows.length,
    words: pool.words,
    likes: { good: pool.good, improve: pool.improve },
    tastes: {
      cuisines: ((p.food_cuisines as string[] | null) ?? []).map((k) => CUISINES.find((c) => c.key === k)?.label ?? k),
      dishes: ((p.food_dishes as string[] | null) ?? []).map((k) => DISHES.find((d) => d.key === k)?.label ?? k),
    },
    visitedTypes,
    cities,
    party: {
      avg: sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null,
      usual,
      soloPct: sizes.length ? Math.round((sizes.filter((n) => n === 1).length / sizes.length) * 100) : null,
      groupPct: sizes.length ? Math.round((sizes.filter((n) => n >= 4).length / sizes.length) * 100) : null,
      samples: sizes.length,
    },
    consumption: {
      samples: money.length,
      total: totalSpent,
      avgTicket: money.length >= MONEY_SAMPLE_MIN ? totalSpent / money.length : null,
      avgPerPerson: perPerson.length ? perPerson.reduce((a, b) => a + b, 0) / perPerson.length : null,
      maxTicket: money.length ? Math.max(...money.map((m) => m.total)) : null,
    },
    sector: { value: sector, label: sector ? SECTOR_LABEL[sector] : null },
    strictness: { avg, teamAvg, label: strictLabel },
    habits: { day: best(dayCount), slot: best(slotCount) },
  };
}
