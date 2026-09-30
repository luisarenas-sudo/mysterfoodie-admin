import { getSupabaseServiceClient } from "./supabase";
import { categoryScores, type Ratings } from "./scoring";

export type ClientSummary = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  lastScore: number | null;
};

export async function getClientsSummary(): Promise<ClientSummary[]> {
  const db = getSupabaseServiceClient();

  const { data: clients, error: clientsError } = await db
    .from("clients")
    .select("id, name, type, city");
  if (clientsError || !clients) return [];

  const { data: forms } = await db
    .from("forms")
    .select("client_id, overall_score, created_at")
    .order("created_at", { ascending: false });

  return clients
    .map((client) => {
      const clientForms = (forms || []).filter((f) => f.client_id === client.id);
      const last = clientForms[0];
      return {
        id: client.id,
        name: client.name,
        type: client.type,
        city: client.city,
        visitCount: clientForms.length,
        lastVisitAt: last?.created_at ?? null,
        lastScore: last?.overall_score ?? null,
      };
    })
    .sort((a, b) => {
      if (!a.lastVisitAt) return 1;
      if (!b.lastVisitAt) return -1;
      return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime();
    });
}

export type VisitDetail = {
  id: string;
  shortCode: string;
  shopperName: string | null;
  overallScore: number;
  createdAt: string;
  ratings: { key: string; label: string; score: number }[];
};

export type ClientDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  instagramHandle: string | null;
  visits: VisitDetail[];
};

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const db = getSupabaseServiceClient();

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, city, instagram_handle")
    .eq("id", id)
    .maybeSingle();
  if (!client) return null;

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, shopper_name, overall_score, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: true });

  const { data: allRatings } = await db
    .from("form_ratings")
    .select("form_id, category_key, score")
    .in("form_id", (forms || []).map((f) => f.id));

  // Los indicadores individuales son ~50 por visita; para que el
  // comparativo entre visitas sea legible se agregan por categoria
  // (Fachada, Ambiente, Atencion, Alimentos, Accesibilidad) en vez de
  // mostrar cada indicador crudo.
  const visits: VisitDetail[] = (forms || []).map((f) => {
    const raw: Ratings = {};
    (allRatings || [])
      .filter((r) => r.form_id === f.id)
      .forEach((r) => {
        raw[r.category_key] = r.score;
      });
    const scores = categoryScores(raw).filter((c) => c.count > 0);
    return {
      id: f.id,
      shortCode: f.short_code,
      shopperName: f.shopper_name,
      overallScore: f.overall_score,
      createdAt: f.created_at,
      ratings: scores.map((c) => ({ key: c.key, label: c.label, score: c.average })),
    };
  });

  return {
    id: client.id,
    name: client.name,
    type: client.type,
    city: client.city,
    instagramHandle: client.instagram_handle,
    visits,
  };
}

export type EmailConfirmationInfo = {
  status: string;
  error: string | null;
  recipientEmail: string;
  sentAt: string;
};

export type VisitFullDetail = {
  id: string;
  shortCode: string;
  reportUrl: string;
  overallScore: number;
  createdAt: string;
  shopperName: string | null;
  waiterName: string | null;
  clientId: string;
  clientName: string;
  clientType: string;
  categoryScores: { key: string; label: string; average: number; count: number }[];
  lastEmail: EmailConfirmationInfo | null;
};

/**
 * Detalle completo de una evaluación puntual (no del historial de un
 * negocio): usado por /visitas/[formId] para mostrar el desglose de
 * indicadores y, sobre el mismo endpoint genérico de
 * /api/forms/[formId]/email, el estado del correo automático con sus
 * controles de reenvío - tanto para una visita recién guardada como
 * para cualquier evaluación anterior.
 */
