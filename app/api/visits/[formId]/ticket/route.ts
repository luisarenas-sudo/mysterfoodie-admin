import { NextRequest, NextResponse } from "next/server";
import { requireRole, type SessionProfile } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { TICKET_BUCKET, TICKET_MAX_BYTES, signedTicketUrl, sniffImage } from "@/lib/ticket";

/**
 * Ticket de consumo de una visita ya terminada y enviada.
 *  - POST (multipart, campo "file"): sube o reemplaza la foto. La primera vez
 *    marca ticket_uploaded_at (de ahí cuentan los 3 días del aviso al negocio);
 *    reemplazarla no reinicia el reloj ni vuelve a mandar el aviso.
 *  - DELETE: quita la foto (si el aviso aún no sale, se cancela).
 *  - GET: redirige a una URL firmada de 5 minutos (solo personal autorizado).
 * Puede tocarlo el Master Chef o quien levantó la visita.
 */

async function authorize(formId: string): Promise<
  | { ok: true; profile: SessionProfile; form: { id: string; created_by: string | null; ticket_photo_path: string | null; ticket_uploaded_at: string | null } }
  | { ok: false; res: NextResponse }
> {
  let profile: SessionProfile;
  try {
    profile = await requireRole("admin", "agente", "sibarita");
  } catch {
    return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, created_by, ticket_photo_path, ticket_uploaded_at")
    .eq("id", formId)
    .maybeSingle();
  if (!form) return { ok: false, res: NextResponse.json({ error: "Visita no encontrada" }, { status: 404 }) };
  if (profile.role !== "admin" && form.created_by !== profile.userId) {
    return { ok: false, res: NextResponse.json({ error: "Esta visita no es tuya" }, { status: 403 }) };
  }
  return { ok: true, profile, form };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const auth = await authorize(formId);
  if (!auth.ok) return auth.res;

  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "No pudimos leer la foto. Intenta de nuevo." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "Elige una foto del ticket." }, { status: 400 });
  if (file.size > TICKET_MAX_BYTES) {
    return NextResponse.json({ error: "La foto pesa demasiado (máximo 4 MB). Prueba con otra." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return NextResponse.json({ error: "Sube la foto como JPG o PNG." }, { status: 415 });

  const db = getSupabaseServiceClient();
  const path = `${formId}/${Date.now()}.${kind.ext}`;
  const { error: upErr } = await db.storage.from(TICKET_BUCKET).upload(path, buf, { contentType: kind.mime, upsert: false });
  if (upErr) return NextResponse.json({ error: `No se pudo guardar la foto: ${upErr.message}` }, { status: 500 });

  const patch: Record<string, string> = { ticket_photo_path: path };
  if (!auth.form.ticket_uploaded_at) patch.ticket_uploaded_at = new Date().toISOString();
  const { error: dbErr } = await db.from("forms").update(patch).eq("id", formId);
  if (dbErr) {
    await db.storage.from(TICKET_BUCKET).remove([path]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // La foto anterior ya no sirve.
  if (auth.form.ticket_photo_path) await db.storage.from(TICKET_BUCKET).remove([auth.form.ticket_photo_path]);

  return NextResponse.json({ ok: true, uploadedAt: patch.ticket_uploaded_at ?? auth.form.ticket_uploaded_at });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const auth = await authorize(formId);
  if (!auth.ok) return auth.res;

  const db = getSupabaseServiceClient();
  if (auth.form.ticket_photo_path) await db.storage.from(TICKET_BUCKET).remove([auth.form.ticket_photo_path]);
  const { error } = await db.from("forms").update({ ticket_photo_path: null, ticket_uploaded_at: null }).eq("id", formId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const auth = await authorize(formId);
  if (!auth.ok) return auth.res;
  const db = getSupabaseServiceClient();
  const url = await signedTicketUrl(db, auth.form.ticket_photo_path);
  if (!url) return NextResponse.json({ error: "Esta visita no tiene ticket." }, { status: 404 });
  return NextResponse.redirect(url);
}
