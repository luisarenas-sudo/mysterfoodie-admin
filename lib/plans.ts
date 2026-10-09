import { getSupabaseServiceClient } from "./supabase";
import { currentMonthCdmx, isVisitOverdue, monthLabel, shiftMonth, visitWindowLabel } from "./months";
import { sendAssignmentEmail } from "./assignments";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Planes de visitas (segunda etapa): el negocio paga un paquete mensual de
 * visitas Mystery Shopper. Cada sucursal es su propio negocio (clients), así
 * que el plan se cobra por sucursal. Las visitas del mes se generan solas
 * como visit_assignments con plan_id; el Foodie las ve igual que cualquier
 * visita asignada. Ver supabase/planes.sql.
 */

export { PLAN_CATALOG, PLAN_KEYS, isPlanKey, isInPlanZone, type PlanKey } from "./planCatalog";

export type PlanStatus = "activo" | "pausado" | "cancelado";

export type PlanRow = {
  id: string;
  clientId: string;
  planKey: string;
  planName: string;
  visitsPerMonth: number;
  pricePerVisit: number;
  startMonth: string;
  status: PlanStatus;
  defaultFoodieId: string | null;
  notes: string | null;
  ticketSentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Une las sucursales de una misma contratación (Appetizer / Main course). */
  groupId: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPlan(r: any): PlanRow {
  return {
    id: r.id,
    clientId: r.client_id,
    planKey: r.plan_key,
    planName: r.plan_name,
    visitsPerMonth: r.visits_per_month,
    pricePerVisit: r.price_per_visit,
    startMonth: r.start_month,
    status: r.status,
    defaultFoodieId: r.default_foodie_id ?? null,
    notes: r.notes ?? null,
    ticketSentAt: r.ticket_sent_at ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    groupId: r.group_id ?? null,
  };
}

/** Folio corto y legible para el ticket (ej. "MF-7A3C91"). */
export function planFolio(planId: string): string {
  return `MF-${planId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/**
 * Deja listo un mes del plan: el periodo de cobro y las N visitas. Es
 * idempotente (índices únicos): se puede llamar cuantas veces haga falta y
 * solo crea lo que falta. Si el plan tiene Foodie por default, las visitas
 * nacen asignadas y se le avisa con un solo correo.
 */
export async function ensurePlanMonth(db: Db, plan: PlanRow, month: string, baseUrl?: string): Promise<void> {
  if (plan.status !== "activo" || month < plan.startMonth) return;

  await db
    .from("plan_periods")
    .upsert(
      { plan_id: plan.id, month, amount: plan.visitsPerMonth * plan.pricePerVisit },
      { onConflict: "plan_id,month", ignoreDuplicates: true }
    );

  const label = monthLabel(month);
  const rows = Array.from({ length: plan.visitsPerMonth }, (_, i) => ({
    client_id: plan.clientId,
    plan_id: plan.id,
    plan_month: month,
    plan_seq: i + 1,
    assigned_to: plan.defaultFoodieId,
    assigned_by: plan.createdBy,
    status: "pendiente",
    note: `Visita ${i + 1} de ${plan.visitsPerMonth} · ${visitWindowLabel(month, i + 1, plan.visitsPerMonth)} · Plan ${plan.planName}. El consumo se reembolsa con el ticket.${plan.notes ? ` Indicaciones: ${plan.notes}` : ""}`,
  }));

  const { data: inserted } = await db
    .from("visit_assignments")
    .upsert(rows, { onConflict: "plan_id,plan_month,plan_seq", ignoreDuplicates: true })
    .select("id");

  if (!inserted || inserted.length === 0 || !plan.defaultFoodieId || !baseUrl) return;

  // Un solo aviso por lote (no un correo por visita).
  const [{ data: foodie }, { data: client }] = await Promise.all([
    db.from("profiles").select("email, full_name").eq("id", plan.defaultFoodieId).maybeSingle(),
    db.from("clients").select("name, type, city").eq("id", plan.clientId).maybeSingle(),
  ]);
  if (!foodie || !client) return;

  const outcome = await sendAssignmentEmail(db, {
    assignmentId: inserted[0].id as string,
    client: { name: client.name, type: client.type, city: client.city },
    foodie: { email: foodie.email, full_name: foodie.full_name },
    note: `Plan ${plan.planName}: ${inserted.length} ${inserted.length === 1 ? "visita" : "visitas"} en ${label}. Todas están en tu lista; el consumo se reembolsa con el ticket.`,
    baseUrl,
  });
  if (outcome.status === "sent" && inserted.length > 1) {
    await db
      .from("visit_assignments")
      .update({ notified_at: new Date().toISOString() })
      .in("id", inserted.map((r) => r.id as string));
  }
}

/** Genera el mes actual de todos los planes activos (cron, /planes y detalle del negocio). */
export async function syncActivePlans(db: Db, opts: { clientId?: string; baseUrl?: string } = {}): Promise<number> {
  let q = db.from("client_plans").select("*").eq("status", "activo");
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  const { data } = await q;
  const plans = (data || []).map(mapPlan);
  const month = currentMonthCdmx();
  await Promise.all(plans.map((p) => ensurePlanMonth(db, p, month, opts.baseUrl)));
  return plans.length;
}

export type PlanVisitView = {
  id: string;
  month: string;
  seq: number | null;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  shortCode: string | null;
  /** "del 8 al 15 de octubre": ventana informativa de la visita. */
  windowLabel: string | null;
  /** Sigue pendiente y ya pasó su ventana. */
  overdue: boolean;
};

export type PlanPeriodView = { month: string; amount: number; paidAt: string | null };

export type ClientPlanView = {
  plan: PlanRow;
  month: string;
  monthLabel: string;
  quota: number;
  done: number;
  visits: PlanVisitView[];
  periods: PlanPeriodView[];
  currentPeriod: PlanPeriodView | null;
  /** Contratación conjunta: todas las sucursales del mismo plan (incluye esta). */
  group: { size: number; names: string[]; monthlyTotal: number } | null;
};

/** Plan vigente (activo o en pausa) de un negocio, con el avance del mes. */
export async function getClientPlanView(
  clientId: string,
  opts: { sync?: boolean; baseUrl?: string } = {}
): Promise<ClientPlanView | null> {
  const db = getSupabaseServiceClient();
  const { data: planRows } = await db
    .from("client_plans")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1);
  if (!planRows || planRows.length === 0) return null;
  const plan = mapPlan(planRows[0]);
  const month = currentMonthCdmx();

  if (opts.sync) await ensurePlanMonth(db, plan, month, opts.baseUrl);

  let group: ClientPlanView["group"] = null;
  if (plan.groupId) {
    const { data: siblings } = await db
      .from("client_plans")
      .select("client_id, visits_per_month, price_per_visit")
      .eq("group_id", plan.groupId)
      .neq("status", "cancelado");
    if (siblings && siblings.length > 1) {
      const { data: sibClients } = await db
        .from("clients")
        .select("id, name")
        .in("id", siblings.map((x) => x.client_id as string));
      const nameById = new Map((sibClients || []).map((c) => [c.id as string, c.name as string]));
      group = {
        size: siblings.length,
        names: siblings.map((x) => nameById.get(x.client_id as string) ?? "Sucursal"),
        monthlyTotal: siblings.reduce((a, x) => a + (x.visits_per_month as number) * (x.price_per_visit as number), 0),
      };
    }
  }

  const [{ data: assignRows }, { data: periodRows }] = await Promise.all([
    db
      .from("visit_assignments")
      .select("id, plan_month, plan_seq, status, assigned_to, completed_form_id")
      .eq("plan_id", plan.id)
      .order("plan_month", { ascending: true })
      .order("plan_seq", { ascending: true }),
    db.from("plan_periods").select("month, amount, paid_at").eq("plan_id", plan.id).order("month", { ascending: false }).limit(6),
  ]);

  const relevant = (assignRows || []).filter(
    (a) => a.plan_month === month || (a.status === "pendiente" && (a.plan_month as string) < month)
  );

  const foodieIds = [...new Set(relevant.map((a) => a.assigned_to as string | null).filter(Boolean) as string[])];
  const formIds = relevant.map((a) => a.completed_form_id as string | null).filter(Boolean) as string[];
  const [{ data: foodies }, { data: forms }] = await Promise.all([
    foodieIds.length
      ? db.from("profiles").select("id, full_name, email").in("id", foodieIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    formIds.length
      ? db.from("forms").select("id, short_code").in("id", formIds)
      : Promise.resolve({ data: [] as { id: string; short_code: string }[] }),
  ]);
  const nameById = new Map((foodies || []).map((f) => [f.id, f.full_name || f.email || "Foodie"]));
  const codeByForm = new Map((forms || []).map((f) => [f.id, f.short_code]));

  const visits: PlanVisitView[] = relevant.map((a) => ({
    id: a.id as string,
    month: a.plan_month as string,
    seq: (a.plan_seq as number | null) ?? null,
    status: a.status as string,
    assignedTo: (a.assigned_to as string | null) ?? null,
    assignedToName: a.assigned_to ? nameById.get(a.assigned_to as string) ?? null : null,
    shortCode: a.completed_form_id ? codeByForm.get(a.completed_form_id as string) ?? null : null,
    windowLabel: a.plan_seq ? visitWindowLabel(a.plan_month as string, a.plan_seq as number, plan.visitsPerMonth) : null,
    overdue: a.status === "pendiente" && Boolean(a.plan_seq) && isVisitOverdue(a.plan_month as string, a.plan_seq as number, plan.visitsPerMonth),
  }));

  const periods: PlanPeriodView[] = (periodRows || []).map((p) => ({
    month: p.month as string,
    amount: p.amount as number,
    paidAt: (p.paid_at as string | null) ?? null,
  }));

  return {
    plan,
    month,
    monthLabel: monthLabel(month),
    quota: plan.visitsPerMonth,
    done: visits.filter((v) => v.month === month && v.status === "completada").length,
    visits,
    periods,
    currentPeriod: periods.find((p) => p.month === month) ?? null,
    group,
  };
}

export type PlanOverviewRow = {
  id: string;
  clientId: string;
  clientName: string;
  planName: string;
  status: PlanStatus;
  quota: number;
  done: number;
  unassigned: number;
  amount: number;
  paid: boolean;
  planKey: string;
  /** Sucursales que comparten la contratación (1 = plan individual). */
  groupSize: number;
};

/** Lista de planes con el avance del mes actual (pantalla /planes, solo admin). */
export async function getPlansOverview(baseUrl?: string): Promise<{ month: string; monthLabel: string; rows: PlanOverviewRow[] }> {
  const db = getSupabaseServiceClient();
  await syncActivePlans(db, { baseUrl });
  const month = currentMonthCdmx();

  const { data: planRows } = await db.from("client_plans").select("*").neq("status", "cancelado").order("created_at", { ascending: false });
  const plans = (planRows || []).map(mapPlan);
  if (plans.length === 0) return { month, monthLabel: monthLabel(month), rows: [] };

  const planIds = plans.map((p) => p.id);
  const [{ data: clients }, { data: assigns }, { data: periods }] = await Promise.all([
    db.from("clients").select("id, name").in("id", [...new Set(plans.map((p) => p.clientId))]),
    db.from("visit_assignments").select("plan_id, status, assigned_to").in("plan_id", planIds).eq("plan_month", month),
    db.from("plan_periods").select("plan_id, amount, paid_at").in("plan_id", planIds).eq("month", month),
  ]);
  const clientName = new Map((clients || []).map((c) => [c.id as string, c.name as string]));

  const rows: PlanOverviewRow[] = plans.map((p) => {
    const mine = (assigns || []).filter((a) => a.plan_id === p.id);
    const period = (periods || []).find((x) => x.plan_id === p.id);
    return {
      id: p.id,
      clientId: p.clientId,
      clientName: clientName.get(p.clientId) ?? "Negocio",
      planName: p.planName,
      status: p.status,
      quota: p.visitsPerMonth,
      done: mine.filter((a) => a.status === "completada").length,
      unassigned: mine.filter((a) => a.status === "pendiente" && !a.assigned_to).length,
      amount: p.visitsPerMonth * p.pricePerVisit,
      paid: Boolean(period?.paid_at),
      planKey: p.planKey,
      groupSize: p.groupId ? plans.filter((x) => x.groupId === p.groupId).length : 1,
    };
  });
  return { month, monthLabel: monthLabel(month), rows };
}

/** Mes siguiente al actual, para ofrecerlo como inicio del plan. */
export function nextMonthCdmx(): string {
  return shiftMonth(currentMonthCdmx(), 1);
}

/**
 * Opciones de mes de arranque: si el plan se contrata en la primera mitad
 * del mes, lo natural es empezar este mes; después del 15, el siguiente
 * (para no meter 3 visitas en los últimos días).
 */
export function startMonthOptions(): {
  suggested: { month: string; label: string };
  other: { month: string; label: string };
} {
  const current = currentMonthCdmx();
  const next = shiftMonth(current, 1);
  const day = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", day: "2-digit" }).format(new Date()));
  const opt = (month: string, prefix: string) => ({ month, label: `${prefix} · ${monthLabel(month)}` });
  const thisMonth = opt(current, "Este mes");
  const nextMonth = opt(next, "Próximo mes");
  return day <= 15 ? { suggested: thisMonth, other: nextMonth } : { suggested: nextMonth, other: thisMonth };
}

export type PlanBranchOption = { id: string; name: string; city: string | null; email: string | null };

/** Negocios que todavía no tienen plan vigente: candidatos a sumarse a una contratación de varias sucursales. */
export async function getPlanBranchOptions(): Promise<PlanBranchOption[]> {
  const db = getSupabaseServiceClient();
  const [{ data: clients }, { data: planned }] = await Promise.all([
    db.from("clients").select("id, name, city, email").order("name"),
    db.from("client_plans").select("client_id").neq("status", "cancelado"),
  ]);
  const taken = new Set((planned || []).map((p) => p.client_id as string));
  return (clients || [])
    .filter((c) => !taken.has(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string, city: (c.city as string | null) ?? null, email: (c.email as string | null) ?? null }));
}
