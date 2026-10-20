import { getSupabaseServiceClient } from "@/lib/supabase";
import { wordPool } from "@/lib/homeInsights";
import { CUISINES, DISHES } from "@/lib/foodCatalog";
import { sectorFromPostalCode, SECTOR_LABEL, type Sector } from "@/lib/zonas";

import { BLOCK_BY_KEY, ID_BLOCKS, MIN_VISITS_PASSPORT, PASSPORT_BLOCKS, TIERS, isBlockComplete, isBlockKey, sanitizePersona, type BlockKey, type Persona, type TierKey } from "@/lib/personaCatalog";

/** Precio del perfil ID (MXN, sin IVA, pago único). Los precios de los dos niveles viven en lib/personaCatalog.ts. */
export const MYSTERFOODIE_PROFILE_PRICE_MXN = TIERS.id.price;

const TZ_MS = 6 * 3600 * 1000; // CDMX (UTC-6, sin horario de verano)
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type MysterfoodieProfile = {
  alias: string;
  /** "Sibarita" o "Shopper": el rango, nunca el nombre real. */
  rankLabel: string;
  monthsActive: number;
  visits: number;
  tier: TierKey;
  /** Bloques que SÍ comparte y que forman parte del nivel comprado. */
  blocks: BlockKey[];
  gustos: {
    words: { word: string; count: number }[];
    likes: { good: { tag: string; count: number }[]; improve: { tag: string; count: number }[] };
    tastes: { cuisines: string[]; dishes: string[] };
  } | null;
  consumo: {
    visitedTypes: { label: string; count: number }[];
    cities: { label: string; count: number }[];
    party: { avg: number | null; usual: number | null; soloPct: number | null; groupPct: number | null; samples: number };
    consumption: { samples: number; total: number; avgTicket: number | null; avgPerPerson: number | null; maxTicket: number | null };
    strictness: { avg: number | null; teamAvg: number | null; label: string | null };
    habits: { day: string | null; slot: string | null };
  } | null;
  sector: { value: Sector | null; label: string | null } | null;
  /** Respuestas del buyer persona, solo de los bloques Passport compartidos. */
  persona: Persona;
};

