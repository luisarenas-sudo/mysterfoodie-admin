import { getSupabaseServiceClient } from "./supabase";
import { currentMonthCdmx, isVisitOverdue, monthLabel, shiftMonth, visitWindowLabel } from "./months";
import { getPendingAssignmentsFor } from "./dashboard";
import { formatMxn } from "./earningsMatrix";
import { getOpenPoolFor, businessHoursSince } from "./visitRequests";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Pendientes del Inicio. Todo se calcula en vivo a partir de lo que ya existe
 * (asignaciones, planes, cobros, compras, citas, correos): no hay una bandeja
 * aparte que mantener. Lo único que se guarda es qué cerró cada persona con
 * la X (tabla alert_dismissals):
 *  - kind "pendiente" (algo por hacer): al cerrarlo reaparece a las 24 h si
 *    sigue sin resolverse; si ya se resolvió, ya no sale.
 *  - kind "aviso" (algo que pasó): al cerrarlo se oculta para siempre.
 */

export type AlertTone = "urgent" | "warn" | "info" | "ok";

export type HomeAlert = {
  /** Estable por situación (ej. "ad:cobro:<plan>:2026-10"): es lo que se guarda al cerrar. */
  key: string;
  kind: "pendiente" | "aviso";
  tone: AlertTone;
  emoji: string;
  title: string;
  detail?: string;
  href: string;
};

