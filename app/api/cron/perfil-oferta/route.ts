import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendDuePerfilOffers } from "@/lib/perfilOferta";

/**
 * "Destapa el perfil de tu MysterFoodie": correo a los negocios con reporte completo, 2 días después de desbloquearlo.
 * Una vez al día (por ejemplo 10am CDMX). Protegido con CRON_SECRET (header `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
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
