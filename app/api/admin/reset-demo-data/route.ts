import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/**
 * Boton de un solo uso para admin (ver /perfil): borra TODOS los
 * negocios y visitas que haya en este momento -- a peticion explicita
 * de Luis, para arrancar en limpio justo antes de usar la app en
 * serio. No crea nada de relleno (version anterior sembraba 3
 * negocios de ejemplo; Luis pidio quitar eso).
 *
 * Borra en el mismo orden "a mano" que ya usa DELETE
 * /api/clients/[id] (la base no tiene cascada real en produccion,
 * aunque supabase/schema.sql diga "on delete cascade" en varias
 * tablas -- ver ese endpoint para la referencia de este orden):
 * primero lo que depende de "forms", luego "forms", luego lo que
 * depende directo de "clients", y al final "clients".
 *
 * Irreversible -- por eso vive detras de DeleteButton (confirmacion
 * de dos pasos) en vez de ser un boton de un solo clic.
 */
export async function DELETE() {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  const { data: allForms } = await db.from("forms").select("id");
  const allFormIds = (allForms || []).map((f) => f.id);

  if (allFormIds.length > 0) {
    await db.from("form_ratings").delete().in("form_id", allFormIds);
    await db.from("form_flags").delete().in("form_id", allFormIds);
    await db.from("email_confirmations").delete().in("form_id", allFormIds);
    await db.from("report_payments").delete().in("form_id", allFormIds);
    await db.from("consultation_bookings").delete().in("form_id", allFormIds);
  }

  await db.from("visit_assignments").delete().not("id", "is", null);
  await db.from("consultation_bookings").delete().not("id", "is", null);

  if (allFormIds.length > 0) {
    const { error: formsDeleteError } = await db.from("forms").delete().in("id", allFormIds);
    if (formsDeleteError) {
      return NextResponse.json({ error: formsDeleteError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await db.from("clients").delete().not("id", "is", null);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
