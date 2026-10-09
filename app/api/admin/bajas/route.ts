import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Revisión de las bajas (solo Master Chef): asignar el dueño de un negocio que
 * se quedó sin dueño, eliminar ese negocio, o cerrar la revisión.
 */
type Body =
  | { action: "assign"; clientId: string; ownerId: string | null }
  | { action: "deleteClient"; clientId: string }
  | { action: "resolve"; removalId: string };

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const db = getSupabaseServiceClient();

  if (body.action === "assign") {
    if (!body.clientId) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    if (body.ownerId) {
      const { data: owner } = await db.from("profiles").select("id, role").eq("id", body.ownerId).maybeSingle();
      if (!owner || owner.role === "cliente") {
        return NextResponse.json({ error: "Ese usuario no puede ser dueño de un negocio" }, { status: 400 });
      }
    }
    const { error } = await db.from("clients").update({ created_by: body.ownerId }).eq("id", body.clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deleteClient") {
    if (!body.clientId) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const { data: plans } = await db
      .from("client_plans")
      .select("id")
      .eq("client_id", body.clientId)
      .neq("status", "cancelado")
      .limit(1);
    if (plans && plans.length > 0) {
      return NextResponse.json({ error: "Este negocio tiene un plan activo: cancélalo primero desde su ficha." }, { status: 409 });
    }
    // Una cuenta de cliente ligada al negocio se queda sin negocio (profiles.client_id es on delete set null).
    const { error } = await db.from("clients").delete().eq("id", body.clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resolve") {
    if (!body.removalId) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const { error } = await db
      .from("user_removals")
      .update({ status: "revisada", reviewed_at: new Date().toISOString() })
      .eq("id", body.removalId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    void session;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