export async function getVisitDetail(formId: string): Promise<VisitFullDetail | null> {
  const db = getSupabaseServiceClient();

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, short_code, report_url, overall_score, created_at, shopper_name, waiter_name")
    .eq("id", formId)
    .maybeSingle();
  if (!form) return null;

  const { data: client } = await db
    .from("clients")
    .select("id, name, type")
    .eq("id", form.client_id)
    .maybeSingle();
  if (!client) return null;

  const { data: ratingRows } = await db
    .from("form_ratings")
    .select("category_key, score")
    .eq("form_id", form.id);

  const raw: Ratings = {};
  (ratingRows || []).forEach((r) => {
    raw[r.category_key] = r.score;
  });
  const catScores = categoryScores(raw).filter((c) => c.count > 0);

  const { data: emailRows } = await db
    .from("email_confirmations")
    .select("status, error, recipient_email, sent_at")
    .eq("form_id", form.id)
    .order("sent_at", { ascending: false })
    .limit(1);

  const lastEmailRow = (emailRows || [])[0];

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = form.report_url || (baseUrl ? `${baseUrl}/r/${form.short_code}` : `/r/${form.short_code}`);

  return {
    id: form.id,
    shortCode: form.short_code,
    reportUrl,
    overallScore: form.overall_score,
    createdAt: form.created_at,
    shopperName: form.shopper_name,
    waiterName: form.waiter_name,
    clientId: client.id,
    clientName: client.name,
    clientType: client.type,
    categoryScores: catScores,
    lastEmail: lastEmailRow
      ? {
          status: lastEmailRow.status,
          error: lastEmailRow.error,
          recipientEmail: lastEmailRow.recipient_email,
          sentAt: lastEmailRow.sent_at,
        }
      : null,
  };
}

export type AgentVisit = {
  id: string;
  shortCode: string;
  overallScore: number;
  createdAt: string;
  clientId: string;
  clientName: string;
};

/** Visitas registradas por un agente/mystery shopper específico, para "Mis visitas". */
export async function getVisitsByAgent(agentId: string): Promise<AgentVisit[]> {
  const db = getSupabaseServiceClient();

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, overall_score, created_at, client_id")
    .eq("created_by", agentId)
    .order("created_at", { ascending: false });

  if (!forms || forms.length === 0) return [];

  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .in("id", forms.map((f) => f.client_id));

  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  return forms.map((f) => ({
    id: f.id,
    shortCode: f.short_code,
    overallScore: f.overall_score,
    createdAt: f.created_at,
    clientId: f.client_id,
    clientName: nameById.get(f.client_id) ?? "Negocio",
  }));
}

export type AdminStats = {
  totalNegocios: number;
  negociosUltimoMes: number;
  totalUsuarios: number;
  usuariosPorRol: { admin: number; agente: number; cliente: number };
  totalVisitas: number;
  visitasUltimoMes: number;
};

/** Estadísticas generales para el panel de administración de usuarios. */
export async function getAdminStats(): Promise<AdminStats> {
  const db = getSupabaseServiceClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    { count: totalNegocios },
    { count: negociosUltimoMes },
    { data: profiles },
    { count: totalVisitas },
    { count: visitasUltimoMes },
  ] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }),
    db.from("clients").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    db.from("profiles").select("role"),
    db.from("forms").select("id", { count: "exact", head: true }),
    db.from("forms").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
  ]);

  const usuariosPorRol = { admin: 0, agente: 0, cliente: 0 };
  (profiles || []).forEach((p) => {
    const role = p.role as keyof typeof usuariosPorRol;
    if (role in usuariosPorRol) usuariosPorRol[role] += 1;
  });

  return {
    totalNegocios: totalNegocios ?? 0,
    negociosUltimoMes: negociosUltimoMes ?? 0,
    totalUsuarios: (profiles || []).length,
    usuariosPorRol,
    totalVisitas: totalVisitas ?? 0,
    visitasUltimoMes: visitasUltimoMes ?? 0,
  };
}

// ============================================================
// Helpers para las pantallas móviles (Inicio, Reportes, tendencia
// mensual de un negocio) añadidos al aplicar el rediseño mobile.
// ============================================================

import { getVerdict } from "./verdict";
import { avatarColorFor, initialsFor } from "./ring";

export type HomeActivityItem = {
  id: string;
  negocioId: string;
  negocioNombre: string;
  fecha: string;
  score: number;
  verdictLabel: string;
  verdictColor: string;
  initial: string;
  avatarColor: string;
};

