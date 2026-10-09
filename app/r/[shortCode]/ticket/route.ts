import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { signedTicketUrl } from "@/lib/ticket";

export const dynamic = "force-dynamic";

/**
 * Ticket de consumo en el reporte público: solo se entrega cuando el reporte
 * completo ya está desbloqueado (pagado o de plan). Redirige a una URL
 * firmada de 60 segundos, así el link nunca queda circulando.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("ticket_photo_path, report_unlocked_at")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form || !form.report_unlocked_at || !form.ticket_photo_path) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }
  const url = await signedTicketUrl(db, form.ticket_photo_path, 60);
  if (!url) return NextResponse.json({ error: "No disponible" }, { status: 404 });
  return NextResponse.redirect(url);
}
