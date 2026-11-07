import { getSupabaseServiceClient } from "./supabase";
import { getMonthEarnings } from "./earnings";
import { getMonthProfileSales } from "./profileSales";
import { CDMX_OFFSET, shiftMonth } from "./months";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Reporte mensual de ventas y pagos. Una fila por persona (Sibarita o Shopper) con lo que hay que depositarle por el mes
 * (visitas + perfiles anónimos), y el resumen del mes: a depositar, lo que queda a la plataforma y ventas brutas.
 * Se genera al cerrar el mes (cron del día 1) o a mano desde Finanzas > Pagos. Los pagos ya marcados NO se tocan al recalcular.
 */

export type PayoutLine = {
  personId: string;
  name: string;
  role: string;
  email: string | null;
  visitsAmount: number;
  profilesAmount: number;
  total: number;
  salesCount: number;
};

export type MonthPlan = {
  month: string;
  lines: PayoutLine[];
  gross: number;
  toPay: number;
  paidAside: number;
  platform: number;
  unclassified: number;
  unpaidPlanAmount: number;
};

export type PayoutReport = {
  month: string;
  generatedAt: string;
  gross: number;
  toPay: number;
  platform: number;
  paidAside: number;
  unclassified: number;
  unpaidPlanAmount: number;
  emailSentAt: string | null;
  openedAt: string | null;
};

