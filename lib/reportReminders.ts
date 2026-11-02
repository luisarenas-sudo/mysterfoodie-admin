import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { isRequestedVisit } from "./visitRequests";
import { businessTypePhrase, TOTAL_ITEM_COUNT } from "./categories";
import { buildTeaser } from "./reportTeaser";
import type { Ratings } from "./scoring";
import { FULL_REPORT_PRICE_MXN } from "./mercadopago";
import { PACKAGES_URL } from "./links";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Recordatorios a un negocio que recibió su resultado y no compró el reporte completo: solo información y ayuda, sin
 * descuentos ni cuenta regresiva. Dos correos y ya:
 *  - día 2: «tu resultado sigue disponible», con el adelanto de su visita;
 *  - día 7: invitación a darle seguimiento con los paquetes mensuales (y se avisa que es el último mensaje).
 * Se corre una vez al día (10:00 am CDMX). Se detienen si compra, si el negocio tiene un plan o si pidió no recibirlos.
 */
const DAY_MS = 86400000;
const FIRST_AFTER_DAYS = 2;
const SECOND_AFTER_DAYS = 7;
const GIVE_UP_AFTER_DAYS = 21;
/** Si el negocio acaba de dejar su correo (y le llegó el resumen), el primer recordatorio espera al menos esto. */
const AFTER_LEAD_HOURS = 24;

export const reminderOptOutUrl = (baseUrl: string, shortCode: string) => `${baseUrl}/api/reportes/baja?c=${encodeURIComponent(shortCode)}`;

function optOutLine(baseUrl: string, shortCode: string): string {
  return `Si prefieren no recibir más mensajes sobre este resultado, avísennos aquí: ${reminderOptOutUrl(baseUrl, shortCode)}`;
}

export function reminder1Text(p: { negocio: string; tipo: string; requested: boolean; teaser: { title: string; detail: string } | null; reportUrl: string; baseUrl: string; shortCode: string }) {
  const detalle = p.requested
    ? `Si quieren el detalle de los ${TOTAL_ITEM_COUNT} indicadores y los comentarios del MysterFoodie, desde su resultado pueden programar una visita con reporte completo ($${FULL_REPORT_PRICE_MXN} MXN + el consumo de la visita) o conocer nuestros paquetes.`
    : `El reporte completo ($${FULL_REPORT_PRICE_MXN} MXN sin IVA, pago único) incluye el detalle de los ${TOTAL_ITEM_COUNT} indicadores, los comentarios del MysterFoodie, el ticket de consumo si lo hay y una asesoría de 20 minutos.`;
  return {
    subject: `Su resultado de ${p.negocio} sigue disponible`,
    bodyText:
      `Hola equipo de ${p.negocio},\n\n` +
      `Hace unos días un MysterFoodie visitó su ${p.tipo} y su resultado sigue disponible por si quieren verlo con calma.\n\n` +
      (p.teaser ? `${p.teaser.title}. ${p.teaser.detail}\n\n` : "") +
      `${detalle} Si les surge alguna duda, respondan este correo y con gusto les ayudamos.\n\n` +
      `${p.reportUrl}\n\n` +
      optOutLine(p.baseUrl, p.shortCode),
    ctaLabel: "Ver mi resultado",
  };
}

export function reminder2Text(p: { negocio: string; baseUrl: string; shortCode: string }) {
  return {
    subject: `¿Quieren darle seguimiento a su resultado, ${p.negocio}?`,
    bodyText:
      `Hola equipo de ${p.negocio},\n\n` +
      `Si el resultado de su visita les sirvió, la mejor forma de saber si algo mejora es repetir la evaluación con la misma escala cada mes. ` +
      `Para eso tenemos paquetes mensuales: Starter (1 sucursal, 3 visitas al mes) y, para varias sucursales, Appetizer y Main course. ` +
      `Todos incluyen el reporte completo de cada visita y seguimiento personalizado.\n\n` +
      `Pueden compararlos aquí, sin compromiso:\n\n${PACKAGES_URL}\n\n` +
      `Este es el último mensaje que les enviamos sobre este resultado. Quedamos a sus órdenes en hola@mysterfoodie.com.\n\n` +
      optOutLine(p.baseUrl, p.shortCode),
    ctaLabel: "Ver los paquetes",
  };
}

