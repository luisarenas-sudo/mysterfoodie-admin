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