export type PayoutRow = PayoutLine & { id: string; paidAt: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Un mes solo se puede cerrar cuando ya terminó (hora CDMX). */
export function previousMonthCdmx(now = new Date()): string {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(now);
  return shiftMonth(s.slice(0, 7), -1);
}

export function monthIsClosed(month: string, now = new Date()): boolean {
  return new Date(`${shiftMonth(month, 1)}-01T00:00:00${CDMX_OFFSET}`).getTime() <= now.getTime();
}

/** Calcula el mes sin guardar nada. */
export async function computeMonthPlan(month: string): Promise<MonthPlan> {
  const db = getSupabaseServiceClient();
  const { visits, unpaidPlan } = await getMonthEarnings(month);
  const sales = await getMonthProfileSales(month).catch(() => []);

  const acc = new Map<string, { visits: number; profiles: number; count: number }>();
  const add = (id: string | null, kind: "visits" | "profiles", amount: number) => {
    if (!id || !(amount > 0)) return;
    const cur = acc.get(id) ?? { visits: 0, profiles: 0, count: 0 };
    cur[kind] += amount;
    cur.count += 1;
    acc.set(id, cur);
  };

  let gross = 0;
  let adminPart = 0;
  for (const v of visits) {
    gross += v.price;
    adminPart += v.admin;
    add(v.sibaritaId, "visits", v.sibarita);
    add(v.foodieId, "visits", v.foodie);
  }
  let paidAside = 0;
  let profilePlatform = 0;
  for (const s of sales) {
    // Lo que pagó el negocio = precio del perfil + cargo por uso; el MysterFoodie recibe su parte, el resto es de la plataforma.
    gross += (s.price ?? s.share) + s.fee;
    profilePlatform += Math.max(0, (s.price ?? s.share) - s.share) + s.fee;
    if (s.status === "pagado") paidAside += s.share;
    else add(s.mysterfoodieId, "profiles", s.share);
  }

  const ids = [...acc.keys()];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, alias, email, role").in("id", ids) : { data: [] as { id: string; full_name: string | null; alias: string | null; email: string | null; role: string }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const lines: PayoutLine[] = ids
    .map((id) => {
      const a = acc.get(id)!;
      const p = byId.get(id);
      return {
        personId: id,
        name: p?.full_name || p?.alias || p?.email || "Sin nombre",
        role: p?.role ?? "agente",
        email: p?.email ?? null,
        visitsAmount: r2(a.visits),
        profilesAmount: r2(a.profiles),
        total: r2(a.visits + a.profiles),
        salesCount: a.count,
      };
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);

  const toPay = r2(lines.reduce((s, l) => s + l.total, 0));
  const platform = r2(adminPart + profilePlatform);
  return {
    month,
    lines,
    gross: r2(gross),
    toPay,
    paidAside: r2(paidAside),
    platform,
    unclassified: visits.filter((v) => v.scenario === null).length,
    unpaidPlanAmount: r2(unpaidPlan.amount),
  };
}

/**
 * Guarda (o actualiza) el reporte del mes. Los pagos ya marcados no se modifican; las filas sin pagar se ajustan a lo que
 * salga hoy y las que ya no tienen ventas se quitan.
 */
export async function generateMonthReport(month: string): Promise<{ report: PayoutReport; created: boolean }> {
  const db = getSupabaseServiceClient();
  const plan = await computeMonthPlan(month);
  const { data: existing } = await db.from("monthly_payout_reports").select("month").eq("month", month).maybeSingle();

  const { data: oldRows } = await db.from("monthly_payouts").select("id, person_id, paid_at").eq("month", month);
  const oldByPerson = new Map((oldRows ?? []).map((r) => [r.person_id as string, r]));

  // 1) El reporte (sin tocar email_sent_at / opened_at si ya existe).
  const base = {
    gross: plan.gross,
    paid_aside: plan.paidAside,
    unclassified_count: plan.unclassified,
    unpaid_plan_amount: plan.unpaidPlanAmount,
  };
  if (existing) await db.from("monthly_payout_reports").update({ ...base, generated_at: new Date().toISOString() }).eq("month", month);
  else await db.from("monthly_payout_reports").insert({ month, ...base, to_pay: 0, platform: 0 });

  // 2) Filas por persona: las pagadas se quedan como están.
  for (const l of plan.lines) {
    const old = oldByPerson.get(l.personId);
    if (old?.paid_at) continue;
    const row = { month, person_id: l.personId, visits_amount: l.visitsAmount, profiles_amount: l.profilesAmount, total: l.total, sales_count: l.salesCount };
    if (old) await db.from("monthly_payouts").update(row).eq("id", old.id as string);
    else await db.from("monthly_payouts").insert(row);
  }
  const keep = new Set(plan.lines.map((l) => l.personId));
  const stale = (oldRows ?? []).filter((r) => !r.paid_at && !keep.has(r.person_id as string)).map((r) => r.id as string);
  if (stale.length) await db.from("monthly_payouts").delete().in("id", stale);

  // 3) Totales con lo que realmente quedó guardado (incluye montos de filas ya pagadas).
  const { data: rows } = await db.from("monthly_payouts").select("total").eq("month", month);
  const toPay = r2((rows ?? []).reduce((s, r) => s + Number(r.total), 0));
  const platform = r2(plan.gross - toPay - plan.paidAside);
  await db.from("monthly_payout_reports").update({ to_pay: toPay, platform }).eq("month", month);

  const report = (await getReport(db, month))!;
  return { report, created: !existing };
}

function toReport(r: Record<string, unknown>): PayoutReport {
  return {
    month: r.month as string,
    generatedAt: r.generated_at as string,
    gross: Number(r.gross),
    toPay: Number(r.to_pay),
    platform: Number(r.platform),
    paidAside: Number(r.paid_aside),
    unclassified: Number(r.unclassified_count),
    unpaidPlanAmount: Number(r.unpaid_plan_amount),
    emailSentAt: (r.email_sent_at as string | null) ?? null,
    openedAt: (r.opened_at as string | null) ?? null,
  };
}

export async function getReport(db: Db, month: string): Promise<PayoutReport | null> {
  const { data } = await db.from("monthly_payout_reports").select("*").eq("month", month).maybeSingle();
  return data ? toReport(data) : null;
}

export async function getPayoutRows(db: Db, month: string): Promise<PayoutRow[]> {
  const { data } = await db.from("monthly_payouts").select("id, person_id, visits_amount, profiles_amount, total, sales_count, paid_at").eq("month", month).order("total", { ascending: false });
  const rows = data ?? [];
  const ids = rows.map((r) => r.person_id as string);
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, alias, email, role").in("id", ids) : { data: [] as { id: string; full_name: string | null; alias: string | null; email: string | null; role: string }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.person_id as string);
    return {
      id: r.id as string,
      personId: r.person_id as string,
      name: p?.full_name || p?.alias || p?.email || "Sin nombre",
      role: p?.role ?? "agente",
      email: p?.email ?? null,
      visitsAmount: Number(r.visits_amount),
      profilesAmount: Number(r.profiles_amount),
      total: Number(r.total),
      salesCount: Number(r.sales_count),
      paidAt: (r.paid_at as string | null) ?? null,
    };
  });
}

/**
 * Marca (o desmarca) el pago de una persona. Al marcar, también se dan por pagadas sus ganancias de perfil anónimo de ese mes
 * (profile_earnings), para que "Ganancias de perfiles" y este reporte nunca se contradigan.
 */
export async function setPayoutPaid(db: Db, opts: { month: string; personId: string; paid: boolean; by: string }): Promise<boolean> {
  const { month, personId, paid, by } = opts;
  const { data, error } = await db
    .from("monthly_payouts")
    .update(paid ? { paid_at: new Date().toISOString(), paid_by: by } : { paid_at: null, paid_by: null })
    .eq("month", month)
    .eq("person_id", personId)
    .select("id");
  if (error || !data?.length) return false;
  if (paid) {
    const start = new Date(`${month}-01T00:00:00${CDMX_OFFSET}`).toISOString();
    const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00${CDMX_OFFSET}`).toISOString();
    await db
      .from("profile_earnings")
      .update({ status: "pagado", paid_at: new Date().toISOString() })
      .eq("mysterfoodie_id", personId)
      .eq("status", "pendiente")
      .gte("created_at", start)
      .lt("created_at", end);
  }
  return true;
}
