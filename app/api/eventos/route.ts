import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { REQUEST_SOURCES } from "@/lib/visitRequests";
import { WEB_EVENTS, channelOf } from "@/lib/webStats";

/**
 * Contador propio de mysterfoodie.com, sin cookies. Es PÚBLICO (lo llama el sitio, otro origen, por eso el CORS).
 * No guarda la IP: guarda un hash que cambia cada día. Ignora robots y a quien activó «No rastrear».
 * Siempre responde 204 para no frenar ni delatar nada a la página.
 */
const ORIGINS = ["https://mysterfoodie.com", "https://www.mysterfoodie.com"];
const MAX_PER_VISITOR_PER_10_MIN = 40;

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const done = (req: NextRequest) => new NextResponse(null, { status: 204, headers: cors(req) });

export async function OPTIONS(req: NextRequest) {
  return done(req);
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") || "";
    if (origin && !ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) return done(req);
    const ua = req.headers.get("user-agent") || "";
    if (!ua || /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp|headless|lighthouse|pingdom|uptime/i.test(ua)) return done(req);

    // El sitio manda el JSON como text/plain para no disparar el preflight del CORS.
    const raw = await req.text();
    if (raw.length > 1000) return done(req);
    const p = JSON.parse(raw) as Record<string, unknown>;

    const event = typeof p.event === "string" && (WEB_EVENTS as readonly string[]).includes(p.event) ? p.event : null;
    const page = typeof p.page === "string" && /^\/[a-z0-9\-_/]{0,80}$/i.test(p.page) ? p.page : null;
    if (!event || !page) return done(req);
    const source = typeof p.source === "string" && REQUEST_SOURCES.has(p.source) ? p.source : null;
    const ref = typeof p.ref === "string" ? p.ref.slice(0, 120) : "";
    const utm = typeof p.utm === "string" ? p.utm.slice(0, 40) : "";
    const device = p.device === "movil" ? "movil" : "escritorio";

    // Hash diario: misma persona el mismo día = mismo valor; al día siguiente cambia (no hay seguimiento entre días).
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
    const day = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10); // día en CDMX
    const visitor = createHash("sha256").update(`mf-web:${day}:${ip}:${ua}`).digest("hex").slice(0, 20);

    const db = getSupabaseServiceClient();
    const since = new Date(Date.now() - 10 * 60000).toISOString();
    const { count } = await db.from("web_events").select("id", { count: "exact", head: true }).eq("visitor", visitor).gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_VISITOR_PER_10_MIN) return done(req);

    await db.from("web_events").insert({ event, page, source, visitor, device, channel: channelOf(ref, utm) });
  } catch {
    // Medir nunca debe romper nada: se ignora.
  }
  return done(req);
}
