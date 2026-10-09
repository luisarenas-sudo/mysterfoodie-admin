import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { syncActivePlans } from "@/lib/plans";

/**
 * Genera las visitas y el periodo de cobro del mes en curso para todos los
 * planes activos. Es idempotente, así que puede correr a diario sin riesgo.
 * Mismo mecanismo que los otros crons: un Cron Job de Supabase (Database >
 * Cron) apunta aquí (recomendado: diario, 6:00 am CDMX) con el header
 * `x-cron-secret: ${CRON_SECRET}`. Aunque el cron falle, abrir /planes o el
 * negocio también genera lo que falte.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const plans = await syncActivePlans(getSupabaseServiceClient(), { baseUrl });
  return NextResponse.json({ ok: true, plans });
}
