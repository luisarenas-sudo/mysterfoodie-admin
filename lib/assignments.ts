import { getSupabaseServiceClient } from "./supabase";
import { businessTypePhrase } from "./categories";
import { sendTemplatedEmail, type SendEmailOutcome } from "./email";
import { getAutomation, renderTemplate } from "./automations";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Avisa por correo a un Foodie que se le asignó una visita (usa la
 * automatización editable "asignacion_visita") y marca notified_at. Lo usan
 * la asignación manual (/api/asignaciones) y las visitas de los planes
 * mensuales (cuando hay Foodie por default o se asigna después).
 */
export async function sendAssignmentEmail(
  db: Db,
  params: {
    assignmentId: string;
    client: { name: string; type: string | null; city: string | null };
    foodie: { email: string | null; full_name: string | null };
    note: string | null;
    baseUrl: string;
    /** Enlace del botón del correo; por defecto la lista /nueva-visita (una solicitud lleva directo a su visita). */
    linkVisitas?: string;
  }
): Promise<SendEmailOutcome> {
  const { assignmentId, client, foodie, note, baseUrl, linkVisitas: linkOverride } = params;
  if (!foodie.email) return { status: "failed", error: "El Foodie no tiene correo" };

  const linkVisitas = linkOverride || `${baseUrl}/nueva-visita`;
  const ubicacion = [businessTypePhrase(client.type), client.city].filter(Boolean).join(" · ");
  const templateVars = {
    foodie: foodie.full_name || "",
    negocio: client.name,
    ubicacion,
    nota: note || "",
    link_visitas: linkVisitas,
  };

  const automation = await getAutomation("asignacion_visita");
  const defaultSubject = `Nueva visita asignada: ${client.name}`;
  const defaultBody =
    `Hola${foodie.full_name ? ` ${foodie.full_name}` : ""},

` +
    `Se te asignó una nueva visita Mystery Shopper:

` +
    `Negocio: ${client.name}
` +
    `Ubicación: ${ubicacion}
` +
    (note ? `Nota: ${note}

` : `
`) +
    `Ve tus visitas asignadas aquí:
${linkVisitas}

Saludos,
MysterFoodie`;
  const subject =
    automation?.enabled && automation.subjectTemplate
      ? renderTemplate(automation.subjectTemplate, templateVars)
      : defaultSubject;
  const bodyText =
    automation?.enabled && automation.bodyTemplate
      ? renderTemplate(automation.bodyTemplate, templateVars)
      : defaultBody;

  const outcome = await sendTemplatedEmail({
    to: foodie.email,
    subject,
    bodyText,
    ctaLabel: "Ver mis visitas asignadas",
  });

  if (outcome.status === "sent") {
    await db.from("visit_assignments").update({ notified_at: new Date().toISOString() }).eq("id", assignmentId);
  }
  return outcome;
}
