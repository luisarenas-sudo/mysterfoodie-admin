import { cronAuthorized } from "@/lib/cronAuth";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { generateMonthReport, getReport, previousMonthCdmx } from "@/lib/payouts";
import { sendMonthlyReportEmail } from "@/lib/payoutEmail";

/**
 * Cierre mensual: el día 1 (9:00 am CDMX; los días 2 y 3 solo reintentan) genera el reporte de ventas y pagos del mes que terminó
 * y se lo manda por correo al Master Chef. Idempotente: si el correo de ese mes ya salió, no hace nada.
 * Protegido con CRON_SECRET (header `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const db = getSupabaseServiceClient();
    const month = previousMonthCdmx();
    const existing = await getReport(db, month);
    if (existing?.emailSentAt) return NextResponse.json({ ok: true, month, skipped: "ya enviado" });
    if (!existing) await generateMonthReport(month);
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const out = await sendMonthlyReportEmail(db, month, baseUrl);
    return NextResponse.json({ ok: true, month, ...out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
