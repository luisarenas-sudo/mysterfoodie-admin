import { rateLimit } from "@/lib/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { recordReportView } from "@/lib/reportTracking";

/**
 * Lo llama la página pública del reporte (/r/<código>) al abrirse en el
 * navegador. Como solo lo dispara el JavaScript de la página, los
 * rastreadores de vista previa de Instagram o WhatsApp no cuentan; además se
 * ignoran las aperturas de quien tiene sesión del equipo (Master Chef,
 * sibaritas y Shoppers revisando el reporte).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "visto", 60, 600000);
  if (limited) return limited;
  let shortCode = "";
  try {
    const body = (await req.json()) as { shortCode?: unknown };
    shortCode = typeof body.shortCode === "string" ? body.shortCode.trim() : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(shortCode)) return NextResponse.json({ ok: false }, { status: 400 });

  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp|headless/i.test(ua)) {
    return NextResponse.json({ ok: true, counted: false });
  }

  try {
    const me = await getSessionProfile();
    if (me && me.role !== "cliente") return NextResponse.json({ ok: true, counted: false });
    const out = await recordReportView(shortCode);
    return NextResponse.json({ ok: true, counted: out.counted });
  } catch (err) {
    console.error("Seguimiento del reporte:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
