import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

type Body = {
  email?: string;
  fullName?: string | null;
  role?: string;
  clientId?: string | null;
};

type PatchBody = {
  id?: string;
  role?: string;
};

export async function POST(req: NextRequest) {
  try {
    await requireRole("admin");
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

  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${baseUrl}/set-password`,
  });

  if (inviteError || !invited?.user) {
    return NextResponse.json(
      { error: inviteError?.message || "No se pudo invitar al usuario" },
      { status: 500 }
    );
  }

  const { error: profileError } = await db.from("profiles").upsert({
    id: invited.user.id,
    email,
    full_name: body.fullName || null,
    role,
    client_id: role === "cliente" ? body.clientId : null,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
