import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { createApplication, parseApplication } from "@/lib/aspirantes";

/**
 * Formulario PÚBLICO de ingreso de Shoppers (/unete/<alias>): quien invita comparte su QR/liga fija.
 * Todo es obligatorio. Protecciones: honeypot, validación estricta, límite por IP y una solicitud abierta por correo.
 */
const MAX_PER_IP_PER_HOUR = 4;

export async function POST(req: NextRequest) {
  let p: Record<string, unknown>;
  try {
    p = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }
  if (typeof p.website === "string" && p.website.trim() !== "") return NextResponse.json({ ok: true });

  const parsed = parseApplication(p);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "No pudimos guardar tu solicitud. Intenta más tarde." }, { status: 503 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
  const ipHash = createHash("sha256").update(`mf-unete:${ip}`).digest("hex");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from("shopper_applications").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Inténtalo de nuevo en un rato." }, { status: 429 });
  }

  try {
    const out = await createApplication(db, { ...parsed.value, ipHash });
    if (!out.ok) {
      console.error("unete", out.error);
      return NextResponse.json({ ok: false, error: out.error.includes("invitación") ? out.error : "No pudimos guardar tu solicitud. Intenta más tarde." }, { status: out.error.includes("invitación") ? 404 : 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("unete", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "No pudimos guardar tu solicitud. Intenta más tarde." }, { status: 500 });
  }
}
