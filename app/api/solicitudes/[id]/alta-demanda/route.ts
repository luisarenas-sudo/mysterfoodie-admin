import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { declineForHighDemand } from "@/lib/visitRequests";

/**
 * El Master Chef decide no hacer esta visita gratis: se avisa al negocio que el volumen de solicitudes es más alto
 * de lo normal para nuestros MysterFoodies y se le muestran los paquetes.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como admin" }, { status: 401 });
  }
  const { id } = await params;
  const out = await declineForHighDemand(getSupabaseServiceClient(), id);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, email: out.email });
}