export type HomeSummary = {
  visitasMes: number;
  promedioGeneral: number | null;
  actividadReciente: HomeActivityItem[];
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

/** Estadísticas + actividad reciente para "Inicio" (móvil). Sin agentId = alcance global (admin). */
export async function getHomeSummary(scope: { agentId?: string } = {}): Promise<HomeSummary> {
  const db = getSupabaseServiceClient();

  let query = db
    .from("forms")
    .select("id, client_id, overall_score, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (scope.agentId) query = query.eq("created_by", scope.agentId);

  const { data: forms } = await query;
  const allForms = forms || [];

  if (allForms.length === 0) {
    return { visitasMes: 0, promedioGeneral: null, actividadReciente: [] };
  }

  const clientIds = Array.from(new Set(allForms.map((f) => f.client_id)));
  const { data: clients } = await db.from("clients").select("id, name").in("id", clientIds);
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  const now = new Date();
  const visitasMes = allForms.filter((f) => {
    const d = new Date(f.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const promedioGeneral =
    allForms.length > 0
      ? Math.round((allForms.reduce((sum, f) => sum + (f.overall_score || 0), 0) / allForms.length) * 10) / 10
      : null;

  const actividadReciente = allForms.slice(0, 8).map((f) => {
    const nombre = nameById.get(f.client_id) ?? "Negocio";
    const verdict = getVerdict(f.overall_score);
    return {
      id: f.id,
      negocioId: f.client_id,
      negocioNombre: nombre,
      fecha: formatShortDate(f.created_at),
      score: f.overall_score,
      verdictLabel: verdict.label,
      verdictColor: verdict.color,
      initial: initialsFor(nombre),
      avatarColor: avatarColorFor(nombre),
    };
  });

  return { visitasMes, promedioGeneral, actividadReciente };
}

export type ReyNegocio = { id: string; nombre: string; scoreLabel: string } | null;

/** El negocio mejor evaluado (para el banner "El Rey" de Inicio). Solo se muestra si hay un destacado claro (>=4). */
export async function getReyNegocio(): Promise<ReyNegocio> {
  const clients = await getClientsSummary();
  const withScore = clients.filter((c) => c.lastScore !== null && c.visitCount > 0);
  if (withScore.length === 0) return null;
  const top = withScore.reduce((best, c) => ((c.lastScore ?? 0) > (best.lastScore ?? 0) ? c : best));
  if (!top.lastScore || top.lastScore < 4) return null;
  return { id: top.id, nombre: top.name, scoreLabel: String(top.lastScore) };
}

/** Todas las visitas registradas (cualquier agente), para el tab Reportes cuando lo ve un admin. */
export async function getAllVisits(): Promise<AgentVisit[]> {
  const db = getSupabaseServiceClient();

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, overall_score, created_at, client_id")
    .order("created_at", { ascending: false });

  if (!forms || forms.length === 0) return [];

  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .in("id", forms.map((f) => f.client_id));

  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  return forms.map((f) => ({
    id: f.id,
    shortCode: f.short_code,
    overallScore: f.overall_score,
    createdAt: f.created_at,
    clientId: f.client_id,
    clientName: nameById.get(f.client_id) ?? "Negocio",
  }));
}

export type MonthlyTrendPoint = {
  mesLabel: string;
  count: number;
  avgLabel: string;
  arrow: string;
  arrowColor: string;
};

/** Agrupa las visitas de un negocio por mes para "Tendencia mensual" en el detalle móvil. */
export function getMonthlyTrend(
  visits: { createdAt: string; overallScore: number }[]
): MonthlyTrendPoint[] {
  const byMonth = new Map<string, { label: string; scores: number[] }>();
  visits.forEach((v) => {
    const d = new Date(v.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    if (!byMonth.has(key)) byMonth.set(key, { label, scores: [] });
    byMonth.get(key)!.scores.push(v.overallScore);
  });

  const months = Array.from(byMonth.entries()).sort(([a], [b]) => (a > b ? 1 : -1));

  return months.map(([, m], idx) => {
    const avg = Math.round((m.scores.reduce((s, v) => s + v, 0) / m.scores.length) * 10) / 10;
    const prevScores = idx > 0 ? months[idx - 1][1].scores : null;
    const prevAvg =
      prevScores && prevScores.length > 0
        ? Math.round((prevScores.reduce((s, v) => s + v, 0) / prevScores.length) * 10) / 10
        : null;
    let arrow = "—";
    let arrowColor = "rgba(60,60,67,0.4)";
    if (prevAvg !== null) {
      if (avg > prevAvg) {
        arrow = "▲";
        arrowColor = "#34C759";
      } else if (avg < prevAvg) {
        arrow = "▼";
        arrowColor = "#FF3B30";
      }
    }
    return {
      mesLabel: m.label.charAt(0).toUpperCase() + m.label.slice(1),
      count: m.scores.length,
      avgLabel: String(avg),
      arrow,
      arrowColor,
    };
  });
}
