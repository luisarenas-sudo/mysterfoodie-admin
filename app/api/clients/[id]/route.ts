import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { BUSINESS_TYPES } from "@/lib/categories";

type PatchBody = {
  name?: string;
  type?: string;
  city?: string;
  contactName?: string;
  phone?: string;
  instagramHandle?: string;
  email?: string;
  autoEmailEnabled?: boolean;
  hasWebsite?: boolean;
  hasGoogleBusiness?: boolean;
  hasProfessionalPhotos?: boolean;
  hasReels?: boolean;
};

/**
 * Edita los datos de un negocio (nombre, tipo, contacto, banderas de
 * oportunidad). Antes solo se podía crear o borrar: un error de captura
 * en el correo o el Instagram obligaba a borrar el negocio y sus visitas.
 * Admin edita cualquiera; un Sibarita solo los negocios que él dio de alta.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("admin", "sibarita");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Falta el nombre del negocio" }, { status: 400 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no está configurado." },
      { status: 500 }
    );
  }

  const { data: existing } = await db.from("clients").select("id, created_by").eq("id", id).maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }
  if (session.role === "sibarita" && existing.created_by !== session.userId) {
    return NextResponse.json({ error: "Solo puedes editar los negocios que diste de alta" }, { status: 403 });
  }

  const type = BUSINESS_TYPES.some((t) => t.value === body.type) ? body.type : "restaurante";

  const { error } = await db
    .from("clients")
    .update({
      name,
      type,
      city: body.city?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      phone: body.phone?.trim() || null,
      instagram_handle: body.instagramHandle?.trim().replace(/^@/, "") || null,
      email: body.email?.trim() || null,
      auto_email_enabled: body.autoEmailEnabled ?? true,
      has_website: Boolean(body.hasWebsite),
      has_google_business: Boolean(body.hasGoogleBusiness),
      has_professional_photos: Boolean(body.hasProfessionalPhotos),
      has_reels: Boolean(body.hasReels),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id });
}

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