export async function sendDueReportReminders(db: Db, baseUrl: string): Promise<{ checked: number; first: number; second: number; skipped: number }> {
  const out = { checked: 0, first: 0, second: 0, skipped: 0 };
  const now = Date.now();
  const { data: forms, error } = await db
    .from("forms")
    .select("id, client_id, short_code, overall_score, created_at, report_url, lead_email, lead_email_at, remind1_sent_at, remind2_sent_at")
    .is("plan_id", null)
    .is("report_unlocked_at", null)
    .is("followup_optout_at", null)
    .gte("created_at", new Date(now - GIVE_UP_AFTER_DAYS * DAY_MS).toISOString())
    .lt("created_at", new Date(now - FIRST_AFTER_DAYS * DAY_MS).toISOString())
    .limit(300);
  if (error) throw new Error(error.message);
  if (!forms || forms.length === 0) return out;

  const clientIds = [...new Set(forms.map((f) => f.client_id as string))];
  const [{ data: clients }, { data: plans }] = await Promise.all([
    db.from("clients").select("id, name, type, email").in("id", clientIds),
    db.from("client_plans").select("client_id").in("client_id", clientIds).neq("status", "cancelado"),
  ]);
  const clientOf = new Map((clients || []).map((c) => [c.id as string, c]));
  const withPlan = new Set((plans || []).map((p) => p.client_id as string));

  for (const f of forms) {
    out.checked += 1;
    const ageDays = (now - new Date(f.created_at as string).getTime()) / DAY_MS;
    const stage: 1 | 2 | null =
      !f.remind1_sent_at && ageDays < SECOND_AFTER_DAYS ? 1 : !f.remind2_sent_at && ageDays >= SECOND_AFTER_DAYS ? 2 : null;
    const client = clientOf.get(f.client_id as string);
    const to = ((f.lead_email as string | null) || (client?.email as string | null) || "").trim();
    const justLeft = f.lead_email_at && now - new Date(f.lead_email_at as string).getTime() < AFTER_LEAD_HOURS * 3600 * 1000;
    if (!stage || !client || !to || withPlan.has(f.client_id as string) || (stage === 1 && justLeft)) {
      out.skipped += 1;
      continue;
    }

    const col = stage === 1 ? "remind1_sent_at" : "remind2_sent_at";
    const { data: claimed } = await db.from("forms").update({ [col]: new Date().toISOString() }).eq("id", f.id as string).is(col, null).select("id");
    if (!claimed || claimed.length === 0) continue; // otra corrida ya lo tomó

    const shortCode = f.short_code as string;
    const reportUrl = (f.report_url as string | null) || `${baseUrl}/r/${shortCode}`;
    let msg: { subject: string; bodyText: string; ctaLabel: string };
    if (stage === 1) {
      const [{ data: ratingRows }, requested] = await Promise.all([
        db.from("form_ratings").select("category_key, score").eq("form_id", f.id as string),
        isRequestedVisit(db, { id: f.id as string, client_id: f.client_id as string, created_at: f.created_at as string }).catch(() => false),
      ]);
      const ratings: Ratings = {};
      (ratingRows || []).forEach((r) => {
        ratings[r.category_key] = r.score;
      });
      msg = reminder1Text({
        negocio: client.name as string,
        tipo: businessTypePhrase(client.type as string) || "negocio",
        requested,
        teaser: buildTeaser(ratings),
        reportUrl,
        baseUrl,
        shortCode,
      });
    } else {
      msg = reminder2Text({ negocio: client.name as string, baseUrl, shortCode });
    }

    const res = await sendTemplatedEmail({ to, subject: msg.subject, bodyText: msg.bodyText, ctaLabel: msg.ctaLabel });
    if (res.status === "sent") {
      if (stage === 1) out.first += 1;
      else out.second += 1;
    } else {
      // No salió: se libera para reintentar mañana (si no hay llave de correo configurada, tampoco se cuenta como enviado).
      await db.from("forms").update({ [col]: null }).eq("id", f.id as string);
      out.skipped += 1;
    }
  }
  return out;
}
