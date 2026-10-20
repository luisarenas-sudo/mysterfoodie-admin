import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/** Master Chef: marca como pagadas todas las ganancias pendientes del perfil anónimo de un MysterFoodie. POST { mysterfoodieId } */
export async function POST(req: NextRequest) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { mysterfoodieId?: unknown } | null;
  const id = typeof body?.mysterfoodieId === "string" ? body.mysterfoodieId : "";
  if (!id) return NextResponse.json({ error: "Falta la persona" }, { status: 400 });
  const { data, error } = await getSupabaseServiceClient()
    .from("profile_earnings")
    .update({ status: "pagado", paid_at: new Date().toISOString() })
    .eq("mysterfoodie_id", id)
    .eq("status", "pendiente")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paid: data?.length ?? 0 });
}
