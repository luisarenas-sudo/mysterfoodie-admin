import { INVOICE_LABEL, OCCUPANCY_LABEL, SERVICE_STAMPS } from "./categories";

/**
 * Contexto de la visita para el reporte (PDF y reporte en línea completo):
 * cuándo fue, cuánto tardó cada momento del servicio, qué tan lleno estaba el lugar,
 * si facturan y si el MysterFoodie volvería. Todo sale de columnas de `forms`
 * (supabase/indicadores_lideres.sql); las visitas anteriores no las tienen y simplemente no muestran nada.
 */
export const VISIT_CONTEXT_COLUMNS = "visit_started_at, visit_ended_at, service_stamps, occupancy, would_return, invoice_offered";

export type VisitContext = {
  startedAt: string | null;
  endedAt: string | null;
  occupancy: string | null;
  stamps: Partial<Record<string, string>>;
  wouldReturn: number | null;
  invoiceOffered: string | null;
};

export type ContextRow = { label: string; value: string };

type Raw = Record<string, unknown> | null | undefined;

export function buildVisitContext(row: Raw): VisitContext | null {
  if (!row) return null;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const stamps: Partial<Record<string, string>> = {};
  const rawStamps = row.service_stamps;
  if (rawStamps && typeof rawStamps === "object") {
    for (const s of SERVICE_STAMPS) {
      const v = (rawStamps as Record<string, unknown>)[s.key];
      if (typeof v === "string" && !Number.isNaN(Date.parse(v))) stamps[s.key] = v;
    }
  }
  const ctx: VisitContext = {
    startedAt: str(row.visit_started_at),
    endedAt: str(row.visit_ended_at),
    occupancy: str(row.occupancy),
    stamps,
    wouldReturn: typeof row.would_return === "number" ? row.would_return : null,
    invoiceOffered: str(row.invoice_offered),
  };
  const hasAny =
    ctx.startedAt || ctx.endedAt || ctx.occupancy || ctx.wouldReturn !== null || ctx.invoiceOffered || Object.keys(stamps).length > 0;
  return hasAny ? ctx : null;
}

const TZ = "America/Mexico_City";

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
}

function longDate(iso: string): string {
  const s = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
  return s.charAt(0).toLocaleUpperCase("es-MX") + s.slice(1);
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
}

const STAMP_ROW_LABEL: Record<string, string> = {
  atendido: "Primera atención del personal",
  bebida: "Llegó la bebida",
  platillo: "Llegó el platillo",
  cuenta: "Llegó la cuenta",
};

/** Filas legibles y listas para pintar en PDF o pantalla. */
export function contextRows(ctx: VisitContext): ContextRow[] {
  const rows: ContextRow[] = [];
  if (ctx.startedAt) rows.push({ label: "Día y hora de llegada", value: `${longDate(ctx.startedAt)}, ${hhmm(ctx.startedAt)} h` });
  if (ctx.endedAt && ctx.startedAt) rows.push({ label: "Duración de la visita", value: `${minutesBetween(ctx.startedAt, ctx.endedAt)} min (hasta ${hhmm(ctx.endedAt)} h)` });
  if (ctx.occupancy && OCCUPANCY_LABEL[ctx.occupancy]) rows.push({ label: "Ocupación del lugar al llegar", value: OCCUPANCY_LABEL[ctx.occupancy] });
  for (const s of SERVICE_STAMPS) {
    const at = ctx.stamps[s.key];
    if (!at) continue;
    const mins = ctx.startedAt ? minutesBetween(ctx.startedAt, at) : null;
    rows.push({ label: STAMP_ROW_LABEL[s.key] ?? s.label, value: mins !== null ? `${hhmm(at)} h · a los ${mins} min de llegar` : `${hhmm(at)} h` });
  }
  if (ctx.invoiceOffered && INVOICE_LABEL[ctx.invoiceOffered]) rows.push({ label: "Facturación", value: INVOICE_LABEL[ctx.invoiceOffered] });
  if (ctx.wouldReturn !== null) rows.push({ label: "¿El MysterFoodie volvería?", value: `${ctx.wouldReturn} de 10` });
  return rows;
}

/** Aclaración obligada: lo de Higiene es una observación como cliente, no una auditoría ni el distintivo. */
export const HIGIENE_NOTE =
  "Higiene recoge solo lo que un cliente puede observar y se inspira en los criterios del Distintivo H (Sectur). Es una observación de nuestro MysterFoodie: no es una auditoría sanitaria, no sustituye ni otorga el Distintivo H.";
