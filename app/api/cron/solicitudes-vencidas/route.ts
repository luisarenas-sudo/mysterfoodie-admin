import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { syncVisitRequests } from "@/lib/visitRequests";

/**
 * Revisa las solicitudes de visita gratis: marca las que ya tienen visita y a las que llegaron
 * a los 5 días sin visita les manda el correo "por el momento no contamos con un foodie..."
 * (una sola vez). Un Cron Job de Supabase la llama cada hora con `x-cron-secret: ${CRON_SECRET}`
 * (ver supabase/crons.sql).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await syncVisitRequests(getSupabaseServiceClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
