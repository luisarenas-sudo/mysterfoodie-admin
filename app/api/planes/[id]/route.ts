import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { currentMonthCdmx, isValidMonth } from "@/lib/earnings";
import { ensurePlanMonth, mapPlan } from "@/lib/plans";
import { sendAssignmentEmail } from "@/lib/assignments";
import { sendTicketForPlan } from "@/lib/planTicket";

type Body = {
  status?: "activo" | "pausado" | "cancelado";
  defaultFoodieId?: string | null;
  markPaid?: { month?: string; paid?: boolean };
  resendTicket?: boolean;
  ticketEmail?: string;
};

/** Administrar un plan (Master Chef): estatus, Foodie por default, cobro del mes y reenviar el ticket. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como admin" }, { status: 401 });
  }
  const { id } = await params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const db = getSupabaseServiceClient();
  const { data: row } = await db.from("client_plans").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  let plan = mapPlan(row);
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  if (body.markPaid) {
    const month = body.markPaid.month;
    if (!isValidMonth(month)) return NextResponse.json({ error: "Mes no válido" }, { status: 400 });
    // En una contratación de varias sucursales el cobro es uno solo: se marca para todas.
    let planIds = [id];
    if (plan.groupId) {
      const { data: siblings } = await db.from("client_plans").select("id").eq("group_id", plan.groupId);
      planIds = (siblings || []).map((x) => x.id as string);
    }
    const { error } = await db
      .from("plan_periods")
      .update({ paid_at: body.markPaid.paid === false ? null : new Date().toISOString() })
      .in("plan_id", planIds)
      .eq("month", month);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.resendTicket) {
    const ticket = await sendTicketForPlan(db, plan, { to: body.ticketEmail });
    return NextResponse.json({ ok: true, ticket });
  }

  const update: Record<string, unknown> = {};
  if (body.status) {
    if (!["activo", "pausado", "cancelado"].includes(body.status)) {
      return NextResponse.json({ error: "Estatus no válido" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.defaultFoodieId !== undefined) {
    if (body.defaultFoodieId) {
      const { data: foodie } = await db.from("profiles").select("id, role").eq("id", body.defaultFoodieId).maybeSingle();
      if (!foodie || foodie.role !== "agente") {
        return NextResponse.json({ error: "El usuario seleccionado no es un Foodie" }, { status: 400 });
      }
    }
    update.default_foodie_id = body.defaultFoodieId || null;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const { data: updated, error } = await db.from("client_plans").update(update).eq("id", id).select("*").single();
  if (error || !updated) return NextResponse.json({ error: error?.message || "No se pudo actualizar" }, { status: 500 });
  plan = mapPlan(updated);

  // Un Foodie por default también se lleva las visitas que ya estaban sin Foodie (si no,
  // el cambio solo se notaría hasta el mes siguiente y parecería que no hizo nada).
  if (body.defaultFoodieId) {
    const { data: moved } = await db
      .from("visit_assignments")
      .update({ assigned_to: body.defaultFoodieId, assigned_by: session.userId, notified_at: null })
      .eq("plan_id", id)
      .eq("status", "pendiente")
      .is("assigned_to", null)
      .select("id");
    if (moved && moved.length > 0) {
      const [{ data: foodie }, { data: client }] = await Promise.all([
        db.from("profiles").select("email, full_name").eq("id", body.defaultFoodieId).maybeSingle(),
        db.from("clients").select("name, type, city").eq("id", plan.clientId).maybeSingle(),
      ]);
      if (foodie && client) {
        const outcome = await sendAssignmentEmail(db, {
          assignmentId: moved[0].id as string,
          client: { name: client.name, type: client.type, city: client.city },
          foodie: { email: foodie.email, full_name: foodie.full_name },
          note: `Plan ${plan.planName}: ${moved.length} ${moved.length === 1 ? "visita" : "visitas"} por hacer. Todas están en tu lista; el consumo se reembolsa con el ticket.${plan.notes ? ` Indicaciones: ${plan.notes}` : ""}`,
          baseUrl,
        });
        if (outcome.status === "sent" && moved.length > 1) {
          await db.from("visit_assignments").update({ notified_at: new Date().toISOString() }).in("id", moved.map((r) => r.id as string));
        }
      }
    }
  }

  if (body.status === "cancelado") {
    // Las visitas que aún no se hacen ya no deben aparecerle a nadie.
    await db.from("visit_assignments").update({ status: "cancelada" }).eq("plan_id", id).eq("status", "pendiente");
  }
  if (body.status === "activo") {
    await ensurePlanMonth(db, plan, currentMonthCdmx(), baseUrl);
  }

  return NextResponse.json({ ok: true });
}
