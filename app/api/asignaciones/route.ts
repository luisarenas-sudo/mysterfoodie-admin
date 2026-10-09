import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { sendAssignmentEmail } from "@/lib/assignments";

type Body = {
  clientId?: string;
  assignedTo?: string;
  note?: string;
};

/**
 * Asignar una visita (negocio + Foodie) - solo admin (Master Chef) por
 * ahora, según lo confirmado. El Foodie recibe un correo y ve el
 * negocio en su lista de "visitas asignadas" en /nueva-visita.
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como admin para asignar visitas" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  const assignedTo = body.assignedTo?.trim();
  const note = body.note?.trim() || null;

  if (!clientId) {
    return NextResponse.json({ error: "Falta el negocio" }, { status: 400 });
  }
  if (!assignedTo) {
    return NextResponse.json({ error: "Falta el Foodie a asignar" }, { status: 400 });
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

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, city")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const { data: foodie } = await db
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", assignedTo)
    .maybeSingle();
  if (!foodie || foodie.role !== "agente") {
    return NextResponse.json({ error: "El usuario seleccionado no es un Foodie" }, { status: 400 });
  }

  const { data: assignment, error: insertError } = await db
    .from("visit_assignments")
    .insert({
      client_id: clientId,
      assigned_to: assignedTo,
      assigned_by: session.userId,
      note,
    })
    .select("id")
    .single();

  if (insertError || !assignment) {
    return NextResponse.json(
      { error: insertError?.message || "No se pudo crear la asignación" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const emailOutcome = await sendAssignmentEmail(db, {
    assignmentId: assignment.id,
    client: { name: client.name, type: client.type, city: client.city },
    foodie: { email: foodie.email, full_name: foodie.full_name },
    note,
    baseUrl,
  });

  return NextResponse.json({ ok: true, id: assignment.id, email: emailOutcome });
}
