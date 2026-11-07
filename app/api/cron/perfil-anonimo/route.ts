import { cronAuthorized } from "@/lib/cronAuth";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendDuePerfilInvites } from "@/lib/perfilInvitacion";

/**
 * Correo a los perfiles nuevos del equipo para que llenen su perfil anónimo (niveles ID y Passport), una sola vez.
 * Una vez al día (11:00 am CDMX). Protegido con CRON_SECRET (header `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const out = await sendDuePerfilInvites(getSupabaseServiceClient(), baseUrl);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
