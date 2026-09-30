import { getSupabaseServiceClient } from "./supabase";

/**
 * Automatizaciones con plantilla editable (ver /automatizaciones).
 * Por ahora solo existe "asesoria_gratuita": el correo que se manda al
 * día siguiente de una visita ofreciendo 20 min gratis, disparado por
 * /api/cron/followup-emails.
 */
export type Automation = {
  key: string;
  enabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
  updatedAt: string;
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