const TONE_RANK: Record<AlertTone, number> = { urgent: 0, warn: 1, info: 2, ok: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;

function agoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- Shopper
async function foodieAlerts(userId: string): Promise<HomeAlert[]> {
  const pending = await getPendingAssignmentsFor(userId);
  const alerts: HomeAlert[] = [];

  // Visitas de un plan: un aviso por negocio y mes (no uno por visita).
  const groups = new Map<string, typeof pending>();
  for (const a of pending) {
    if (a.plan) {
      const k = `${a.plan.planId}:${a.plan.month}`;
      groups.set(k, [...(groups.get(k) ?? []), a]);
    } else {
      alerts.push({
        key: `fd:asig:${a.id}`,
        kind: "pendiente",
        tone: "info",
        emoji: "📍",
        title: `Nueva visita: ${a.clientName}`,
        detail: a.note || `Asignada ${agoLabel(a.createdAt)}`,
        href: `/nueva-visita/${a.id}`,
      });
    }
  }
  for (const [k, items] of groups) {
    const sorted = [...items].sort((x, y) => (x.plan!.seq - y.plan!.seq));
    const next = sorted[0];
    const late = sorted.filter((i) => i.plan!.overdue).length;
    alerts.push({
      key: `fd:plan:${k}`,
      kind: "pendiente",
      tone: late > 0 ? "warn" : "info",
      emoji: "🍽️",
      title: `${next.clientName}: ${plural(sorted.length, "visita del plan", "visitas del plan")} por hacer`,
      detail: `Sigue la visita ${next.plan!.seq} de ${next.plan!.quota} · ${next.plan!.windowLabel}${late > 0 ? ` · ${plural(late, "atrasada", "atrasadas")}` : ""}`,
      href: `/nueva-visita/${next.id}`,
    });
  }
  return alerts;
}

// Visitas gratis que nadie asignó y se ofrecen a sibaritas (+3 h) y Shoppers (+5 h).
async function poolAlerts(db: Db, userId: string, role: "agente" | "sibarita"): Promise<HomeAlert[]> {
  const pool = await getOpenPoolFor(db, userId, role).catch(() => []);
  if (pool.length === 0) return [];
  return [
    {
      key: `${role === "agente" ? "fd" : "sb"}:pool`,
      kind: "pendiente",
      tone: "warn",
      emoji: "🙋",
      title: pool.length === 1 ? `Visita gratis disponible: ${pool[0].clientName}` : `${pool.length} visitas gratis disponibles`,
      detail: "Nadie las ha tomado: quien la tome primero se la queda",
      href: "/nueva-visita",
    },
  ];
}

// Solicitudes de visita (web) por asignar: las programadas son prioridad.
async function requestAlerts(db: Db): Promise<HomeAlert[]> {
  const { data: rows } = await db
    .from("visit_requests")
    .select("id, kind, schedule_pref, created_at, client_id")
    .eq("status", "pendiente")
    .order("created_at", { ascending: true });
  if (!rows || rows.length === 0) return [];
  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .in("id", [...new Set(rows.map((r) => r.client_id as string))]);
  const nameOf = new Map((clients || []).map((c) => [c.id as string, c.name as string]));
  const alerts: HomeAlert[] = [];
  const gratis = rows.filter((r) => r.kind !== "programada");
  for (const r of rows.filter((x) => x.kind === "programada")) {
    alerts.push({
      key: `ad:solic:${r.id}`,
      kind: "pendiente",
      tone: "urgent",
      emoji: "📅",
      title: `Visita programada: ${nameOf.get(r.client_id as string) ?? "Negocio"}`,
      detail: `${r.schedule_pref ? `Pidió ${r.schedule_pref} · ` : ""}$850 + consumo · acuerda fecha y pago`,
      href: "/solicitudes",
    });
  }
  if (gratis.length > 0) {
    const oldest = gratis[0].created_at as string;
    const late = businessHoursSince(oldest) >= 2;
    alerts.push({
      key: "ad:solic:gratis",
      kind: "pendiente",
      tone: late ? "urgent" : "warn",
      emoji: "❔",
      title: gratis.length === 1 ? `Visita gratis por asignar: ${nameOf.get(gratis[0].client_id as string) ?? "Negocio"}` : `${gratis.length} visitas gratis por asignar`,
      detail: `La más antigua llegó ${agoLabel(oldest)} · a las 3 h hábiles se ofrecen a sibaritas`,
      href: "/solicitudes",
    });
  }
  return alerts;
}

// ----------------------------------------------------------------- admin
async function adminAlerts(db: Db): Promise<HomeAlert[]> {
  const alerts: HomeAlert[] = [...(await requestAlerts(db).catch(() => []))];
  const month = currentMonthCdmx();
  const since = new Date(Date.now() - RECENT_DAYS * DAY_MS).toISOString();

  const { data: planRows } = await db
    .from("client_plans")
    .select("id, client_id, plan_name, visits_per_month, status, group_id, ticket_sent_at")
    .neq("status", "cancelado");
  const plans = planRows || [];
  const planIds = plans.map((p) => p.id as string);

  const [{ data: openVisits }, { data: unpaid }, { data: sales }, { data: bookings }, { data: failedMails }] = await Promise.all([
    planIds.length
      ? db.from("visit_assignments").select("plan_id, plan_month, plan_seq, assigned_to").in("plan_id", planIds).eq("status", "pendiente")
      : Promise.resolve({ data: [] as { plan_id: string; plan_month: string; plan_seq: number | null; assigned_to: string | null }[] }),
    planIds.length
      ? db.from("plan_periods").select("plan_id, month, amount").in("plan_id", planIds).is("paid_at", null).gte("month", shiftMonth(month, -2)).lte("month", month)
      : Promise.resolve({ data: [] as { plan_id: string; month: string; amount: number }[] }),
    db.from("forms").select("id, client_id, report_unlocked_at").is("plan_id", null).gte("report_unlocked_at", since).order("report_unlocked_at", { ascending: false }),
    db
      .from("consultation_bookings")
      .select("id, client_id, business_name, slot_start, created_at")
      .gte("slot_end", new Date().toISOString())
      .gte("created_at", new Date(Date.now() - 14 * DAY_MS).toISOString())
      .order("slot_start", { ascending: true }),
    db.from("email_confirmations").select("id, form_id, recipient_email, subject, sent_at").eq("status", "failed").gte("sent_at", since).order("sent_at", { ascending: false }).limit(5),
  ]);

  // Nombres de negocios (planes + compras + correos fallidos)
  const formIdsForMail = (failedMails || []).map((m) => m.form_id as string).filter(Boolean);
  const { data: mailForms } = formIdsForMail.length
    ? await db.from("forms").select("id, client_id").in("id", formIdsForMail)
    : { data: [] as { id: string; client_id: string }[] };
  const clientIds = [
    ...new Set([
      ...plans.map((p) => p.client_id as string),
      ...(sales || []).map((f) => f.client_id as string),
      ...(mailForms || []).map((f) => f.client_id as string),
    ]),
  ];
  const { data: clientRows } = clientIds.length ? await db.from("clients").select("id, name").in("id", clientIds) : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((clientRows || []).map((c) => [c.id as string, c.name as string]));
  const planById = new Map(plans.map((p) => [p.id as string, p]));

  // 1) Visitas del plan: atrasadas (urgente) o sin Shopper (aviso). Un aviso por plan y mes.
  const byPlanMonth = new Map<string, { planId: string; month: string; late: number; unassigned: number; total: number }>();
  for (const v of openVisits || []) {
    const plan = planById.get(v.plan_id as string);
    if (!plan || plan.status !== "activo" || (v.plan_month as string) > month) continue;
    const k = `${v.plan_id}:${v.plan_month}`;
    const row = byPlanMonth.get(k) ?? { planId: v.plan_id as string, month: v.plan_month as string, late: 0, unassigned: 0, total: 0 };
    row.total += 1;
    if (!v.assigned_to) row.unassigned += 1;
    if (v.plan_seq && isVisitOverdue(v.plan_month as string, v.plan_seq as number, plan.visits_per_month as number)) row.late += 1;
    byPlanMonth.set(k, row);
  }
  for (const [k, r] of byPlanMonth) {
    const plan = planById.get(r.planId)!;
    const name = nameOf.get(plan.client_id as string) ?? "Negocio";
    const href = `/negocios/${plan.client_id}#plan`;
    if (r.late > 0) {
      alerts.push({
        key: `ad:atraso:${k}`,
        kind: "pendiente",
        tone: "urgent",
        emoji: "⏰",
        title: `${name}: ${plural(r.late, "visita atrasada", "visitas atrasadas")}`,
        detail: `Plan ${plan.plan_name} · ${monthLabel(r.month)}${r.unassigned > 0 ? ` · ${r.unassigned} sin Shopper` : ""}`,
        href,
      });
    } else if (r.unassigned > 0) {
      alerts.push({
        key: `ad:sinfoodie:${k}`,
        kind: "pendiente",
        tone: "warn",
        emoji: "🧑‍🍳",
        title: `${name}: ${plural(r.unassigned, "visita sin Shopper", "visitas sin Shopper")}`,
        detail: `Plan ${plan.plan_name} · ${monthLabel(r.month)} · asígnala para que arranque`,
        href,
      });
    }
  }

  // 2) Cobros del mes por plan o cadena (un aviso por contratación y mes).
  const cobros = new Map<string, { planId: string; month: string; amount: number; sucursales: number }>();
  for (const p of unpaid || []) {
    const plan = planById.get(p.plan_id as string);
    if (!plan || plan.status !== "activo") continue;
    const k = `${(plan.group_id as string | null) ?? plan.id}:${p.month}`;
    const row = cobros.get(k) ?? { planId: plan.id as string, month: p.month as string, amount: 0, sucursales: 0 };
    row.amount += p.amount as number;
    row.sucursales += 1;
    cobros.set(k, row);
  }
  for (const [k, c] of cobros) {
    const plan = planById.get(c.planId)!;
    const name = nameOf.get(plan.client_id as string) ?? "Negocio";
    alerts.push({
      key: `ad:cobro:${k}`,
      kind: "pendiente",
      tone: c.month < month ? "urgent" : "warn",
      emoji: "💳",
      title: `Cobro de ${monthLabel(c.month).split(" ")[0].toLowerCase()} pendiente: ${formatMxn(c.amount)}`,
      detail: `${name}${c.sucursales > 1 ? ` y ${c.sucursales - 1} sucursales más` : ""} · Plan ${plan.plan_name}`,
      href: `/negocios/${plan.client_id}#plan`,
    });
  }

  // 3) Ticket sin enviar (un aviso por contratación).
  const seenTicket = new Set<string>();
  for (const plan of plans) {
    if (plan.ticket_sent_at) continue;
    const gk = ((plan.group_id as string | null) ?? plan.id) as string;
    if (seenTicket.has(gk)) continue;
    seenTicket.add(gk);
    const name = nameOf.get(plan.client_id as string) ?? "Negocio";
    alerts.push({
      key: `ad:ticket:${gk}`,
      kind: "pendiente",
      tone: "warn",
      emoji: "🧾",
      title: `El ticket del plan ${plan.plan_name} no se envió`,
      detail: `${name}: agrega su correo y reenvíalo desde el plan, o contáctalo directo`,
      href: `/negocios/${plan.client_id}#plan`,
    });
  }

  // 4) Avisos: compras de reporte, asesorías agendadas y correos que fallaron.
  for (const f of sales || []) {
    alerts.push({
      key: `ad:venta:${f.id}`,
      kind: "aviso",
      tone: "ok",
      emoji: "💰",
      title: `${nameOf.get(f.client_id as string) ?? "Un negocio"} compró el reporte completo`,
      detail: `${agoLabel(f.report_unlocked_at as string)} · dale seguimiento`,
      href: `/negocios/${f.client_id}`,
    });
  }
  for (const b of bookings || []) {
    const when = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(b.slot_start as string));
    alerts.push({
      key: `ad:cita:${b.id}`,
      kind: "aviso",
      tone: "info",
      emoji: "📅",
      title: `${b.business_name} agendó una asesoría`,
      detail: when,
      href: b.client_id ? `/negocios/${b.client_id}` : "/automatizaciones",
    });
  }
  for (const m of failedMails || []) {
    alerts.push({
      key: `ad:correo:${m.id}`,
      kind: "aviso",
      tone: "urgent",
      emoji: "✉️",
      title: `No se pudo enviar el correo a ${m.recipient_email}`,
      detail: `${m.subject} · ${agoLabel(m.sent_at as string)}`,
      href: m.form_id ? `/visitas/${m.form_id}` : "/",
    });
  }

  // Bajas de usuarios con registros por revisar (negocios sin dueño). Si aún no se
  // corre supabase/acceso.sql la tabla no existe y simplemente no hay aviso.
  const { data: removals } = await db
    .from("user_removals")
    .select("id, email, full_name, removed_at, moved, self_requested, exit_rating, exit_comment")
    .eq("status", "pendiente")
    .order("removed_at", { ascending: false });
  const ownerless = (removals || []).flatMap((r) => ((r.moved as Record<string, string[]> | null)?.["clients.created_by"] ?? []));
  const ownerlessNow = ownerless.length
    ? new Set(((await db.from("clients").select("id").in("id", ownerless).is("created_by", null)).data || []).map((c) => c.id as string))
    : new Set<string>();
  for (const r of removals || []) {
    const ids = ((r.moved as Record<string, string[]> | null)?.["clients.created_by"] ?? []).filter((id) => ownerlessNow.has(id));
    const moved = (r.moved as Record<string, string[]> | null) ?? {};
    const toReassign = (moved["visit_assignments.assigned_to"] ?? []).length;
    const parts: string[] = [];
    if (ids.length) parts.push(plural(ids.length, "negocio sin dueño", "negocios sin dueño"));
    if (r.self_requested && toReassign) parts.push(plural(toReassign, "asignación por reasignar", "asignaciones por reasignar"));
    if (r.self_requested && r.exit_rating) parts.push(`dejó ${r.exit_rating}/5`);
    parts.push(`baja ${agoLabel(r.removed_at as string)}`);
    alerts.push({
      key: `ad:baja:${r.id}`,
      kind: "pendiente",
      tone: "warn",
      emoji: "🗂️",
      title: r.self_requested ? `${r.full_name || r.email} eliminó su cuenta` : `Revisa los registros de ${r.full_name || r.email}`,
      detail: parts.length > 1 ? parts.join(" · ") : `Baja ${agoLabel(r.removed_at as string)} · falta marcar la revisión`,
      href: "/admin/bajas",
    });
  }
  return alerts;
}

