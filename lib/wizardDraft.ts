/**
 * Autoguardado del wizard de evaluación (DesktopWizard / MobileWizard):
 * todo el progreso de los ~52 indicadores vivía solo en memoria del
 * navegador -- si se cerraba la pestaña, se acababa la batería a medio
 * levantar una visita, o el navegador recargaba la página, se perdía
 * toda la evaluación sin ningún aviso. Esto guarda un borrador en
 * localStorage en cada cambio y permite recuperarlo al volver a entrar.
 *
 * `id` identifica de qué visita es el borrador (el assignmentId de la
 * asignación, o el id del negocio si se visita directo, o "new" para el
 * wizard en blanco) -- así no se mezclan borradores de distintas visitas.
 */
const PREFIX = "mf-wizard-draft:";

function draftKey(id: string): string {
  return `${PREFIX}${id}`;
}

export function loadWizardDraft<T>(id: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveWizardDraft<T>(id: string, draft: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena, etc.) -- no es
    // crítico, simplemente no habrá autoguardado para esta visita.
  }
}

export function clearWizardDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(id));
  } catch {
    // ignorar
  }
}

export type DraftSummary = {
  id: string;
  /** Ruta donde se retoma la visita. */
  href: string;
  /** Nombre del negocio (si ya lo capturó). */
  name: string;
  /** Paso actual (1 = primero) y total de pasos. */
  step: number;
  totalSteps: number;
  savedAt: number;
};

/**
 * Borradores sin terminar de este navegador (para avisar en Pendientes del Inicio). Los guardados antes de que el
 * borrador registrara su ruta se ignoran: no se sabe a dónde llevarlos.
 */
export function listWizardDrafts(): DraftSummary[] {
  if (typeof window === "undefined") return [];
  const out: DraftSummary[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const d = JSON.parse(window.localStorage.getItem(key) || "null") as
        | { business?: { name?: string }; step?: number; savedAt?: number; href?: string; totalSteps?: number }
        | null;
      if (!d || typeof d.href !== "string" || !d.href.startsWith("/")) continue;
      out.push({
        id: key.slice(PREFIX.length),
        href: d.href,
        name: d.business?.name?.trim() || "",
        step: (d.step ?? 0) + 1,
        totalSteps: d.totalSteps ?? 0,
        savedAt: d.savedAt ?? 0,
      });
    }
  } catch {
    // ignorar
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}
