import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendDueReportReminders } from "@/lib/reportReminders";

/**
 * Recordatorios del reporte (día 2 y día 7) a negocios que no lo han comprado. Una vez al día (10:00 am CDMX). Se protege
 * con CRON_SECRET igual que los demás crons: header `x-cron-secret`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const out = await sendDueReportReminders(getSupabaseServiceClient(), baseUrl);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
