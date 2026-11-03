import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { SABER_MAS } from "./links";
import { getAutomation, renderTemplate } from "./automations";
import { inNotificationWindow } from "./visitRequests";
import { formatMxn } from "./earningsMatrix";
import type { EmailCallout } from "./earningsCopy";
import { BLOCKS, MAX_EARNINGS_ID, MAX_EARNINGS_PER_SALE, MIN_VISITS_PASSPORT, MYSTERFOODIE_SHARE_PCT, isBlockKey } from "./personaCatalog";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Correo (una sola vez) a los perfiles nuevos del equipo (Shopper, Sibarita, Master Chef) para que llenen su perfil anónimo y
 * ganen por cada venta. Espeja la tarea del Inicio: sale cuando se cumple el día 1 de tener cuenta (el mismo momento de la
 * tarea del nivel ID) y aquí explica los DOS niveles, ID y Passport; en la app el recordatorio de Passport llega aparte.
 * Solo a cuentas creadas en los últimos 14 días (no se le escribe de golpe a quien ya lleva tiempo) y solo en horario hábil.
 */
const DAY_MS = 86400000;
export const INVITE_AFTER_DAYS = 1;
export const INVITE_MAX_AGE_DAYS = 14;
const TEAM_ROLES = ["agente", "sibarita", "admin"];

export const PERFIL_INVITE_SUBJECT = "Completa tu perfil anónimo y gana más con cada venta";
export const PERFIL_INVITE_BODY = `Hola {{foodie}},

{{parrafo_nombre}}

Los negocios que visites en MysterFoodie pueden comprar tu perfil anónimo y tú te llevas el ${MYSTERFOODIE_SHARE_PCT}% del precio de cada venta. Tú decides qué compartes, en dos niveles:

🪪 Nivel ID: tus gustos y palabras, cómo consumes y de qué zona eres. Son 3 secciones y toma unos minutos.

👑 Nivel Passport: tu buyer persona completo (demografía, estilo de vida, movilidad y viajes, y medios). Se entrega a partir de tu visita ${MIN_VISITS_PASSPORT}, pero puedes dejar tus respuestas listas desde ahora.

Empieza por el ID y, cuando quieras, sigue con el Passport. Lo puedes editar en cualquier momento desde tu perfil:

{{link_perfil}}

Saludos,
MysterFoodie`;

/**
 * Párrafo sobre el nombre anónimo: por qué existe y, si se puede, cómo cambiarlo. Perfiles nuevos (alias_capped): el nombre
 * se elige una vez y queda fijo; perfiles que ya existían pueden cambiarlo; sin nombre aún, se invita a descubrir el suyo.
 */
export function nombreAnonimoParrafo(alias: string | null, capped: boolean, linkNombre: string): string {
  const porque =
    "Es tu nombre anónimo: lo usamos para que, cuando un negocio vea tu perfil, conozca lo que piensas y consumes sin saber quién eres. Nunca aparecen tu nombre real, tu foto ni tus datos de contacto.";
  if (!alias) {
    return `Antes de empezar, elige tu nombre anónimo. ${porque} Descubre el tuyo aquí (tienes 3 intentos y después queda fijo): ${linkNombre}`;
  }
  if (capped) return `En MysterFoodie te llamamos ${alias}. ${porque} Tu nombre ya quedó fijo para mantener protegida tu identidad.`;
  return `En MysterFoodie te llamamos ${alias}. ${porque} Si prefieres otro nombre, cámbialo aquí (te lleva a tu Perfil): ${linkNombre}`;
}

export function perfilInviteCallout(): EmailCallout {
  return {
    title: "💰 Lo que puedes ganar por cada perfil vendido",
    lines: [
      `🪪 Nivel ID: hasta ${formatMxn(MAX_EARNINGS_ID)}.`,
      `👑 Nivel Passport: hasta ${formatMxn(MAX_EARNINGS_PER_SALE - MAX_EARNINGS_ID)} más (${formatMxn(MAX_EARNINGS_PER_SALE)} con los dos niveles).`,
      `Te llevas el ${MYSTERFOODIE_SHARE_PCT}% del precio que paga el negocio; el cargo por uso de la plataforma lo paga el negocio aparte.`,
    ],
  };
}

export async function sendDuePerfilInvites(db: Db, baseUrl: string): Promise<{ sent: number; skipped: number; failed: number; note?: string }> {
  if (!inNotificationWindow()) return { sent: 0, skipped: 0, failed: 0, note: "fuera de horario hábil" };
  const now = Date.now();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .in("role", TEAM_ROLES)
    .is("anon_invite_email_sent_at", null)
    .lte("created_at", new Date(now - INVITE_AFTER_DAYS * DAY_MS).toISOString())
    .gte("created_at", new Date(now - INVITE_MAX_AGE_DAYS * DAY_MS).toISOString())
    .limit(50);
  if (error) throw new Error(`Falta correr supabase/perfil_tareas.sql (${error.message})`);

  const automation = await getAutomation("perfil_anonimo_invitacion").catch(() => null);
  const allKeys = BLOCKS.map((b) => b.key);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of data ?? []) {
    const email = (p.email as string | null) || "";
    const shared = ((p.share_blocks as unknown[]) ?? []).filter(isBlockKey);
    if (!email || allKeys.every((k) => shared.includes(k))) {
      skipped++; // sin correo, o ya comparte los dos niveles completos
      continue;
    }
    // Se reclama primero (así dos corridas no mandan el mismo correo) y se suelta si el envío falla.
    const { data: claimed } = await db
      .from("profiles")
      .update({ anon_invite_email_sent_at: new Date().toISOString() })
      .eq("id", p.id as string)
      .is("anon_invite_email_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const alias = ((p.alias as string | null) || "").trim() || null;
    const vars = {
      foodie: alias || ((p.full_name as string | null) || "").split(" ")[0],
      parrafo_nombre: nombreAnonimoParrafo(alias, p.alias_capped === true, `${baseUrl}/perfil/alias`),
      link_perfil: `${baseUrl}/perfil/anonimo`,
    };
    const custom = automation?.enabled;
    const outcome = await sendTemplatedEmail({
      to: email,
      subject: renderTemplate(custom && automation.subjectTemplate ? automation.subjectTemplate : PERFIL_INVITE_SUBJECT, vars),
      bodyText: renderTemplate(custom && automation.bodyTemplate ? automation.bodyTemplate : PERFIL_INVITE_BODY, vars).replace(/^Hola ,/, "Hola,"),
      ctaLabel: "Llenar mi perfil anónimo",
      callout: perfilInviteCallout(),
      saberMas: [SABER_MAS.privacidad],
    });
    if (outcome.status === "sent") sent++;
    else {
      failed++;
      await db.from("profiles").update({ anon_invite_email_sent_at: null }).eq("id", p.id as string);
    }
  }
  return { sent, skipped, failed };
}
