import { getSupabaseServiceClient } from "./supabase";
import { PRICE_MXN, scenarioByKey, splitForPrice, type ScenarioKey } from "./earningsMatrix";
import { CDMX_OFFSET, currentMonthCdmx, isValidMonth, monthLabel, shiftMonth } from "./months";

/**
 * Cálculo REAL de ganancias por periodo (mes, hora CDMX).
 *
 * Una venta = un reporte completo entregado (el pago se aprobó y se
 * mandó el PDF): forms.report_unlocked_at marca ese momento y define el
 * mes. La acción del reparto (1-5) se deduce de los datos:
 *  - Visitó: quien guardó la visita (forms.created_by).
 *  - Vendió: quien dio de alta el negocio (clients.created_by); sin dato
 *    se asume Master Chef (negocios históricos).
 *  - Gestionó: quien asignó la visita a un Foodie (visit_assignments).
 * Lo que no encaja en ninguna de las 6 acciones queda "sin clasificar".
 *
 * Segunda etapa (planes mensuales): cada visita de un plan entregada cuenta
 * como una venta, con el mismo reparto proporcional al precio por visita
 * ($700 en Starter) y recurrente mes con mes. Cuenta en el mes de la visita
 * y solo cuando el periodo del plan ya está marcado como cobrado; lo que
 * está hecho pero sin cobrar se reporta aparte ("por cobrar").
 */

export type PaidVisit = {
  formId: string;
  negocio: string;
  soldAt: string;
  /** "reporte" = venta suelta del reporte completo; "plan" = visita de un plan mensual. */
  kind: "reporte" | "plan";
  /** Lo que vale esta venta (850 por reporte; la tarifa por visita en un plan). */
  price: number;
  planName?: string;
  scenario: ScenarioKey | null;
  admin: number;
  sibarita: number;
  foodie: number;
  sibaritaId: string | null;
  foodieId: string | null;
};

export type ProfileLite = { id: string; name: string; role: string };

export { currentMonthCdmx, isValidMonth, shiftMonth, monthLabel };

