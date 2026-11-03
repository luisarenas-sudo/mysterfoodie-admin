import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";

/**
 * Estado de los correos de una visita recién guardada. Al guardar, los correos salen en
 * segundo plano (el PDF y Resend ya no hacen esperar al MysterFoodie); la pantalla de
 * confirmación consulta aquí hasta que lleguen todos los esperados.
 *   ?expected=N  -> cuántos correos se esperan (1 normal, 2 en demo gratis: reporte + comprobante)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }

  const { formId } = await params;
  const expected = Math.max(1, Math.min(5, Number(req.nextUrl.searchParams.get("expected")) || 1));

  const db = getSupabaseServiceClient();
  const { data: rows } = await db
    .from("email_confirmations")
    .select("status, error, recipient_email, sent_at")
    .eq("form_id", formId)
    .order("sent_at", { ascending: true });

  const list = rows ?? [];
  const failed = list.find((r) => r.status === "failed" || r.status === "skipped_no_api_key");
  if (failed) {
    return NextResponse.json({ status: failed.status, error: failed.error, to: failed.recipient_email });
  }
  if (list.length >= expected) {
    return NextResponse.json({ status: "sent", to: list[0].recipient_email });
  }
  return NextResponse.json({ status: "queued", to: list[0]?.recipient_email ?? null });
}
