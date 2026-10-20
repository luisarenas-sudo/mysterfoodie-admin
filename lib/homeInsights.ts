import { getSupabaseServiceClient } from "./supabase";
import { CATEGORIES } from "./categories";
import { getVerdict } from "./verdict";
import { avatarColorFor, initialsFor } from "./ring";
import { ROLE_LABELS } from "./brand";

/**
 * Estadísticas del tablero de Inicio. Admin ve toda la red; Sibarita y Shopper, sus propias visitas. Las palabras
 * que más se repiten en los comentarios son agregadas de todo el equipo (no atribuibles a nadie ni a un negocio).
 * Todo en hora CDMX (UTC-6 todo el año).
 */
const TZ_MS = 6 * 3600 * 1000;
const DAY = 86400000;
const MAX_FORMS = 1000;

export type InsightRole = "admin" | "sibarita" | "agente";

export type Kpi = { label: string; value: string; delta?: { text: string; tone: "up" | "down" | "flat" }; hint?: string };
export type Mover = { clientId: string; name: string; from: number; to: number; delta: number };
export type HomeInsights = {
  scopeLabel: string;
  empty: boolean;
  kpis: Kpi[];
  movers: { up: Mover[]; down: Mover[] };
  weekly: { label: string; count: number; current: boolean }[];
  monthly: { label: string; avg: number | null; count: number }[];
  categories: { key: string; label: string; avg: number }[];
  verdicts: { label: string; color: string; count: number }[];
  streak: { current: number; best: number; lastVisitDaysAgo: number | null; weeks: boolean[]; team: number | null };
  heat: { days: string[]; slots: string[]; cells: number[][]; max: number; total: number };
  words: { word: string; count: number }[];
  good: { tag: string; count: number }[];
  improve: { tag: string; count: number }[];
  newBusinesses: { id: string; nombre: string; fecha: string; initial: string; avatarColor: string; creatorLabel: string | null }[];
  newBusinessesMonth: number | null;
  leaderboard: { id: string; name: string; initial: string; avatarColor: string; count: number; avg: number | null }[];
};

type FormRow = { id: string; client_id: string; overall_score: number | null; created_at: string; created_by: string | null; report_unlocked_at?: string | null };

const local = (iso: string | number) => new Date((typeof iso === "number" ? iso : new Date(iso).getTime()) - TZ_MS);
const monthKeyOf = (ms: number) => new Date(ms - TZ_MS).toISOString().slice(0, 7);
const shiftMonthKey = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** Lunes de la semana (en días desde 1970) de un instante. */
function weekIndex(ms: number): number {
  const d = local(ms);
  const dow = (d.getUTCDay() + 6) % 7;
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) / DAY);
}
const weekLabel = (idx: number) => new Date(idx * DAY).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const monthShort = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))).replace(".", "");
};
const avg = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10 : null);

function delta(cur: number, prev: number, unit = ""): Kpi["delta"] {
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return { text: `igual que el mes pasado`, tone: "flat" };
  const n = Number.isInteger(d) ? String(Math.abs(d)) : Math.abs(d).toFixed(1);
  return { text: `${d > 0 ? "+" : "−"}${n}${unit} vs. mes pasado`, tone: d > 0 ? "up" : "down" };
}

// ---------------------------------------------------------------- palabras
const STOP = new Set(
  ("el la los las de del un una unos unas y o en a que es muy poco mas con sin no si fue fueron estaba estuvo pero por para se su sus lo al como tambien este esta estos estas hay habia nos les le hubo era eran todo toda todos todas ser estan estuvieron bien mal algo cosas cosa " +
    "mejor mejorar otros comentarios tiene tienen tuvo cuando donde porque cada solo sobre entre desde hasta ademas aunque pues asi aqui alli mesa mesero meseros visita negocio lugar " +
    "ambiente fachada atencion alimentos bebidas accesibilidad")
    .split(" ")
);
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

