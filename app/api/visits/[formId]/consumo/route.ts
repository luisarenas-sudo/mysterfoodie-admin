import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Total del consumo (MXN) y cuántas personas fueron en la visita. Se captura antes de subir la foto del ticket.
 * PATCH { consumptionTotal: number | null, partySize: number | null }. Lo puede tocar el Master Chef o quien levantó la visita.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { consumptionTotal?: unknown; partySize?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const patch: Record<string, number | null> = {};
  if ("consumptionTotal" in body) {
    if (body.consumptionTotal === null || body.consumptionTotal === "") patch.consumption_total = null;
    else {
      const n = Number(body.consumptionTotal);
      if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) {
        return NextResponse.json({ error: "El total debe ser un monto entre 0 y 999,999." }, { status: 400 });
      }
      patch.consumption_total = Math.round(n * 100) / 100;
    }
  }
  if ("partySize" in body) {
    if (body.partySize === null || body.partySize === "") patch.party_size = null;
    else {
      const n = Number(body.partySize);
      if (!Number.isInteger(n) || n < 1 || n > 30) {
        return NextResponse.json({ error: "Las personas deben ser de 1 a 30." }, { status: 400 });
      }
      patch.party_size = n;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que guardar" }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: form } = await db.from("forms").select("id, created_by").eq("id", formId).maybeSingle();
  if (!form) return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  if (profile.role !== "admin" && form.created_by !== profile.userId) {
    return NextResponse.json({ error: "Esta visita no es tuya" }, { status: 403 });
  }

  const { error } = await db.from("forms").update(patch).eq("id", formId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
