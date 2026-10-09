import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendDueTicketEmails } from "@/lib/ticket";

/**
 * Manda el aviso del ticket de consumo a los negocios cuya visita recibió su
 * ticket hace 3 días o más y todavía no se les avisa. Una vez al día basta
 * (por ejemplo a las 9am CDMX). Se protege con CRON_SECRET igual que los demás
 * crons: header `x-cron-secret`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const out = await sendDueTicketEmails(getSupabaseServiceClient(), baseUrl);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
