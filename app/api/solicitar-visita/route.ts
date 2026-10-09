import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { BUSINESS_TYPES } from "@/lib/categories";
import { REQUEST_SOURCES, createVisitRequest } from "@/lib/visitRequests";

/**
 * "Solicita una visita GRATIS". Es PÚBLICA: la llama el formulario de mysterfoodie.com
 * (otro origen, por eso el CORS). Da de alta el negocio, crea su cuenta, guarda la solicitud
 * (visit_requests) y manda los correos (confirmación al negocio, aviso al Master Chef).
 * Protecciones: honeypot, validación, límite por IP y una sola solicitud abierta por negocio.
 */

const ORIGINS = ["https://mysterfoodie.com", "https://www.mysterfoodie.com"];
const MAX_PER_IP_PER_HOUR = 3;

function corsHeaders(req: NextRequest): Record<string, string> {
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

function json(req: NextRequest, body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export async function POST(req: NextRequest) {
  let p: Record<string, unknown>;
  try {
    p = await req.json();
  } catch {
    return json(req, { ok: false, error: "Solicitud inválida." }, 400);
  }

  // Honeypot: campo oculto que las personas no llenan. Se responde "ok" para no dar pistas.
  if (typeof p.website === "string" && p.website.trim() !== "") return json(req, { ok: true });

  const name = str(p.name, 120);
  const city = str(p.city, 80);
  const address = str(p.address, 200);
  const contactName = str(p.contactName, 100);
  const email = str(p.email, 254).toLowerCase();
  const phoneRaw = str(p.phone, 30);
  const instagram = str(p.instagram, 60).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  const message = str(p.message, 500) || null;
  const type = BUSINESS_TYPES.some((t) => t.value === p.type) ? (p.type as string) : "";
  const source = typeof p.source === "string" && REQUEST_SOURCES.has(p.source) ? p.source : "otra";

  if (name.length < 2) return json(req, { ok: false, error: "Escribe el nombre de tu negocio." }, 400);
  if (!type) return json(req, { ok: false, error: "Elige el tipo de negocio." }, 400);
  if (city.length < 2) return json(req, { ok: false, error: "Escribe la ciudad." }, 400);
  if (address.length < 5) return json(req, { ok: false, error: "Escribe la dirección (calle y colonia) para que el Foodie llegue." }, 400);
  if (contactName.length < 2) return json(req, { ok: false, error: "Escribe tu nombre." }, 400);
  if (email.length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(req, { ok: false, error: "Escribe un correo válido." }, 400);
  }
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return json(req, { ok: false, error: "Escribe tu WhatsApp o teléfono (10 dígitos)." }, 400);
  }
  const phone: string = phoneRaw;
  if (instagram.length < 2) return json(req, { ok: false, error: "Escribe el Instagram de tu negocio." }, 400);
  if (p.consent !== true) return json(req, { ok: false, error: "Acepta el aviso de privacidad para continuar." }, 400);

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return json(req, { ok: false, error: "No pudimos guardar tu solicitud. Intenta más tarde." }, 503);
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
  const ipHash = createHash("sha256").update(`mf-visita:${ip}`).digest("hex");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("visit_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return json(req, { ok: false, error: "Demasiados intentos. Inténtalo de nuevo en un rato." }, 429);
  }

  try {
    const out = await createVisitRequest(db, {
      name,
      type,
      city,
      address,
      contactName,
      email,
      phone,
      instagram: instagram || null,
      message,
      source,
      ipHash,
    });
    if (!out.ok) {
      console.error("solicitar-visita", out.error);
      return json(req, { ok: false, error: "No pudimos guardar tu solicitud. Intenta más tarde." }, 500);
    }
    // Respuesta idéntica si ya tenía una solicitud abierta (no se revela ni se reenvían correos).
    return json(req, { ok: true });
  } catch (err) {
    console.error("solicitar-visita", err instanceof Error ? err.message : err);
    return json(req, { ok: false, error: "No pudimos guardar tu solicitud. Intenta más tarde." }, 500);
  }
}
