import type { getSupabaseServiceClient } from "./supabase";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/** Eventos que manda mysterfoodie.com a /api/eventos (contador propio, sin cookies). */
export const WEB_EVENTS = ["visita", "clic_solicitar", "form_inicio", "form_enviado"] as const;
export type WebEvent = (typeof WEB_EVENTS)[number];

export const CHANNELS = ["directo", "instagram", "facebook", "google", "whatsapp", "correo", "otro"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<string, string> = {
  directo: "Directo (escribieron la dirección o abrieron un guardado)",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  whatsapp: "WhatsApp",
  correo: "Correo",
  otro: "Otro sitio",
};

/** De dónde llegó la visita, a partir del sitio de origen o de ?utm_source. Sin guardar la dirección completa. */
export function channelOf(refHost: string, utm: string): Channel {
  const s = `${utm} ${refHost}`.toLowerCase().trim();
  if (!s) return "directo";
  if (/instagram|ig\b|l\.instagram/.test(s)) return "instagram";
  if (/facebook|fb\.|fb\b|messenger/.test(s)) return "facebook";
  if (/google|bing|duckduckgo|yahoo/.test(s)) return "google";
  if (/whatsapp|wa\.me|wa\b/.test(s)) return "whatsapp";
  if (/mail|correo|resend|newsletter/.test(s)) return "correo";
  if (/mysterfoodie/.test(s)) return "directo"; // navegación interna o desde la app
  return "otro";
}

export type WebRow = { created_at: string; event: WebEvent; page: string; source: string | null; visitor: string; device: string | null; channel: string | null };

/** Lee los eventos del periodo (Supabase entrega 1,000 por petición, por eso se pagina). null = aún no se corre el SQL. */
export async function fetchWebEvents(db: Db, days: number): Promise<WebRow[] | null> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const out: WebRow[] = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await db
      .from("web_events")
      .select("created_at, event, page, source, visitor, device, channel")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(page * 1000, page * 1000 + 999);
    if (error) return page === 0 ? null : out;
    out.push(...((data ?? []) as WebRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export type WebSummary = {
  days: number;
  visits: number; // vistas de página
  visitors: number; // visitantes únicos por día (sin cookies, quien regresa otro día cuenta otra vez)
  clicks: number;
  formStarted: number;
  formSent: number;
  topPages: { page: string; n: number }[];
  byChannel: { channel: string; n: number }[];
  clicksBySource: { source: string; n: number }[];
  byDevice: { device: string; n: number }[];
  perDay: { day: string; visits: number }[];
};

const tally = <K extends string>(items: K[]): { key: K; n: number }[] => {
  const m = new Map<K, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
};

export function summarizeWeb(rows: WebRow[], days: number): WebSummary {
  const views = rows.filter((r) => r.event === "visita");
  const dayKey = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600000).toISOString().slice(0, 10);
  const uniq = new Set(views.map((r) => `${dayKey(r.created_at)}:${r.visitor}`));
  const perDayMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) perDayMap.set(dayKey(new Date(Date.now() - i * 86400000).toISOString()), 0);
  for (const r of views) {
    const k = dayKey(r.created_at);
    if (perDayMap.has(k)) perDayMap.set(k, (perDayMap.get(k) ?? 0) + 1);
  }
  const clicks = rows.filter((r) => r.event === "clic_solicitar");
  return {
    days,
    visits: views.length,
    visitors: uniq.size,
    clicks: clicks.length,
    formStarted: rows.filter((r) => r.event === "form_inicio").length,
    formSent: rows.filter((r) => r.event === "form_enviado").length,
    topPages: tally(views.map((r) => r.page)).slice(0, 6).map((t) => ({ page: t.key, n: t.n })),
    byChannel: tally(views.map((r) => r.channel || "directo")).map((t) => ({ channel: t.key, n: t.n })),
    clicksBySource: tally(clicks.map((r) => r.source || "otra")).map((t) => ({ source: t.key, n: t.n })),
    byDevice: tally(views.map((r) => r.device || "escritorio")).map((t) => ({ device: t.key, n: t.n })),
    perDay: [...perDayMap.entries()].map(([day, visits]) => ({ day, visits })),
  };
}
