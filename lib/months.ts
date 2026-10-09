/**
 * Fechas por mes (hora CDMX) y ventanas de las visitas de un plan. Módulo SIN
 * dependencias de servidor: lo usan pantallas (cliente), cálculos de
 * ganancias y el panel de Pendientes. Antes cada archivo tenía su propia copia
 * de estos helpers.
 */

// Mexico no tiene horario de verano desde 2022: CDMX es UTC-6 todo el año.
export const CDMX_OFFSET = "-06:00";

export function currentMonthCdmx(): string {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date());
  return s.slice(0, 7);
}

/** Mes y día de hoy en CDMX. */
export function todayCdmx(): { month: string; day: number } {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { month: s.slice(0, 7), day: Number(s.slice(8, 10)) };
}

export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Octubre 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "octubre" */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Ventana de una visita del plan: el mes se reparte en partes iguales según
 * las visitas contratadas (4 visitas = una por semana; 3 = una cada ~10
 * días). Es informativa: no bloquea hacer la visita antes o después.
 */
export function visitWindow(month: string, seq: number, quota: number): { startDay: number; endDay: number } {
  const days = daysInMonth(month);
  const q = Math.max(1, quota);
  const k = Math.min(Math.max(seq, 1), q);
  return { startDay: Math.floor(((k - 1) * days) / q) + 1, endDay: Math.floor((k * days) / q) };
}

/** "del 8 al 15 de octubre" */
export function visitWindowLabel(month: string, seq: number, quota: number): string {
  const { startDay, endDay } = visitWindow(month, seq, quota);
  return `del ${startDay} al ${endDay} de ${monthName(month)}`;
}

/** ¿Ya pasó la ventana de esta visita? (solo tiene sentido si sigue pendiente) */
export function isVisitOverdue(month: string, seq: number, quota: number): boolean {
  const today = todayCdmx();
  if (month < today.month) return true;
  if (month > today.month) return false;
  return today.day > visitWindow(month, seq, quota).endDay;
}
