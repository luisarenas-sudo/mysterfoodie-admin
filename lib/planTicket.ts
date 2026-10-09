import { getSupabaseServiceClient } from "./supabase";
import { monthLabel } from "./earnings";
import { sendPlanTicketEmail, type SendEmailOutcome } from "./email";
import { PLAN_CATALOG, isPlanKey, planFolio, type PlanRow } from "./plans";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export type TicketOutcome = SendEmailOutcome | { status: "skipped_no_email" };

/**
 * Manda el ticket de servicio del plan al correo del negocio (con copia
 * oculta al equipo) y marca ticket_sent_at. Si el negocio no tiene correo,
 * no manda nada: el equipo contacta al cliente por su cuenta.
 */
export async function sendTicketForPlan(db: Db, plan: PlanRow): Promise<TicketOutcome> {
  const { data: client } = await db.from("clients").select("name, email").eq("id", plan.clientId).maybeSingle();
  if (!client?.email) return { status: "skipped_no_email" };

  const catalog = isPlanKey(plan.planKey) ? PLAN_CATALOG[plan.planKey] : null;
  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const whatsappLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(`Hola, tengo una duda sobre el plan ${plan.planName} de ${client.name}.`)}`
    : null;

  const outcome = await sendPlanTicketEmail({
    to: client.email,
    bcc: process.env.ADMIN_EMAIL || null,
    businessName: client.name,
    planName: plan.planName,
    tagline: catalog?.tagline ?? "Plan mensual",
    visitsPerMonth: plan.visitsPerMonth,
    pricePerVisit: plan.pricePerVisit,
    startMonthLabel: monthLabel(plan.startMonth),
    folio: planFolio(plan.id),
    includes: catalog ? [...catalog.includes] : ["Visitas Mystery Shopper anónimas", "Reporte completo (PDF) de cada visita"],
    issuedAt: new Date(),
    whatsappLink,
  });

  if (outcome.status === "sent") {
    await db.from("client_plans").update({ ticket_sent_at: new Date().toISOString() }).eq("id", plan.id);
  }
  return outcome;
}
