import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { sendAssignmentEmail } from "@/lib/assignments";

/**
 * Asignar (o reasignar) a un Foodie una visita ya creada -- por ahora las
 * visitas de los planes mensuales, que nacen sin Foodie. Solo Master Chef.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como admin" }, { status: 401 });
  }
  const { id } = await params;

  let body: { assignedTo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const assignedTo = body.assignedTo?.trim();
  if (!assignedTo) return NextResponse.json({ error: "Falta el Foodie a asignar" }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: assignment } = await db
    .from("visit_assignments")
    .select("id, client_id, status, note")
    .eq("id", id)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  if (assignment.status !== "pendiente") {
    return NextResponse.json({ error: "Esta visita ya no está pendiente" }, { status: 400 });
  }

  const { data: foodie } = await db.from("profiles").select("id, email, full_name, role").eq("id", assignedTo).maybeSingle();
  if (!foodie || foodie.role !== "agente") {
    return NextResponse.json({ error: "El usuario seleccionado no es un Foodie" }, { status: 400 });
  }

  const { error } = await db
    .from("visit_assignments")
    .update({ assigned_to: assignedTo, assigned_by: session.userId, notified_at: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: client } = await db.from("clients").select("name, type, city").eq("id", assignment.client_id).maybeSingle();
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const email = client
    ? await sendAssignmentEmail(db, {
        assignmentId: id,
        client: { name: client.name, type: client.type, city: client.city },
        foodie: { email: foodie.email, full_name: foodie.full_name },
        note: (assignment.note as string | null) ?? null,
        baseUrl,
      })
    : null;

  return NextResponse.json({ ok: true, email });
}
