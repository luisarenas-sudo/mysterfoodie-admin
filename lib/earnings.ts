import { getSupabaseServiceClient } from "./supabase";
import { PRICE_MXN, scenarioByKey, type ScenarioKey } from "./earningsMatrix";

/**
 * Cálculo REAL de ganancias por periodo (mes, hora CDMX).
 *
 * Una venta = un reporte completo entregado (el pago se aprobó y se
 * mandó el PDF): forms.report_unlocked_at marca ese momento y define el
 * mes. La acción del reparto (1-5) se deduce de los datos:
 *  - Visitó: quien guardó la visita (forms.created_by).
 *  - Vendió: quien dio de alta el negocio (clients.created_by); sin dato
 *    se asume Master Chef (negocios históricos).
 *  - Gestionó: quien asignó la visita a un Foodie (visit_assignments).
 * Lo que no encaja en ninguna de las 6 acciones queda "sin clasificar".
 */

export type PaidVisit = {
  formId: string;
  negocio: string;
  soldAt: string;
  scenario: ScenarioKey | null;
  admin: number;
  sibarita: number;
  foodie: number;
  sibaritaId: string | null;
  foodieId: string | null;
};

export type ProfileLite = { id: string; name: string; role: string };

// Mexico no tiene horario de verano desde 2022: CDMX es UTC-6 todo el año.
const CDMX_OFFSET = "-06:00";

export function currentMonthCdmx(): string {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date());
  return s.slice(0, 7);
}

export function isValidMonth(m: string | undefined): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthBounds(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00${CDMX_OFFSET}`),
    end: new Date(`${shiftMonth(month, 1)}-01T00:00:00${CDMX_OFFSET}`),
  };
}

export async function getMonthEarnings(month: string): Promise<{ visits: PaidVisit[]; profiles: Map<string, ProfileLite> }> {
  const db = getSupabaseServiceClient();
  const { start, end } = monthBounds(month);

  const { data: forms } = await db
    .from("forms")
    .select("id, client_id, created_by, report_unlocked_at")
    .not("report_unlocked_at", "is", null)
    .gte("report_unlocked_at", start.toISOString())
    .lt("report_unlocked_at", end.toISOString())
    .order("report_unlocked_at", { ascending: false });

  const formRows = forms || [];
  if (formRows.length === 0) return { visits: [], profiles: new Map() };

  const clientIds = [...new Set(formRows.map((f) => f.client_id as string))];
  const formIds = formRows.map((f) => f.id as string);

  const [{ data: clients }, { data: assignments }] = await Promise.all([
    db.from("clients").select("id, name, created_by").in("id", clientIds),
    db.from("visit_assignments").select("completed_form_id, assigned_by").in("completed_form_id", formIds),
  ]);

  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  const assignerByForm = new Map((assignments || []).map((a) => [a.completed_form_id as string, a.assigned_by as string | null]));

  const profileIds = new Set<string>();
  formRows.forEach((f) => f.created_by && profileIds.add(f.created_by as string));
  (clients || []).forEach((c) => c.created_by && profileIds.add(c.created_by as string));
  (assignments || []).forEach((a) => a.assigned_by && profileIds.add(a.assigned_by as string));

  const { data: profileRows } = profileIds.size
    ? await db.from("profiles").select("id, full_name, email, role").in("id", [...profileIds])
    : { data: [] as { id: string; full_name: string | null; email: string | null; role: string }[] };
  const profiles = new Map<string, ProfileLite>(
    (profileRows || []).map((p) => [p.id, { id: p.id, name: p.full_name || p.email || "Sin nombre", role: p.role }])
  );
  const roleOf = (id: string | null | undefined) => (id ? profiles.get(id)?.role ?? null : null);

  const visits: PaidVisit[] = formRows.map((f) => {
    const client = clientById.get(f.client_id as string);
    const visitorId = (f.created_by as string | null) ?? null;
    const visitorRole = roleOf(visitorId);
    const sellerId = (client?.created_by as string | null) ?? null;
    const sellerRole = roleOf(sellerId) ?? "admin"; // sin dato: negocio histórico del Master Chef
    const assignerId = assignerByForm.get(f.id as string) ?? null;
    const assignerRole = roleOf(assignerId);

    let scenario: ScenarioKey | null = null;
    let sibaritaId: string | null = null;
    let foodieId: string | null = null;

    if (visitorRole === "admin" && sellerRole === "admin") {
      scenario = "1";
    } else if (visitorRole === "agente") {
      foodieId = visitorId;
      if (sellerRole === "sibarita") {
        scenario = "5";
        sibaritaId = sellerId;
      } else if (sellerRole === "admin") {
        if (assignerRole === "sibarita") {
          scenario = "3a";
          sibaritaId = assignerId;
        } else {
          scenario = "2";
        }
      }
    } else if (visitorRole === "sibarita") {
      if (sellerRole === "admin") {
        scenario = "3b";
        sibaritaId = visitorId;
      } else if (sellerRole === "sibarita" && sellerId === visitorId) {
        scenario = "4";
        sibaritaId = visitorId;
      }
    }

    const split = scenario ? scenarioByKey(scenario) : null;
    return {
      formId: f.id as string,
      negocio: client?.name || "Negocio",
      soldAt: f.report_unlocked_at as string,
      scenario,
      admin: split?.admin ?? 0,
      sibarita: split?.sibarita ?? 0,
      foodie: split?.foodie ?? 0,
      sibaritaId,
      foodieId: split ? foodieId : null,
    };
  });

  return { visits, profiles };
}

export { PRICE_MXN };
