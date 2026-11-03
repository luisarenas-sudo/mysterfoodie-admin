import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { SABER_MAS } from "./links";
import { getAutomation, renderTemplate } from "./automations";
import { inNotificationWindow } from "./visitRequests";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Correo (una sola vez) que celebra a un negocio que ya es VIP: tiene un plan o paquete de visitas contratado. Sale 1 día
 * después de contratarlo (para no encimarse con el correo del acuerdo del plan) y solo para contrataciones de los últimos
 * 14 días, así no se le escribe de golpe a quien lleva tiempo. Tono «ustedes». Marca `clients.vip_email_sent_at`.
 */
const DAY_MS = 86400000;
export const VIP_AFTER_DAYS = 1;
export const VIP_MAX_AGE_DAYS = 14;

export const VIP_SUBJECT = "¡{{negocio}} ya es VIP en MysterFoodie!";
export const VIP_BODY = `Hola equipo de {{negocio}},

¡Felicidades, ya son un negocio VIP de MysterFoodie! Que sigan con nosotros más allá de su primera visita nos dice que confían en nuestra metodología, en el equipo de MysterFoodies que los visita y en Flanco Izquierdo®, y queremos celebrarlo con ustedes.

Ser VIP significa que ya son parte de la mesa: su plan {{plan}} está en marcha y el equipo les da seguimiento cercano. Si quieren sumar más sucursales o más visitas al mes, respondan este correo y lo platicamos.

Aquí pueden ver su avance y sus reportes:
{{link_mi_negocio}}

Gracias por confiar en nosotros.

Saludos,
MysterFoodie`;

export async function sendDueVipEmails(db: Db, baseUrl: string): Promise<{ sent: number; skipped: number; failed: number; note?: string }> {
  if (!inNotificationWindow()) return { sent: 0, skipped: 0, failed: 0, note: "fuera de horario hábil" };
  const now = Date.now();
  const { data: plans, error } = await db
    .from("client_plans")
    .select("client_id, plan_name, created_at")
    .in("status", ["activo", "pausado"])
    .lte("created_at", new Date(now - VIP_AFTER_DAYS * DAY_MS).toISOString())
    .gte("created_at", new Date(now - VIP_MAX_AGE_DAYS * DAY_MS).toISOString())
    .limit(100);
  if (error) throw new Error(error.message);

  const automation = await getAutomation("vip_bienvenida").catch(() => null);
  const seen = new Set<string>();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const plan of plans ?? []) {
    const clientId = plan.client_id as string;
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    const { data: client, error: cErr } = await db.from("clients").select("id, name, email, vip_email_sent_at").eq("id", clientId).maybeSingle();
    if (cErr) throw new Error(`Falta correr supabase/vip_negocios.sql (${cErr.message})`);
    if (!client || client.vip_email_sent_at || !client.email) {
      skipped++;
      continue;
    }
    // Se reclama primero (así dos corridas no mandan el mismo correo) y se suelta si el envío falla.
    const { data: claimed } = await db
      .from("clients")
      .update({ vip_email_sent_at: new Date().toISOString() })
      .eq("id", clientId)
      .is("vip_email_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const vars = { negocio: client.name as string, plan: ((plan.plan_name as string | null) || "").trim() || "de visitas", link_mi_negocio: `${baseUrl}/mi-negocio` };
    const custom = automation?.enabled;
    const outcome = await sendTemplatedEmail({
      to: client.email as string,
      subject: renderTemplate(custom && automation.subjectTemplate ? automation.subjectTemplate : VIP_SUBJECT, vars),
      bodyText: renderTemplate(custom && automation.bodyTemplate ? automation.bodyTemplate : VIP_BODY, vars),
      ctaLabel: "Ver mi negocio",
      saberMas: [SABER_MAS.metodologia],
    });
    if (outcome.status === "sent") sent++;
    else {
      failed++;
      await db.from("clients").update({ vip_email_sent_at: null }).eq("id", clientId);
    }
  }
  return { sent, skipped, failed };
}
