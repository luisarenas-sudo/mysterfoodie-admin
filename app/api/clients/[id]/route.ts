import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Elimina un negocio y todo lo que depende de él: sus visitas (y lo
 * que depende de cada visita - calificaciones, indicadores, correos,
 * pagos del reporte), sus asignaciones a Foodies y sus citas de
 * asesoría agendadas. Se borra en este orden específico para nunca
 * violar una foreign key (primero lo que depende de "forms", luego
 * "forms", luego lo que depende directo de "clients", y al final
 * "clients").
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no está configurado." },
      { status: 500 }
    );
  }

  const { data: client, error: clientError } = await db
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const { data: forms } = await db.from("forms").select("id").eq("client_id", id);
  const formIds = (forms || []).map((f) => f.id);

  if (formIds.length > 0) {
    await db.from("form_ratings").delete().in("form_id", formIds);
    await db.from("form_flags").delete().in("form_id", formIds);
    await db.from("email_confirmations").delete().in("form_id", formIds);
    await db.from("report_payments").delete().in("form_id", formIds);
    await db.from("consultation_bookings").delete().in("form_id", formIds);
  }

  // visit_assignments puede apuntar a un form ya borrado via
  // completed_form_id; se borra junto con el negocio (no tiene sentido
  // dejar una asignación de un negocio que ya no existe).
  await db.from("visit_assignments").delete().eq("client_id", id);
  await db.from("consultation_bookings").delete().eq("client_id", id);

  if (formIds.length > 0) {
    const { error: formsDeleteError } = await db.from("forms").delete().in("id", formIds);
    if (formsDeleteError) {
      return NextResponse.json({ error: formsDeleteError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await db.from("clients").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
