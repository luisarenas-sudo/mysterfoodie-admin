import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, createSupabaseServerClient } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { sendSelfRemovalEmail } from "@/lib/accessEmails";

/**
 * Baja voluntaria: cualquier cuenta (Master Chef, Sibarita, Shopper o cliente) se
 * elimina a sí misma desde Perfil, tras la hoja de salida (calificación y
 * comentario). Reutiliza remove_user (supabase/acceso.sql): sus visitas y
 * asignaciones pasan a un Master Chef y sus negocios quedan sin dueño. La baja
 * entra como tarea pendiente para el Master Chef (/admin/bajas y Pendientes),
 * con la calificación y el comentario que dejó.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return NextResponse.json({ error: "Necesitas iniciar sesión" }, { status: 401 });
  }

  // La hoja de salida solo "pide" calificación y comentario: puede llegar vacía.
  let body: { rating?: unknown; comment?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rating = Number.isInteger(body.rating) && (body.rating as number) >= 1 && (body.rating as number) <= 5 ? (body.rating as number) : null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) || null : null;

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase no configurado" }, { status: 500 });
  }

  // Quién recibe sus visitas y asignaciones: el Master Chef más antiguo (que no sea él mismo).
  const { data: admins } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .neq("id", session.userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const newOwner = admins?.[0]?.id as string | undefined;
  if (!newOwner) {
    return NextResponse.json(
      {
        error:
          session.role === "admin"
            ? "Eres el único Master Chef. Nombra a otro Master Chef desde Usuarios antes de eliminar tu cuenta."
            : "No pudimos procesar la baja en este momento. Escríbenos a hola@mysterfoodie.com.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await db.rpc("remove_user", {
    p_user: session.userId,
    p_new_owner: newOwner,
    p_removed_by: session.userId,
  });
  if (error) {
    const missing = /remove_user|function/i.test(error.message) && /not exist|could not find|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "Falta correr supabase/acceso.sql en Supabase." : `No se pudo eliminar la cuenta: ${error.message}` },
      { status: 500 }
    );
  }

  // Guarda la hoja de salida en el registro de la baja (si aún no se corre
  // supabase/baja_voluntaria.sql, la baja ya se hizo y solo se omite este paso).
  const removalId = (data as { removal_id?: string } | null)?.removal_id;
  if (removalId) {
    await db.from("user_removals").update({ self_requested: true, exit_rating: rating, exit_comment: comment }).eq("id", removalId);
  }

  await sendSelfRemovalEmail({ to: session.email, name: session.fullName }).catch(() => undefined);

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // la sesión ya no es válida porque el usuario dejó de existir
  }

  return NextResponse.json({ ok: true });
}
