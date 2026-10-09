import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { currentMonthCdmx, isValidMonth } from "@/lib/earnings";
import { PLAN_CATALOG, ensurePlanMonth, isPlanKey, mapPlan } from "@/lib/plans";
import { sendTicketForPlan } from "@/lib/planTicket";

type Body = {
  clientId?: string;
  planKey?: string;
  visitsPerMonth?: number;
  pricePerVisit?: number;
  startMonth?: string;
  defaultFoodieId?: string | null;
  notes?: string;
};

/**
 * Contratar un plan de visitas para un negocio (solo Master Chef): crea el
 * plan, deja listas las visitas del mes y manda al negocio el correo "ticket
 * de restaurante" con los servicios contratados. Después el equipo lo
 * contacta personalmente (el cobro, en la Fase A, es fuera de la app).
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como admin" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) return NextResponse.json({ error: "Falta el negocio" }, { status: 400 });
  if (!isPlanKey(body.planKey)) return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
  const catalog = PLAN_CATALOG[body.planKey];

  const visitsPerMonth = Math.round(Number(body.visitsPerMonth ?? catalog.visitsPerMonth));
  const pricePerVisit = Math.round(Number(body.pricePerVisit ?? catalog.pricePerVisit));
  if (!Number.isFinite(visitsPerMonth) || visitsPerMonth < 1 || visitsPerMonth > 4) {
    return NextResponse.json({ error: "Las visitas al mes deben ser de 1 a 4" }, { status: 400 });
  }
  if (!Number.isFinite(pricePerVisit) || pricePerVisit < 1 || pricePerVisit > 100000) {
    return NextResponse.json({ error: "La tarifa por visita no es válida" }, { status: 400 });
  }
  const startMonth = isValidMonth(body.startMonth) ? body.startMonth : currentMonthCdmx();

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase no configurado" }, { status: 500 });
  }

  const { data: client } = await db.from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const { data: existing } = await db.from("client_plans").select("id").eq("client_id", clientId).neq("status", "cancelado").limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Este negocio ya tiene un plan vigente" }, { status: 409 });
  }

  let defaultFoodieId: string | null = null;
  if (body.defaultFoodieId) {
    const { data: foodie } = await db.from("profiles").select("id, role").eq("id", body.defaultFoodieId).maybeSingle();
    if (!foodie || foodie.role !== "agente") {
      return NextResponse.json({ error: "El usuario seleccionado no es un Foodie" }, { status: 400 });
    }
    defaultFoodieId = foodie.id;
  }

  const { data: row, error } = await db
    .from("client_plans")
    .insert({
      client_id: clientId,
      plan_key: catalog.key,
      plan_name: catalog.name,
      visits_per_month: visitsPerMonth,
      price_per_visit: pricePerVisit,
      start_month: startMonth,
      default_foodie_id: defaultFoodieId,
      notes: body.notes?.trim() || null,
      created_by: session.userId,
    })
    .select("*")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el plan" }, { status: 500 });
  }
  const plan = mapPlan(row);

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  await ensurePlanMonth(db, plan, currentMonthCdmx(), baseUrl);
  const ticket = await sendTicketForPlan(db, plan);

  return NextResponse.json({ ok: true, id: plan.id, ticket });
}
