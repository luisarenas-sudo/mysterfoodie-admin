import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendHtmlEmail } from "@/lib/email";
import { academyConfirmationEmail } from "@/lib/academyEmail";

/**
 * Lista de espera de la Foodie Academy. Es PÚBLICA: la llama el formulario de
 * mysterfoodie.com (otro origen, por eso el CORS). Guarda el correo en
 * academy_waitlist (supabase/foodie_academy.sql) y manda el correo de
 * confirmación UNA sola vez por correo. Protecciones: honeypot, validación,
 * límite por IP y respuesta genérica (no revela si el correo ya estaba).
 */

const ORIGINS = ["https://mysterfoodie.com", "https://www.mysterfoodie.com"];
const MAX_PER_IP_PER_HOUR = 5;
const SOURCES = new Set(["metodologia", "nosotros", "footer", "servicios", "inicio", "otra"]);

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

export async function POST(req: NextRequest) {
  let payload: { email?: unknown; source?: unknown; website?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, error: "Solicitud inválida." }, 400);
  }

  // Honeypot: un campo oculto que las personas no llenan. Se responde "ok" para no dar pistas.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    return json(req, { ok: true });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (email.length < 6 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(req, { ok: false, error: "Escribe un correo válido." }, 400);
  }
  const source = typeof payload.source === "string" && SOURCES.has(payload.source) ? payload.source : "otra";

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return json(req, { ok: false, error: "No pudimos guardar tu correo. Intenta más tarde." }, 503);
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
  const ipHash = createHash("sha256").update(`mf-academy:${ip}`).digest("hex");

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("academy_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return json(req, { ok: false, error: "Demasiados intentos. Inténtalo de nuevo en un rato." }, 429);
  }

  const { data: row, error } = await db
    .from("academy_waitlist")
    .insert({ email, source, ip_hash: ipHash })
    .select("id")
    .single();

  if (error) {
    // 23505 = el correo ya estaba en la lista: se responde igual, sin reenviar el correo.
    if (error.code === "23505") return json(req, { ok: true });
    console.error("academy insert", error.message);
    return json(req, { ok: false, error: "No pudimos guardar tu correo. Intenta más tarde." }, 500);
  }

  const mail = academyConfirmationEmail();
  const outcome = await sendHtmlEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  if (outcome.status === "sent") {
    await db.from("academy_waitlist").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", row.id);
  } else {
    console.error("academy email", outcome.status, "error" in outcome ? outcome.error : "");
  }

  return json(req, { ok: true });
}
