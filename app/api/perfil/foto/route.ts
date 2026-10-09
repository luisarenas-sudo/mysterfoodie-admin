import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sniffImage } from "@/lib/ticket";

/**
 * Foto de perfil propia (en vez de las iniciales o la foto de Google).
 *  - POST (multipart, campo "file"): sube la foto ya recortada y reducida desde el navegador.
 *  - DELETE: quita la foto y deja las iniciales.
 * En ambos casos avatar_locked = true: así el login con Google no la vuelve a pisar.
 */
const BUCKET = "avatars";
const MAX_BYTES = 1.5 * 1024 * 1024;

async function clearOldFiles(db: ReturnType<typeof getSupabaseServiceClient>, userId: string, keep?: string) {
  const { data } = await db.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await db.storage.from(BUCKET).remove(old);
}

export async function POST(req: NextRequest) {
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita", "cliente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "No pudimos leer la foto. Intenta de nuevo." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "Elige una foto." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La foto pesa demasiado. Prueba con otra." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return NextResponse.json({ error: "Sube la foto como JPG o PNG." }, { status: 415 });

  const db = getSupabaseServiceClient();
  const path = `${profile.userId}/${Date.now()}.${kind.ext}`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, { contentType: kind.mime, upsert: false });
  if (upErr) return NextResponse.json({ error: `No se pudo guardar la foto: ${upErr.message}` }, { status: 500 });

  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await db.from("profiles").update({ avatar_url: url, avatar_locked: true }).eq("id", profile.userId);
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await clearOldFiles(db, profile.userId, path);
  return NextResponse.json({ ok: true, avatarUrl: url });
}

export async function DELETE() {
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita", "cliente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const db = getSupabaseServiceClient();
  const { error } = await db.from("profiles").update({ avatar_url: null, avatar_locked: true }).eq("id", profile.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearOldFiles(db, profile.userId);
  return NextResponse.json({ ok: true });
}