function monthBounds(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00${CDMX_OFFSET}`),
    end: new Date(`${shiftMonth(month, 1)}-01T00:00:00${CDMX_OFFSET}`),
  };
}

export type UnpaidPlanVisits = { count: number; amount: number };

type Classified = { scenario: ScenarioKey | null; sibaritaId: string | null; foodieId: string | null };

export async function getMonthEarnings(
  month: string
): Promise<{ visits: PaidVisit[]; profiles: Map<string, ProfileLite>; unpaidPlan: UnpaidPlanVisits }> {
  const db = getSupabaseServiceClient();
  const { start, end } = monthBounds(month);

  const [{ data: forms }, { data: planForms }] = await Promise.all([
    db
      .from("forms")
      .select("id, client_id, created_by, report_unlocked_at")
      .is("plan_id", null)
      .not("report_unlocked_at", "is", null)
      .gte("report_unlocked_at", start.toISOString())
      .lt("report_unlocked_at", end.toISOString())
      .order("report_unlocked_at", { ascending: false }),
    db
      .from("forms")
      .select("id, client_id, created_by, created_at, plan_id")
      .not("plan_id", "is", null)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const formRows = forms || [];
  const planFormRows = planForms || [];
  const empty = { visits: [] as PaidVisit[], profiles: new Map<string, ProfileLite>(), unpaidPlan: { count: 0, amount: 0 } };
  if (formRows.length === 0 && planFormRows.length === 0) return empty;

  const allRows = [...formRows, ...planFormRows];
  const clientIds = [...new Set(allRows.map((f) => f.client_id as string))];
  const formIds = allRows.map((f) => f.id as string);
  const planIds = [...new Set(planFormRows.map((f) => f.plan_id as string))];

  const [{ data: clients }, { data: assignments }, { data: plans }, { data: periods }] = await Promise.all([
    db.from("clients").select("id, name, created_by").in("id", clientIds),
    db.from("visit_assignments").select("completed_form_id, assigned_by, plan_month").in("completed_form_id", formIds),
    planIds.length
      ? db.from("client_plans").select("id, plan_name, price_per_visit").in("id", planIds)
      : Promise.resolve({ data: [] as { id: string; plan_name: string; price_per_visit: number }[] }),
    planIds.length
      ? db.from("plan_periods").select("plan_id, month, paid_at").in("plan_id", planIds)
      : Promise.resolve({ data: [] as { plan_id: string; month: string; paid_at: string | null }[] }),
  ]);

  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  const assignerByForm = new Map((assignments || []).map((a) => [a.completed_form_id as string, a.assigned_by as string | null]));
  const planById = new Map((plans || []).map((p) => [p.id as string, p]));
  // El cobro que cuenta es el del mes DEL PLAN al que pertenece la visita (una visita de
  // octubre hecha en noviembre se paga con el cobro de octubre), no el del mes en que se hizo.
  const paidPeriods = new Set((periods || []).filter((p) => p.paid_at).map((p) => `${p.plan_id}:${p.month}`));
  const planMonthByForm = new Map((assignments || []).map((a) => [a.completed_form_id as string, a.plan_month as string | null]));

  const profileIds = new Set<string>();
  allRows.forEach((f) => f.created_by && profileIds.add(f.created_by as string));
  (clients || []).forEach((c) => c.created_by && profileIds.add(c.created_by as string));
  (assignments || []).forEach((a) => a.assigned_by && profileIds.add(a.assigned_by as string));

  const { data: profileRows } = profileIds.size
    ? await db.from("profiles").select("id, full_name, email, role").in("id", [...profileIds])
    : { data: [] as { id: string; full_name: string | null; email: string | null; role: string }[] };
  const profiles = new Map<string, ProfileLite>(
    (profileRows || []).map((p) => [p.id, { id: p.id, name: p.full_name || p.email || "Sin nombre", role: p.role }])
  );
  const roleOf = (id: string | null | undefined) => (id ? profiles.get(id)?.role ?? null : null);

  // Qué acción del reparto (1-5) fue, según quién vendió, quién visitó y quién asignó.
  const classify = (formId: string, clientId: string, visitorId: string | null): Classified => {
    const client = clientById.get(clientId);
    const visitorRole = roleOf(visitorId);
    const sellerId = (client?.created_by as string | null) ?? null;
    const sellerRole = roleOf(sellerId) ?? "admin"; // sin dato: negocio histórico del Master Chef
    const assignerId = assignerByForm.get(formId) ?? null;
    const assignerRole = roleOf(assignerId);

    let scenario: ScenarioKey | null = null;
    let sibaritaId: string | null = null;
    let foodieId: string | null = null;

    if (visitorRole === "admin" && sellerRole === "admin") {
      scenario = "1";
    } else if (visitorRole === "agente") {
      foodieId = visitorId;
      if (sellerRole === "sibarita") {
        scenario = "5";
        sibaritaId = sellerId;
      } else if (sellerRole === "admin") {
        if (assignerRole === "sibarita") {
          scenario = "3a";
          sibaritaId = assignerId;
        } else {
          scenario = "2";
        }
      }
    } else if (visitorRole === "sibarita") {
      if (sellerRole === "admin") {
        scenario = "3b";
        sibaritaId = visitorId;
      } else if (sellerRole === "sibarita" && sellerId === visitorId) {
        scenario = "4";
        sibaritaId = visitorId;
      }
    }
    return { scenario, sibaritaId, foodieId: scenario ? foodieId : null };
  };

  const build = (
    f: { id: unknown; client_id: unknown; created_by: unknown },
    soldAt: string,
    kind: "reporte" | "plan",
    price: number,
    planName?: string
  ): PaidVisit => {
    const clientId = f.client_id as string;
    const c = classify(f.id as string, clientId, (f.created_by as string | null) ?? null);
    const split = c.scenario ? splitForPrice(scenarioByKey(c.scenario), price) : null;
    return {
      formId: f.id as string,
      negocio: clientById.get(clientId)?.name || "Negocio",
      soldAt,
      kind,
      price,
      planName,
      scenario: c.scenario,
      admin: split?.admin ?? 0,
      sibarita: split?.sibarita ?? 0,
      foodie: split?.foodie ?? 0,
      sibaritaId: c.sibaritaId,
      foodieId: c.foodieId,
    };
  };

  const visits: PaidVisit[] = formRows.map((f) => build(f, f.report_unlocked_at as string, "reporte", PRICE_MXN));

  const unpaidPlan: UnpaidPlanVisits = { count: 0, amount: 0 };
  for (const f of planFormRows) {
    const plan = planById.get(f.plan_id as string);
    const price = (plan?.price_per_visit as number | undefined) ?? 0;
    if (!plan || price <= 0) continue;
    const planMonth = planMonthByForm.get(f.id as string) ?? month;
    if (paidPeriods.has(`${f.plan_id}:${planMonth}`)) {
      visits.push(build(f, f.created_at as string, "plan", price, plan.plan_name as string));
    } else {
      unpaidPlan.count += 1;
      unpaidPlan.amount += price;
    }
  }

  visits.sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1));
  return { visits, profiles, unpaidPlan };
}

export { PRICE_MXN };