/** Qué ofrece un MysterFoodie a los negocios hoy (sin datos): para mostrar niveles disponibles antes de comprar. */
export type ProfileOffer = {
  alias: string;
  rankLabel: string;
  visits: number;
  /** Bloques compartidos y completos, por nivel. */
  shared: BlockKey[];
  idAvailable: boolean;
  passportAvailable: boolean;
  passportBlocks: BlockKey[];
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

function effectiveBlocks(share: unknown, persona: Persona, visits: number): BlockKey[] {
  const wanted = Array.isArray(share) ? (share as unknown[]).filter(isBlockKey) : [];
  return wanted.filter((k) => {
    if (BLOCK_BY_KEY[k].tier === "passport") return visits >= MIN_VISITS_PASSPORT && isBlockComplete(k, persona);
    return true;
  });
}

async function countVisits(db: ReturnType<typeof getSupabaseServiceClient>, id: string): Promise<number> {
  const { count } = await db.from("forms").select("id", { count: "exact", head: true }).eq("created_by", id);
  return count ?? 0;
}

/** Lo que este MysterFoodie comparte hoy (para ofertar niveles y calcular ganancias). Null si no existe o no tiene alias. */
export async function getProfileOffer(mysterfoodieId: string): Promise<ProfileOffer | null> {
  const db = getSupabaseServiceClient();
  const { data: p } = await db.from("profiles").select("alias, role, persona, share_blocks").eq("id", mysterfoodieId).maybeSingle();
  if (!p?.alias) return null;
  const visits = await countVisits(db, mysterfoodieId);
  const persona = sanitizePersona(p.persona);
  const shared = effectiveBlocks(p.share_blocks, persona, visits);
  const passportBlocks = shared.filter((k) => PASSPORT_BLOCKS.includes(k));
  return {
    alias: p.alias,
    rankLabel: p.role === "sibarita" ? "Sibarita" : "Shopper",
    visits,
    shared,
    idAvailable: shared.some((k) => ID_BLOCKS.includes(k)),
    passportAvailable: shared.some((k) => ID_BLOCKS.includes(k)) && passportBlocks.length >= 2,
    passportBlocks,
  };
}

/**
 * Perfil anónimo de un MysterFoodie para el nivel `tier`: solo alias y hábitos agregados, y SOLO los bloques que la persona
 * decidió compartir. NUNCA incluye nombre real, foto, contacto, código postal exacto, nombres de negocios ni fechas exactas.
 * Devuelve null si la persona no existe o aún no tiene alias.
 */
export async function buildMysterfoodieProfile(mysterfoodieId: string, opts: { tier?: TierKey } = {}): Promise<MysterfoodieProfile | null> {
  const tier: TierKey = opts.tier ?? "id";
  const db = getSupabaseServiceClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, role, alias, postal_code, food_cuisines, food_dishes, created_at, persona, share_blocks")
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

  const personaAll = sanitizePersona(p.persona);
  const allowed = effectiveBlocks(p.share_blocks, personaAll, rows.length).filter((k) => tier === "passport" || ID_BLOCKS.includes(k));
  const has = (k: BlockKey) => allowed.includes(k);
  const months = Math.max(0, Math.round((Date.now() - new Date(p.created_at).getTime()) / (30 * 86400000)));

  // ---- Gustos y palabras
  let gustos: MysterfoodieProfile["gustos"] = null;
  if (has("gustos")) {
    const pool = wordPool(rows.map((f) => f.comments).filter((c): c is string => Boolean(c)), 24, 2);
    gustos = {
      words: pool.words,
      likes: { good: pool.good, improve: pool.improve },
      tastes: {
        cuisines: ((p.food_cuisines as string[] | null) ?? []).map((k) => CUISINES.find((c) => c.key === k)?.label ?? k),
        dishes: ((p.food_dishes as string[] | null) ?? []).map((k) => DISHES.find((d) => d.key === k)?.label ?? k),
      },
    };
  }

  // ---- Consumo y salidas
  let consumo: MysterfoodieProfile["consumo"] = null;
  if (has("consumo")) {
    const clientIds = [...new Set(rows.map((f) => f.client_id).filter(Boolean))] as string[];
    const clientMap = new Map<string, { type: string | null; city: string | null }>();
    for (let i = 0; i < clientIds.length; i += 200) {
      const { data: cs } = await db.from("clients").select("id, type, city").in("id", clientIds.slice(i, i + 200));
      for (const c of cs ?? []) clientMap.set(c.id, { type: c.type, city: c.city });
    }
    const typeLabel = (t: string | null | undefined) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
    const sizes = rows.map((f) => f.party_size).filter((n): n is number => typeof n === "number" && n > 0);
    const usualMap = new Map<number, number>();
    sizes.forEach((n) => usualMap.set(n, (usualMap.get(n) || 0) + 1));
    const usual = [...usualMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const money = rows.filter((f) => f.consumption_total != null).map((f) => ({ total: Number(f.consumption_total), party: f.party_size as number | null }));
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
      const sl = slotOf(d.getUTCHours());
      slotCount.set(sl, (slotCount.get(sl) || 0) + 1);
    }
    const best = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    consumo = {
      visitedTypes: top(rows.map((f) => typeLabel(clientMap.get(f.client_id)?.type ?? null))),
      cities: top(rows.map((f) => (clientMap.get(f.client_id)?.city ?? "").trim())),
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
      strictness: { avg, teamAvg, label: strictLabel },
      habits: { day: best(dayCount), slot: best(slotCount) },
    };
  }

  // ---- Sector
  let sectorOut: MysterfoodieProfile["sector"] = null;
  if (has("sector")) {
    const sector = sectorFromPostalCode(p.postal_code);
    sectorOut = { value: sector, label: sector ? SECTOR_LABEL[sector] : null };
  }

  // ---- Buyer persona (solo Passport)
  const persona: Persona = {};
  if (tier === "passport") for (const k of PASSPORT_BLOCKS) if (has(k) && personaAll[k]) persona[k] = personaAll[k];

  return {
    alias: p.alias,
    rankLabel: p.role === "sibarita" ? "Sibarita" : "Shopper",
    monthsActive: months,
    visits: rows.length,
    tier,
    blocks: allowed,
    gustos,
    consumo,
    sector: sectorOut,
    persona,
  };
}