function wordPool(comments: string[], limit = 30) {
  const counts = new Map<string, { n: number; shown: string }>();
  const good = new Map<string, number>();
  const improve = new Map<string, number>();
  for (const text of comments) {
    for (const line of text.split("\n")) {
      const m = line.match(/^(Lo mejor|Para mejorar):\s*(.+?)\.?\s*$/);
      if (m) {
        const target = m[1] === "Lo mejor" ? good : improve;
        for (const tag of m[2].split(",").map((t) => t.trim()).filter(Boolean)) target.set(tag, (target.get(tag) || 0) + 1);
        continue;
      }
      for (const raw of line.split(/[^A-Za-záéíóúñÁÉÍÓÚÑ]+/)) {
        const w = norm(raw);
        if (w.length < 4 || STOP.has(w)) continue;
        const prev = counts.get(w);
        counts.set(w, { n: (prev?.n || 0) + 1, shown: prev?.shown || raw.toLowerCase() });
      }
    }
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));
  return {
    words: [...counts.values()].filter((v) => v.n >= 2).sort((a, b) => b.n - a.n).slice(0, limit).map((v) => ({ word: v.shown, count: v.n })),
    good: top(good),
    improve: top(improve),
  };
}

// ----------------------------------------------------------------- principal
export async function getHomeInsights(me: { userId: string; role: InsightRole }): Promise<HomeInsights> {
  const db = getSupabaseServiceClient();
  const isAdmin = me.role === "admin";
  const now = Date.now();
  const thisMonth = monthKeyOf(now);
  const prevMonth = shiftMonthKey(thisMonth, -1);

  let formsQ = db.from("forms").select("id, client_id, overall_score, created_at, created_by, report_unlocked_at").order("created_at", { ascending: false }).limit(MAX_FORMS);
  if (!isAdmin) formsQ = formsQ.eq("created_by", me.userId);
  const clientsSince = new Date(now - 75 * DAY).toISOString();
  let clientsQ = db.from("clients").select("id, name, created_at, created_by").gte("created_at", clientsSince).order("created_at", { ascending: false }).limit(300);
  if (me.role === "sibarita") clientsQ = clientsQ.eq("created_by", me.userId);

  const [{ data: formsRaw }, { data: commentRows }, clientsRes] = await Promise.all([
    formsQ,
    db.from("forms").select("comments").not("comments", "is", null).order("created_at", { ascending: false }).limit(300),
    me.role === "agente" ? Promise.resolve({ data: [] as { id: string; name: string; created_at: string; created_by: string | null }[] }) : clientsQ,
  ]);
  const forms = ((formsRaw || []) as FormRow[]).map((f) => ({ ...f, overall_score: Number(f.overall_score) || 0, ms: new Date(f.created_at).getTime() }));
  const clientsNew = clientsRes.data || [];

  // ---- KPIs
  const inMonth = (ms: number, key: string) => monthKeyOf(ms) === key;
  const fCur = forms.filter((f) => inMonth(f.ms, thisMonth));
  const fPrev = forms.filter((f) => inMonth(f.ms, prevMonth));
  const avgCur = avg(fCur.map((f) => f.overall_score));
  const avgPrev = avg(fPrev.map((f) => f.overall_score));
  const nbCur = clientsNew.filter((c) => inMonth(new Date(c.created_at).getTime(), thisMonth)).length;
  const nbPrev = clientsNew.filter((c) => inMonth(new Date(c.created_at).getTime(), prevMonth)).length;
  const soldCur = forms.filter((f) => f.report_unlocked_at && inMonth(new Date(f.report_unlocked_at).getTime(), thisMonth)).length;
  const soldPrev = forms.filter((f) => f.report_unlocked_at && inMonth(new Date(f.report_unlocked_at).getTime(), prevMonth)).length;

  // ---- rachas (semanas seguidas con al menos una visita)
  const mine = isAdmin ? forms.filter((f) => f.created_by === me.userId) : forms;
  const streakOf = (list: { ms: number }[]) => {
    const weeks = new Set(list.map((f) => weekIndex(f.ms)));
    const thisWeek = weekIndex(now);
    let cur = 0;
    let w = weeks.has(thisWeek) ? thisWeek : thisWeek - 7; // la semana en curso aún puede cumplirse
    while (weeks.has(w)) {
      cur++;
      w -= 7;
    }
    const sorted = [...weeks].sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    sorted.forEach((x, i) => {
      run = i > 0 && x - sorted[i - 1] === 7 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    const strip = Array.from({ length: 12 }, (_, i) => weeks.has(thisWeek - 7 * (11 - i)));
    return { cur, best, strip };
  };
  const mineStreak = streakOf(mine);
  const teamStreak = isAdmin ? streakOf(forms).cur : null;
  const lastMine = mine[0] ? Math.floor((now - mine[0].ms) / DAY) : null;

  const kpis: Kpi[] = [
    { label: "Visitas este mes", value: String(fCur.length), delta: delta(fCur.length, fPrev.length) },
    { label: "Promedio del mes", value: avgCur === null ? "—" : String(avgCur), delta: avgCur !== null && avgPrev !== null ? delta(avgCur, avgPrev) : undefined, hint: "de 5" },
  ];
  if (me.role === "agente") {
    kpis.push({ label: "Racha actual", value: String(mineStreak.cur), hint: mineStreak.cur === 1 ? "semana seguida" : "semanas seguidas" });
    kpis.push({ label: "Mejor racha", value: String(mineStreak.best), hint: mineStreak.best === 1 ? "semana" : "semanas" });
  } else {
    kpis.push({ label: "Negocios nuevos", value: String(nbCur), delta: delta(nbCur, nbPrev), hint: "este mes" });
    if (isAdmin) kpis.push({ label: "Reportes vendidos", value: String(soldCur), delta: delta(soldCur, soldPrev), hint: "este mes" });
    else kpis.push({ label: "Racha actual", value: String(mineStreak.cur), hint: mineStreak.cur === 1 ? "semana seguida" : "semanas seguidas" });
  }

  // ---- semanas y meses
  const thisWeek = weekIndex(now);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const w = thisWeek - 7 * (7 - i);
    return { label: weekLabel(w), count: forms.filter((f) => weekIndex(f.ms) === w).length, current: i === 7 };
  });
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonthKey(thisMonth, i - 5);
    const list = forms.filter((f) => inMonth(f.ms, key));
    return { label: monthShort(key), avg: avg(list.map((f) => f.overall_score)), count: list.length };
  });

  // ---- veredictos (últimos 90 días)
  const since90 = now - 90 * DAY;
  const v = { excelente: 0, bueno: 0, regular: 0, malo: 0 };
  for (const f of forms.filter((x) => x.ms >= since90)) {
    const lvl = getVerdict(f.overall_score).level;
    v[lvl === "muy_malo" ? "malo" : lvl]++;
  }
  const verdicts = [
    { label: "Excelente", color: getVerdict(5).color, count: v.excelente },
    { label: "Bueno", color: getVerdict(4).color, count: v.bueno },
    { label: "Regular", color: getVerdict(3).color, count: v.regular },
    { label: "Malo o menos", color: getVerdict(2).color, count: v.malo },
  ];

  // ---- mapa de calor: día de la semana × franja (últimos 90 días)
  const slots = ["Mañana", "Comida", "Tarde", "Noche"];
  const cells = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const f of forms.filter((x) => x.ms >= since90)) {
    const d = local(f.ms);
    const h = d.getUTCHours();
    cells[(d.getUTCDay() + 6) % 7][h < 12 ? 0 : h < 16 ? 1 : h < 20 ? 2 : 3]++;
  }
  const heatMax = Math.max(0, ...cells.flat());

  // ---- promedio por categoría (últimas 40 visitas)
  const itemToCat = new Map<string, string>();
  for (const c of CATEGORIES) for (const it of c.items) itemToCat.set(it.key, c.key);
  const recentIds = forms.slice(0, 40).map((f) => f.id);
  const sums = new Map<string, { s: number; n: number }>();
  for (let i = 0; i < recentIds.length && recentIds.length; i += 20) {
    const ids = recentIds.slice(i, i + 20);
    for (let from = 0; from < 4000; from += 1000) {
      const { data } = await db.from("form_ratings").select("category_key, score").in("form_id", ids).range(from, from + 999);
      for (const r of data || []) {
        const cat = itemToCat.get(r.category_key as string) ?? (r.category_key as string).split("_")[0];
        const cur = sums.get(cat) || { s: 0, n: 0 };
        cur.s += Number(r.score);
        cur.n += 1;
        sums.set(cat, cur);
      }
      if (!data || data.length < 1000) break;
    }
  }
  const categories = CATEGORIES.map((c) => {
    const x = sums.get(c.key);
    return x && x.n > 0 ? { key: c.key, label: c.label, avg: Math.round((x.s / x.n) * 10) / 10 } : null;
  })
    .filter((c): c is { key: string; label: string; avg: number } => c !== null)
    .sort((a, b) => a.avg - b.avg);

  // ---- movimientos: negocios cuya última visita subió o bajó vs. la anterior
  const byClient = new Map<string, typeof forms>();
  for (const f of forms) byClient.set(f.client_id, [...(byClient.get(f.client_id) || []), f]);
  const moverRaw: { clientId: string; from: number; to: number; delta: number }[] = [];
  for (const [clientId, list] of byClient) {
    if (list.length < 2) continue;
    const to = list[0].overall_score;
    const from = list[1].overall_score;
    const d = Math.round((to - from) * 10) / 10;
    if (Math.abs(d) >= 0.3) moverRaw.push({ clientId, from, to, delta: d });
  }
  // Un Shopper no tiene acceso a Negocios: sin movimientos para él.
  const ups = me.role === "agente" ? [] : moverRaw.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const downs = me.role === "agente" ? [] : moverRaw.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  // ---- nombres que hacen falta
  const clientIds = [...new Set([...ups, ...downs].map((m) => m.clientId))];
  const nameOf = new Map<string, string>();
  if (clientIds.length) {
    const { data } = await db.from("clients").select("id, name").in("id", clientIds);
    for (const c of data || []) nameOf.set(c.id as string, c.name as string);
  }
  const withName = (m: { clientId: string; from: number; to: number; delta: number }): Mover => ({ ...m, name: nameOf.get(m.clientId) ?? "Negocio" });

  // ---- equipo (solo admin): más visitas en 30 días
  let leaderboard: HomeInsights["leaderboard"] = [];
  if (isAdmin) {
    const since30 = now - 30 * DAY;
    const per = new Map<string, number[]>();
    for (const f of forms) if (f.ms >= since30 && f.created_by) per.set(f.created_by, [...(per.get(f.created_by) || []), f.overall_score]);
    const ids = [...per.keys()];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };
    const pm = new Map((profs || []).map((p) => [p.id as string, p]));
    leaderboard = ids
      .map((id) => {
        const p = pm.get(id);
        const name = `${ROLE_LABELS[(p?.role as string) ?? ""] ?? ""} ${(p?.full_name as string | null)?.split(/\s+/)[0] ?? "Sin nombre"}`.trim();
        return { id, name, initial: initialsFor(name), avatarColor: avatarColorFor(name), count: per.get(id)!.length, avg: avg(per.get(id)!) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // ---- nuevos negocios (lista)
  const creatorIds = [...new Set(clientsNew.slice(0, 5).map((c) => c.created_by).filter((x): x is string => Boolean(x)))];
  const creators = new Map<string, string>();
  if (creatorIds.length) {
    const { data } = await db.from("profiles").select("id, full_name, role").in("id", creatorIds);
    for (const p of data || []) creators.set(p.id as string, `${ROLE_LABELS[p.role as string] ?? ""} ${(p.full_name as string | null)?.split(/\s+/)[0] ?? ""}`.trim());
  }
  const newBusinesses = clientsNew.slice(0, 5).map((c) => ({
    id: c.id as string,
    nombre: c.name as string,
    fecha: new Date(c.created_at as string).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).replace(".", ""),
    initial: initialsFor(c.name as string),
    avatarColor: avatarColorFor(c.name as string),
    creatorLabel: c.created_by ? creators.get(c.created_by as string) ?? null : null,
  }));

  const pool = wordPool((commentRows || []).map((r) => r.comments as string).filter(Boolean));

  return {
    scopeLabel: isAdmin ? "Toda la red" : "Tus visitas",
    empty: forms.length === 0,
    kpis,
    movers: { up: ups.map(withName), down: downs.map(withName) },
    weekly,
    monthly,
    categories,
    verdicts,
    streak: { current: mineStreak.cur, best: mineStreak.best, lastVisitDaysAgo: lastMine, weeks: mineStreak.strip, team: teamStreak },
    heat: { days: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"], slots, cells, max: heatMax, total: cells.flat().reduce((a, b) => a + b, 0) },
    words: pool.words,
    good: pool.good,
    improve: pool.improve,
    newBusinesses,
    newBusinessesMonth: me.role === "agente" ? null : nbCur,
    leaderboard,
  };
}
