import { cronAuthorized } from "@/lib/cronAuth";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendDuePerfilOffers } from "@/lib/perfilOferta";

/**
 * "Destapa el perfil de tu MysterFoodie": correo a los negocios con reporte completo, 2 días después de desbloquearlo.
 * Una vez al día (por ejemplo 10am CDMX). Protegido con CRON_SECRET (header `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const out = await sendDuePerfilOffers(getSupabaseServiceClient(), baseUrl);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
