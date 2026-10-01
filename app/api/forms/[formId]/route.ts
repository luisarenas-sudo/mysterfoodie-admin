import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Elimina una visita (evaluación) y todo lo que depende de ella:
 * calificaciones por indicador, indicadores booleanos, confirmaciones
 * de correo y pagos del reporte completo. Si la visita venía de una
 * asignación a un Foodie (visit_assignments.completed_form_id), se
 * desvincula en vez de borrar la asignación, para no perder el
 * historial de quién tenía encargada esa visita.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { formId } = await params;

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no está configurado." },
      { status: 500 }
    );
  }

  const { data: form, error: formError } = await db
    .from("forms")
    .select("id")
    .eq("id", formId)
    .maybeSingle();

  if (formError) {
    return NextResponse.json({ error: formError.message }, { status: 500 });
  }
  if (!form) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  await db
    .from("visit_assignments")
    .update({ completed_form_id: null })
    .eq("completed_form_id", formId);

  await db.from("form_ratings").delete().eq("form_id", formId);
  await db.from("form_flags").delete().eq("form_id", formId);
  await db.from("email_confirmations").delete().eq("form_id", formId);
  await db.from("report_payments").delete().eq("form_id", formId);
  await db.from("consultation_bookings").delete().eq("form_id", formId);

  const { error: deleteError } = await db.from("forms").delete().eq("id", formId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
