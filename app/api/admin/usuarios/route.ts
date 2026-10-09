import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/brand";
import { accessUrl, issueAccessToken } from "@/lib/accessTokens";
import { sendInviteEmail, sendRemovalEmail } from "@/lib/accessEmails";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/** Crea el token (5 días) y manda la invitación con link + código. */
async function sendInvitation(
  db: Db,
  p: { userId: string; email: string; name: string | null; role: string; clientId: string | null; baseUrl: string }
) {
  let businessName: string | null = null;
  if (p.role === "cliente" && p.clientId) {
    const { data } = await db.from("clients").select("name").eq("id", p.clientId).maybeSingle();
    businessName = (data?.name as string | undefined) ?? null;
  }
  const { token, code } = await issueAccessToken(db, { userId: p.userId, email: p.email, purpose: "invite" });
  return sendInviteEmail({
    to: p.email,
    name: p.name,
    roleLabel: ROLE_LABELS[p.role] ?? p.role,
    businessName,
    url: accessUrl(p.baseUrl, token),
    code,
    baseUrl: p.baseUrl,
  });
}

function emailNote(status: string): string | null {
  if (status === "sent") return null;
  if (status === "skipped_no_api_key") return "El correo no se envió porque Resend no está configurado.";
  return "El usuario quedó creado, pero el correo no se pudo enviar. Usa «Reenviar invitación».";
}

type Body = {
  email?: string;
  fullName?: string | null;
  role?: string;
  clientId?: string | null;
};

type PatchBody = {
  id?: string;
  role?: string;
  resendInvite?: boolean;
};

export async function POST(req: NextRequest) {
  let requester;
  try {
    requester = await requireRole("admin", "sibarita");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!email) {
    return NextResponse.json({ error: "Falta el correo" }, { status: 400 });
  }
  if (!role || !["admin", "agente", "cliente", "sibarita"].includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  // Un Sibarita solo puede invitar Foodies (agente); admin puede invitar
  // cualquier rol. Esto refuerza del lado del servidor lo que ya limita
  // la UI de MobileInviteForm con su prop allowedRoles.
  if (requester.role === "sibarita" && role !== "agente") {
    return NextResponse.json(
      { error: "Como Sibarita solo puedes invitar Foodies" },
      { status: 403 }
    );
  }
  if (role === "cliente" && !body.clientId) {
    return NextResponse.json(
      { error: "Selecciona a qué negocio pertenece este usuario" },
      { status: 400 }
    );
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

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const fullName = body.fullName?.trim() || null;
  const clientId = role === "cliente" ? body.clientId ?? null : null;

  // ¿Ya existe? Si nunca ha entrado, se trata como reenvío de la invitación;
  // si ya tiene cuenta activa, no se toca.
  const { data: existing } = await db.from("profiles").select("id, role").eq("email", email).maybeSingle();
  let userId: string;
  if (existing) {
    if (requester.role === "sibarita" && existing.role !== "agente") {
      return NextResponse.json({ error: "Ese correo ya pertenece a otro usuario" }, { status: 403 });
    }
    const { data: au } = await db.auth.admin.getUserById(existing.id as string);
    if (au?.user?.last_sign_in_at) {
      return NextResponse.json(
        { error: "Ese correo ya tiene una cuenta activa. Si no recuerda su contraseña, puede usar «¿Olvidaste tu contraseña?» en el inicio de sesión." },
        { status: 409 }
      );
    }
    userId = existing.id as string;
  } else {
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (createError || !created?.user) {
      return NextResponse.json({ error: createError?.message || "No se pudo crear al usuario" }, { status: 500 });
    }
    userId = created.user.id;
  }

  const { error: profileError } = await db.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    client_id: clientId,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const outcome = await sendInvitation(db, { userId, email, name: fullName, role, clientId, baseUrl });
  return NextResponse.json({ ok: true, emailStatus: outcome.status, warning: emailNote(outcome.status), resent: Boolean(existing) });
}

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { id, role } = body;

  if (body.resendInvite) {
    if (!id) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    let rdb;
    try {
      rdb = getSupabaseServiceClient();
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase no configurado" }, { status: 500 });
    }
    const { data: target } = await rdb.from("profiles").select("id, email, full_name, role, client_id").eq("id", id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const { data: au } = await rdb.auth.admin.getUserById(id);
    if (au?.user?.last_sign_in_at) {
      return NextResponse.json({ error: "Esta persona ya activó su cuenta." }, { status: 409 });
    }
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const outcome = await sendInvitation(rdb, {
      userId: id,
      email: target.email as string,
      name: target.full_name as string | null,
      role: target.role as string,
      clientId: target.client_id as string | null,
      baseUrl,
    });
    if (outcome.status !== "sent") {
      return NextResponse.json({ error: emailNote(outcome.status) }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!id || !role || !["admin", "agente", "cliente", "sibarita"].includes(role)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (id === session.userId) {
    return NextResponse.json(
      { error: "No puedes cambiar tu propio rol" },
      { status: 400 }
    );
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

  const { data: target } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { error } = await db.from("profiles").update({ role }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Baja de un usuario (solo Master Chef): las visitas y asignaciones pasan a
 * quien da de baja; los negocios que había dado de alta quedan SIN DUEÑO para
 * que Master Chef decida uno por uno (/admin/bajas, y aparece en Pendientes).
 * Todo ocurre en una sola transacción (función remove_user, ver
 * supabase/acceso.sql); después se le avisa por correo.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  if (id === session.userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase no configurado" }, { status: 500 });
  }

  const { data: target } = await db.from("profiles").select("id, email, full_name, role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { data, error } = await db.rpc("remove_user", {
    p_user: id,
    p_new_owner: session.userId,
    p_removed_by: session.userId,
  });
  if (error) {
    const missing = /remove_user|function/i.test(error.message) && /not exist|could not find|schema cache/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "Falta correr supabase/acceso.sql en Supabase antes de poder eliminar usuarios."
          : `No se pudo eliminar al usuario: ${error.message}`,
      },
      { status: 500 }
    );
  }

  const moved = ((data as { moved?: Record<string, string[]> } | null)?.moved ?? {}) as Record<string, string[]>;
  const outcome = await sendRemovalEmail({ to: target.email as string, name: target.full_name as string | null });

  return NextResponse.json({
    ok: true,
    emailStatus: outcome.status,
    businessesWithoutOwner: (moved["clients.created_by"] ?? []).length,
    visits: (moved["forms.created_by"] ?? []).length,
  });
}
