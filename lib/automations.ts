import { getSupabaseServiceClient } from "./supabase";

/**
 * Automatizaciones con plantilla editable (ver /automatizaciones).
 * Cada fila en la tabla `automations` es un mensaje que el sistema manda
 * solo, con texto editable por el admin (Master Chef): el correo de
 * seguimiento post-visita, el párrafo de intro del correo de resultado,
 * el correo de asignación a un Foodie, las confirmaciones de asesoría
 * agendada, y el mensaje de Instagram DM.
 */
export type Automation = {
  key: string;
  enabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
  updatedAt: string;
};

export type AutomationTag = { tag: string; desc: string };

export type AutomationCatalogEntry = {
  title: string;
  desc: string;
  tags: AutomationTag[];
  /** false = esta automatización no manda correo con asunto propio (ej. el DM de Instagram); oculta el campo "Asunto" en el panel. */
  hasSubject?: boolean;
  /** Copy del botón de encendido/apagado cuando no aplica "Activa/Desactivada" tal cual (ej. correos transaccionales que siempre se mandan, donde el toggle solo decide si se usa el texto personalizado o el de MysterFoodie por default). */
  enabledLabel?: { on: string; off: string };
};

/** Catálogo central: qué automatizaciones existen, cómo se llaman en el panel y qué tags ({{...}}) acepta cada una. Única fuente de verdad para el UI de Automatizaciones. */
export const AUTOMATION_CATALOG: Record<string, AutomationCatalogEntry> = {
  asesoria_gratuita: {
    title: "Asesoría gratuita (correo de seguimiento)",
    desc: "Se manda a las 8am (CDMX) del día después de la visita, ofreciendo 20 min gratis para hablar del negocio. Si la desactivas, ese correo deja de mandarse.",
    tags: [
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "link_agenda", desc: "Enlace para agendar la asesoría" },
    ],
  },
  resultado_visita: {
    title: "Resultado de la visita (al negocio)",
    desc: "Correo que recibe el negocio justo después de guardar una visita. Solo el párrafo de introducción es editable; las estrellas, el veredicto, las categorías y el botón se arman solos.",
    tags: [
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "tipo_negocio", desc: "Tipo de negocio, ej. \"cafetería\" (puede venir vacío)" },
      { tag: "mesero", desc: "Nombre del mesero que atendió, si se capturó (puede venir vacío)" },
      { tag: "promedio", desc: "Promedio general obtenido (solo útil en el asunto)" },
    ],
    enabledLabel: { on: "Personalizado", off: "Texto original" },
  },
  asignacion_visita: {
    title: "Visita asignada (a un Foodie)",
    desc: "Correo que recibe un Foodie cuando el admin le asigna una visita a un negocio.",
    tags: [
      { tag: "foodie", desc: "Nombre del Foodie" },
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "ubicacion", desc: "Tipo de negocio y ciudad (puede venir vacío)" },
      { tag: "nota", desc: "Nota que dejó el admin al asignar (puede venir vacío)" },
      { tag: "link_visitas", desc: "Enlace a sus visitas asignadas" },
    ],
    enabledLabel: { on: "Personalizado", off: "Texto original" },
  },
  confirmacion_cita_negocio: {
    title: "Asesoría confirmada (al negocio)",
    desc: "Correo que recibe el negocio al agendar su asesoría gratuita desde el reporte.",
    tags: [
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "fecha_hora", desc: "Fecha y hora de la cita" },
    ],
    enabledLabel: { on: "Personalizado", off: "Texto original" },
  },
  confirmacion_cita_admin: {
    title: "Asesoría confirmada (a ti)",
    desc: "Correo que te llega a ti (admin) cuando un negocio agenda su asesoría.",
    tags: [
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "fecha_hora", desc: "Fecha y hora de la cita" },
    ],
    enabledLabel: { on: "Personalizado", off: "Texto original" },
  },
  instagram_dm: {
    title: "Mensaje de Instagram (DM, primer contacto)",
    desc: "Texto para copiar y pegar como DM de Instagram al negocio -- el primer contacto con el cliente, generado al terminar de registrar una visita. No es un correo, por eso no tiene asunto.",
    tags: [
      { tag: "negocio", desc: "Nombre del negocio" },
      { tag: "mesero", desc: "Solo el nombre del mesero que atendió, sin texto alrededor (puede venir vacío)" },
      { tag: "mesero_linea", desc: "Frase lista (\" Nos atendió Juan.\"); vacía si la visita no tiene mesero capturado -- úsala en vez de {{mesero}} para que no quede un hueco si falta el dato" },
      { tag: "promedio", desc: "Promedio general obtenido" },
      { tag: "link_reporte", desc: "Enlace al reporte" },
    ],
    hasSubject: false,
    enabledLabel: { on: "Personalizado", off: "Texto original" },
  },
};

export async function listAutomations(): Promise<Automation[]> {
  const db = getSupabaseServiceClient();
  const { data } = await db.from("automations").select("*").order("key");
  return (data || []).map((row) => ({
    key: row.key,
    enabled: row.enabled,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    updatedAt: row.updated_at,
  }));
}

export async function getAutomation(key: string): Promise<Automation | null> {
  const db = getSupabaseServiceClient();
  const { data } = await db.from("automations").select("*").eq("key", key).maybeSingle();
  if (!data) return null;
  return {
    key: data.key,
    enabled: data.enabled,
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
    updatedAt: data.updated_at,
  };
}

export async function updateAutomation(
  key: string,
  patch: { enabled?: boolean; subjectTemplate?: string; bodyTemplate?: string }
): Promise<void> {
  const db = getSupabaseServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.subjectTemplate !== undefined) update.subject_template = patch.subjectTemplate;
  if (patch.bodyTemplate !== undefined) update.body_template = patch.bodyTemplate;

  const { error } = await db.from("automations").update(update).eq("key", key);
  if (error) throw new Error(error.message);
}

/** Reemplaza {{variable}} en una plantilla; una variable sin valor se deja en blanco. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}
