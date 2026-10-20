import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { getAutomation, renderTemplate } from "./automations";
import { getProfileOffer } from "./mysterfoodieProfile";
import { getOwnedTiers } from "./profilePurchases";
import { TIERS } from "./personaCatalog";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/** Días después de desbloquear el reporte (o de una visita de plan) en que se ofrece destapar el perfil del MysterFoodie. */
export const PERFIL_OFERTA_DELAY_DAYS = 2;
export const PERFIL_OFERTA_CTA = "Destapar el perfil de mi MysterFoodie";

export const PERFIL_OFERTA_DEFAULT = {
  subject: "Destapa el perfil del MysterFoodie que visitó {{negocio}}",
  body:
    "Hola equipo de {{negocio}},\n\n" +
    "Destapa el perfil de tu MysterFoodie: conoce más sobre su estilo de vida, el tipo de restaurantes que frecuenta y sus generalidades demográficas. " +
    "El buyer persona completo de quien los visitó el {{fecha_visita}}, sin perder su anonimato.\n\n" +
    "Nivel ID ({{precio_id}}): sus gustos, las palabras que más usa en sus reseñas, con cuántas personas sale, cuánto consume y el sector que representa.\n" +
    "Nivel Passport ({{precio_passport}}): además, su estilo de vida, demografía, movilidad y los medios que usa.\n\n" +
    "Es un pago único y la información siempre es anónima: sin nombre, foto ni datos de contacto.\n\n" +
    "{{link_perfil}}\n\nSaludos,\nMysterFoodie",
};

const dateLabel = (iso: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }).format(new Date(iso));

export function perfilOfertaVars(p: { negocio: string; visitDate: string; link: string }): Record<string, string> {
  return {
    negocio: p.negocio,
    fecha_visita: dateLabel(p.visitDate),
    precio_id: `$${TIERS.id.price} MXN + IVA`,
    precio_passport: `$${TIERS.passport.price} MXN + IVA`,
    link_perfil: p.link,
  };
}

/**
 * Ofrece "Destapa el perfil de tu MysterFoodie" a los negocios con reporte completo (pagado o de un plan), una vez por
 * visita. Solo si la persona comparte al menos un bloque y el negocio aún no compró su perfil. Cron diario.
 */
export async function sendDuePerfilOffers(db: Db, baseUrl: string, now: Date = new Date()): Promise<{ sent: number; results: { formId: string; status: string }[] }> {
  const cutoff = new Date(now.getTime() - PERFIL_OFERTA_DELAY_DAYS * 86400000).toISOString();
  const { data: forms, error } = await db
    .from("forms")
    .select("id, client_id, created_by, created_at, report_unlocked_at, plan_id")
    .is("profile_offer_sent_at", null)
    .not("created_by", "is", null)
    .or(`report_unlocked_at.lte.${cutoff},and(plan_id.not.is.null,created_at.lte.${cutoff})`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const automation = await getAutomation("perfil_oferta");
  if (automation && !automation.enabled) {
    // Desactivada del todo: no se manda nada (a diferencia de "Texto original", aquí el panel la apaga).
    return { sent: 0, results: [] };
  }
  const subjectTpl = automation?.subjectTemplate || PERFIL_OFERTA_DEFAULT.subject;
  const bodyTpl = automation?.bodyTemplate || PERFIL_OFERTA_DEFAULT.body;

  const results: { formId: string; status: string }[] = [];
  const offeredPairs = new Set<string>();
  for (const form of forms ?? []) {
    const pair = `${form.client_id}:${form.created_by}`;
    const mark = (at: Date) => db.from("forms").update({ profile_offer_sent_at: at.toISOString() }).eq("id", form.id);

    // Una oferta por negocio y MysterFoodie: las demás visitas se marcan sin mandar.
    if (offeredPairs.has(pair)) { await mark(now); results.push({ formId: form.id, status: "duplicada" }); continue; }
    const { count: prior } = await db
      .from("forms").select("id", { count: "exact", head: true })
      .eq("client_id", form.client_id).eq("created_by", form.created_by).not("profile_offer_sent_at", "is", null);
    if ((prior ?? 0) > 0) { await mark(now); results.push({ formId: form.id, status: "duplicada" }); continue; }

    const offer = await getProfileOffer(form.created_by as string);
    if (!offer || !offer.idAvailable) { results.push({ formId: form.id, status: "sin_bloques" }); continue; } // se reintenta cuando comparta algo
    const owned = await getOwnedTiers(form.client_id as string, form.created_by as string);
    if (owned.size > 0) { await mark(now); results.push({ formId: form.id, status: "ya_compro" }); continue; }

    const { data: client } = await db.from("clients").select("name, email").eq("id", form.client_id).maybeSingle();
    if (!client?.email) { results.push({ formId: form.id, status: "sin_correo" }); continue; }

    const vars = perfilOfertaVars({ negocio: client.name, visitDate: form.created_at, link: `${baseUrl.replace(/\/$/, "")}/mi-negocio/mysterfoodie/${form.id}` });
    const subject = renderTemplate(subjectTpl, vars);
    const outcome = await sendTemplatedEmail({ to: client.email, subject, bodyText: renderTemplate(bodyTpl, vars), ctaLabel: PERFIL_OFERTA_CTA });
    await db.from("email_confirmations").insert({
      form_id: form.id,
      recipient_email: client.email,
      subject,
      status: outcome.status,
      provider_id: outcome.providerId || null,
      error: outcome.error || null,
    });
    if (outcome.status === "sent") {
      await mark(now);
      offeredPairs.add(pair);
    }
    results.push({ formId: form.id, status: outcome.status });
  }
  return { sent: results.filter((r) => r.status === "sent").length, results };
}
