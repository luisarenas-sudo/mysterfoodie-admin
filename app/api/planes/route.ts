import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { currentMonthCdmx, isValidMonth } from "@/lib/earnings";
import { PLAN_CATALOG, PLAN_ZONE_LABEL, isInPlanZone, isPlanKey } from "@/lib/planCatalog";
import { ensurePlanMonth, mapPlan } from "@/lib/plans";
import { sendTicketForPlan } from "@/lib/planTicket";

type Body = {
  /** Plan de un solo negocio (Starter). */
  clientId?: string;
  /** Contratación de varias sucursales (Appetizer / Main course): la primera es desde donde se contrata. */
  clientIds?: string[];
  planKey?: string;
  visitsPerMonth?: number;
  pricePerVisit?: number;
  startMonth?: string;
  defaultFoodieId?: string | null;
  notes?: string;
  /** Correo al que va el ticket (si no, el de la primera sucursal que tenga). */
  ticketEmail?: string;
  /** Contratar aunque alguna sucursal esté fuera de Veracruz - Boca del Río. */
  confirmOutOfZone?: boolean;
};

/**
 * Contratar un plan de visitas (solo Master Chef): crea el plan por cada
 * sucursal, deja listas las visitas del mes y manda al negocio el correo
 * "ticket de restaurante" con los servicios contratados -- uno solo aunque
 * sean varias sucursales. Después el equipo lo contacta personalmente (el
 * cobro, en la Fase A, es fuera de la app).
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

  if (!isPlanKey(body.planKey)) return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
  const catalog = PLAN_CATALOG[body.planKey];

  const ids = [...new Set((body.clientIds?.length ? body.clientIds : [body.clientId]).map((x) => x?.trim()).filter(Boolean) as string[])];
  if (ids.length === 0) return NextResponse.json({ error: "Falta el negocio" }, { status: 400 });
  if (ids.length < catalog.sucursalesMin || ids.length > catalog.sucursalesMax) {
    const range = catalog.sucursalesMin === catalog.sucursalesMax ? `${catalog.sucursalesMin}` : `${catalog.sucursalesMin} a ${catalog.sucursalesMax}`;
    return NextResponse.json({ error: `El plan ${catalog.name} cubre ${range} sucursal${catalog.sucursalesMax === 1 ? "" : "es"}` }, { status: 400 });
  }

  // Starter permite ajustar visitas/mes (1 a 4); los planes de cadena siempre son de 4.
  const visitsPerMonth = catalog.key === "starter" ? Math.round(Number(body.visitsPerMonth ?? catalog.visitsPerMonth)) : catalog.visitsPerMonth;
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

  const { data: clients } = await db.from("clients").select("id, name, city").in("id", ids);
  if (!clients || clients.length !== ids.length) {
    return NextResponse.json({ error: "Alguno de los negocios no existe" }, { status: 404 });
  }

  const { data: existing } = await db.from("client_plans").select("client_id").in("client_id", ids).neq("status", "cancelado");
  if (existing && existing.length > 0) {
    const taken = new Set(existing.map((e) => e.client_id as string));
    const names = clients.filter((c) => taken.has(c.id as string)).map((c) => c.name as string);
    return NextResponse.json({ error: `Ya tiene un plan vigente: ${names.join(", ")}` }, { status: 409 });
  }

  if (catalog.zoneRestricted && !body.confirmOutOfZone) {
    const outOfZone = clients.filter((c) => !isInPlanZone(c.city as string | null)).map((c) => ({ id: c.id, name: c.name, city: c.city ?? null }));
    if (outOfZone.length > 0) {
      return NextResponse.json(
        {
          error: `El plan ${catalog.name} es para ${PLAN_ZONE_LABEL}. Fuera de zona o sin ciudad: ${outOfZone.map((o) => o.name).join(", ")}.`,
          code: "fuera_de_zona",
          outOfZone,
        },
        { status: 409 }
      );
    }
  }

  let defaultFoodieId: string | null = null;
  if (body.defaultFoodieId) {
    const { data: foodie } = await db.from("profiles").select("id, role").eq("id", body.defaultFoodieId).maybeSingle();
    if (!foodie || foodie.role !== "agente") {
      return NextResponse.json({ error: "El usuario seleccionado no es un Foodie" }, { status: 400 });
    }
    defaultFoodieId = foodie.id;
  }

  const groupId = ids.length > 1 ? randomUUID() : null;
  const { data: rows, error } = await db
    .from("client_plans")
    .insert(
      ids.map((clientId) => ({
        client_id: clientId,
        plan_key: catalog.key,
        plan_name: catalog.name,
        visits_per_month: visitsPerMonth,
        price_per_visit: pricePerVisit,
        start_month: startMonth,
        default_foodie_id: defaultFoodieId,
        notes: body.notes?.trim() || null,
        created_by: session.userId,
        ...(groupId ? { group_id: groupId } : {}),
      }))
    )
    .select("*");

  if (error || !rows) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el plan" }, { status: 500 });
  }
  // La fila de la sucursal desde donde se contrata va primero.
  const plans = ids.map((id) => mapPlan(rows.find((r) => r.client_id === id)));

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const month = currentMonthCdmx();
  await Promise.all(plans.map((p) => ensurePlanMonth(db, p, month, baseUrl)));
  const ticket = await sendTicketForPlan(db, plans[0], { to: body.ticketEmail });

  return NextResponse.json({ ok: true, id: plans[0].id, count: plans.length, ticket });
}
