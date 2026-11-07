import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isValidMonth } from "@/lib/months";
import { generateMonthReport, monthIsClosed, setPayoutPaid } from "@/lib/payouts";
import { sendMonthlyReportEmail } from "@/lib/payoutEmail";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Master Chef: reporte mensual de pagos.
 *  { action: "pagado", month, personId, paid }  -> palomita de "ya le pagué"
 *  { action: "generar", month }                 -> genera o recalcula el mes (no toca lo ya pagado)
 *  { action: "reenviar", month }                -> vuelve a mandar el correo del mes
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "admin-pagos", 120, 600000);
  if (limited) return limited;
  let me;
  try {
    me = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { action?: unknown; month?: unknown; personId?: unknown; paid?: unknown } | null;
  const month = typeof body?.month === "string" ? body.month : "";
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mes no válido" }, { status: 400 });
  const db = getSupabaseServiceClient();
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  if (body?.action === "pagado") {
    const personId = typeof body.personId === "string" ? body.personId : "";
    if (!personId) return NextResponse.json({ error: "Falta la persona" }, { status: 400 });
    const ok = await setPayoutPaid(db, { month, personId, paid: body.paid === true, by: me.userId });
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se pudo actualizar" }, { status: 404 });
  }
  if (body?.action === "generar") {
    if (!monthIsClosed(month)) return NextResponse.json({ error: "El mes todavía no termina" }, { status: 400 });
    const { report } = await generateMonthReport(month);
    return NextResponse.json({ ok: true, toPay: report.toPay });
  }
  if (body?.action === "reenviar") {
    const out = await sendMonthlyReportEmail(db, month, baseUrl);
    return out.sent > 0 ? NextResponse.json({ ok: true, ...out }) : NextResponse.json({ error: "No se pudo enviar el correo" }, { status: 502 });
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