// -------------------------------------------------------------- Sibarita
async function sibaritaAlerts(db: Db, userId: string): Promise<HomeAlert[]> {
  const alerts: HomeAlert[] = [...(await poolAlerts(db, userId, "sibarita"))];
  const { data: mine } = await db.from("clients").select("id, name").eq("created_by", userId);
  const ids = (mine || []).map((c) => c.id as string);
  if (ids.length === 0) return alerts;
  const nameOf = new Map((mine || []).map((c) => [c.id as string, c.name as string]));

  const [{ data: sales }, { data: plans }] = await Promise.all([
    db
      .from("forms")
      .select("id, client_id, report_unlocked_at")
      .in("client_id", ids)
      .is("plan_id", null)
      .gte("report_unlocked_at", new Date(Date.now() - RECENT_DAYS * DAY_MS).toISOString())
      .order("report_unlocked_at", { ascending: false }),
    db
      .from("client_plans")
      .select("id, client_id, plan_name, created_at")
      .in("client_id", ids)
      .neq("status", "cancelado")
      .gte("created_at", new Date(Date.now() - 14 * DAY_MS).toISOString()),
  ]);
  for (const f of sales || []) {
    alerts.push({
      key: `sb:venta:${f.id}`,
      kind: "aviso",
      tone: "ok",
      emoji: "💰",
      title: `${nameOf.get(f.client_id as string)} compró el reporte completo`,
      detail: `${agoLabel(f.report_unlocked_at as string)} · cuenta en tus ganancias`,
      href: `/negocios/${f.client_id}`,
    });
  }
  for (const p of plans || []) {
    alerts.push({
      key: `sb:plan:${p.id}`,
      kind: "aviso",
      tone: "ok",
      emoji: "🍽️",
      title: `${nameOf.get(p.client_id as string)} contrató el plan ${p.plan_name}`,
      detail: `${agoLabel(p.created_at as string)} · sus visitas generan ganancia cada mes`,
      href: `/negocios/${p.client_id}`,
    });
  }
  return alerts;
}

/** Avisos de Pendientes para quien abre el Inicio, ya sin los que cerró (ver reglas arriba). */
export async function getHomeAlerts(profile: { userId: string; role: string }): Promise<HomeAlert[]> {
  const db = getSupabaseServiceClient();

  const [raw, dismissed] = await Promise.all([
    profile.role === "agente"
      ? Promise.all([foodieAlerts(profile.userId), poolAlerts(db, profile.userId, "agente")]).then(([a, b]) => [...a, ...b])
      : profile.role === "admin"
        ? adminAlerts(db)
        : profile.role === "sibarita"
          ? sibaritaAlerts(db, profile.userId)
          : Promise.resolve([] as HomeAlert[]),
    db.from("alert_dismissals").select("alert_key, dismissed_at").eq("user_id", profile.userId),
  ]);

  const closedAt = new Map((dismissed.data || []).map((d) => [d.alert_key as string, new Date(d.dismissed_at as string).getTime()]));
  return raw
    .filter((a) => {
      const t = closedAt.get(a.key);
      if (t === undefined) return true;
      return a.kind === "pendiente" && Date.now() - t > DAY_MS; // pendiente reaparece a las 24 h
    })
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}
