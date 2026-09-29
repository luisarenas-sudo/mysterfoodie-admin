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
