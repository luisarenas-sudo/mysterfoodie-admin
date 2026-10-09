import { getSupabaseServiceClient } from "./supabase";
import { monthLabel } from "./earnings";
import { sendPlanTicketEmail, type SendEmailOutcome } from "./email";
import { PLAN_CATALOG, isPlanKey, mapPlan, planFolio, type PlanRow } from "./plans";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export type TicketOutcome = SendEmailOutcome | { status: "skipped_no_email" };

/** Nombre común de varias sucursales: "Tacos El Bronco Virginia" + "Tacos El Bronco Lagos" -> "Tacos El Bronco". */
export function brandLabel(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "Negocio";
  const split = names.map((n) => n.trim().split(/\s+/));
  const common: string[] = [];
  for (let i = 0; i < split[0].length; i++) {
    const w = split[0][i];
    if (split.every((parts) => parts[i]?.toLowerCase() === w.toLowerCase())) common.push(w);
    else break;
  }
  return common.length > 0 ? common.join(" ") : `${names[0]} y ${names.length - 1} más`;
}

/**
 * Manda el ticket de servicio del plan al correo del negocio (con copia
 * oculta al equipo) y marca ticket_sent_at. En una contratación de varias
 * sucursales sale UN solo ticket con todas, al correo indicado o al de la
 * primera sucursal que tenga. Si no hay correo, no manda nada: el equipo
 * contacta al cliente por su cuenta.
 */
export async function sendTicketForPlan(db: Db, plan: PlanRow, opts: { to?: string | null } = {}): Promise<TicketOutcome> {
  let plans: PlanRow[] = [plan];
  if (plan.groupId) {
    const { data } = await db.from("client_plans").select("*").eq("group_id", plan.groupId).neq("status", "cancelado");
    const all = (data || []).map(mapPlan);
    // la sucursal desde donde se pidió va primero (su correo es el preferido)
    plans = [plan, ...all.filter((p) => p.id !== plan.id)];
  }

  const { data: clients } = await db.from("clients").select("id, name, email").in("id", plans.map((p) => p.clientId));
  const byId = new Map((clients || []).map((c) => [c.id as string, c]));
  const names = plans.map((p) => (byId.get(p.clientId)?.name as string | undefined) ?? "Sucursal");
  const to = opts.to?.trim() || plans.map((p) => byId.get(p.clientId)?.email as string | null | undefined).find(Boolean) || null;
  if (!to) return { status: "skipped_no_email" };

  const brand = brandLabel(names);
  const catalog = isPlanKey(plan.planKey) ? PLAN_CATALOG[plan.planKey] : null;
  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const whatsappLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(`Hola, tengo una duda sobre el plan ${plan.planName} de ${brand}.`)}`
    : null;

  const outcome = await sendPlanTicketEmail({
    to,
    bcc: process.env.ADMIN_EMAIL || null,
    businessName: brand,
    sucursales: plans.length > 1 ? names : undefined,
    planName: plan.planName,
    tagline: catalog?.tagline ?? "Plan mensual",
    visitsPerMonth: plan.visitsPerMonth,
    pricePerVisit: plan.pricePerVisit,
    startMonthLabel: monthLabel(plan.startMonth),
    folio: planFolio(plan.groupId ?? plan.id),
    includes: catalog ? [...catalog.includes] : ["Visitas Mystery Shopper anónimas", "Reporte completo (PDF) de cada visita"],
    issuedAt: new Date(),
    whatsappLink,
  });

  if (outcome.status === "sent") {
    await db.from("client_plans").update({ ticket_sent_at: new Date().toISOString() }).in("id", plans.map((p) => p.id));
  }
  return outcome;
}
