import { getSupabaseServiceClient } from "./supabase";
import { ROLE_LABELS } from "./brand";
import { categoryScores, type Ratings } from "./scoring";

export type ClientSummary = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  lastScore: number | null;
  /** "Rango Primer Nombre" de quién dio de alta el negocio (ver clients.created_by), o null si no se pudo resolver. */
  creatorLabel: string | null;
};

export async function getClientsSummary(): Promise<ClientSummary[]> {
  const db = getSupabaseServiceClient();

  const { data: clients, error: clientsError } = await db
    .from("clients")
    .select("id, name, type, city, created_by");
  if (clientsError || !clients) return [];

  const { data: forms } = await db
    .from("forms")
    .select("client_id, overall_score, created_at")
    .order("created_at", { ascending: false });

  const creatorLabelById = await creatorFirstNameLabelsByUserId(
    db,
    clients.map((c) => c.created_by).filter((id): id is string => Boolean(id))
  );

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
        creatorLabel: client.created_by ? creatorLabelById.get(client.created_by) ?? null : null,
      };
    })
    .sort((a, b) => {
      if (!a.lastVisitAt) return 1;
      if (!b.lastVisitAt) return -1;
      return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime();
    });
}

export type VisitPickerClient = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  createdAt: string;
  visitCount: number;
  lastVisitAt: string | null;
  lastScore: number | null;
};

/**
 * Negocios para el selector de "Nueva visita" (admin/sibarita): a
 * diferencia de getClientsSummary() (que ordena por última visita, y
 * manda los negocios sin visitas al final), aquí siempre va primero
 * el negocio más recién agregado -- así uno recién creado aparece de
 * inmediato hasta arriba, listo para su primera visita.
 */
export async function getClientsForVisitPicker(): Promise<VisitPickerClient[]> {
  const db = getSupabaseServiceClient();

  const { data: clients, error: clientsError } = await db
    .from("clients")
    .select("id, name, type, city, created_at")
    .order("created_at", { ascending: false });
  if (clientsError || !clients) return [];

  const { data: forms } = await db
    .from("forms")
    .select("client_id, overall_score, created_at")
    .order("created_at", { ascending: false });

  return clients.map((client) => {
    const clientForms = (forms || []).filter((f) => f.client_id === client.id);
    const last = clientForms[0];
    return {
      id: client.id,
      name: client.name,
      type: client.type,
      city: client.city,
      createdAt: client.created_at,
      visitCount: clientForms.length,
      lastVisitAt: last?.created_at ?? null,
      lastScore: last?.overall_score ?? null,
    };
  });
}

export type VisitDetail = {
  id: string;
  shortCode: string;
  shopperName: string | null;
  overallScore: number;
  createdAt: string;
  comments: string | null;
  ratings: { key: string; label: string; score: number }[];
};

/**
 * Palabra recurrente en los comentarios de las visitas de un negocio
 * (ej. "lento" x2): se usa para armar la nube de "Aspectos a mejorar"
 * en el detalle del negocio, a partir de comentarios reales del
 * mystery shopper -- nunca texto generado o inventado.
 */
export type ImprovementKeyword = { word: string; count: number };

export type ClientDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  instagramHandle: string | null;
  email: string | null;
  /** Datos de contacto capturados al dar de alta el negocio (se muestran al equipo en el detalle). */
  phone: string | null;
  contactName: string | null;
  /** Quién dio de alta el negocio (para decidir si un Sibarita puede editarlo). */
  createdBy: string | null;
  /** Banderas de oportunidad de venta, capturadas al dar de alta el negocio (ver "Nuevo negocio"). */
  hasWebsite: boolean;
  hasGoogleBusiness: boolean;
  hasProfessionalPhotos: boolean;
  hasReels: boolean;
  autoEmailEnabled: boolean;
  visits: VisitDetail[];
  improvementKeywords: ImprovementKeyword[];
};

const KEYWORD_STOPWORDS = new Set([
  "el","la","los","las","de","del","un","una","unos","unas","y","o","en","a","que","es","muy","poco","mas","con",
  "sin","no","si","fue","fueron","estaba","estuvo","pero","por","para","se","su","sus","lo","al","como","tambien",
  "este","esta","estos","estas","hay","habia","nos","les","le","hubo","era","eran","les","mas","todo","toda",
  "todos","todas","fue","ser","esta","estan","estuvieron","bien","mal","algo","cosas","cosa",
]);

function normalizeKeyword(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Extrae palabras que se repiten en los comentarios de varias visitas
 * (o varias veces en el mismo comentario) para armar "Aspectos a
 * mejorar". Solo palabras con >=2 menciones entre todos los
 * comentarios del negocio, para no mostrar ruido de una sola visita.
 */
export function extractImprovementKeywords(comments: (string | null)[], limit = 6): ImprovementKeyword[] {
  const counts = new Map<string, number>();
  for (const text of comments) {
    if (!text) continue;
    const words = text
      .split(/[^a-zA-Záéíóúñ]+/i)
      .map(normalizeKeyword)
      .filter((w) => w.length >= 4 && !KEYWORD_STOPWORDS.has(w));
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const db = getSupabaseServiceClient();

  const { data: client } = await db
    .from("clients")
    .select(
      "id, name, type, city, instagram_handle, email, phone, contact_name, created_by, has_website, has_google_business, has_professional_photos, has_reels, auto_email_enabled"
    )
    .eq("id", id)
    .maybeSingle();
  if (!client) return null;

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, shopper_name, overall_score, created_at, comments")
    .eq("client_id", id)
    .order("created_at", { ascending: true });

  const formIds = (forms || []).map((f) => f.id);
  const [{ data: allRatings }, { data: allFlags }] = await Promise.all([
    db.from("form_ratings").select("form_id, category_key, score").in("form_id", formIds),
    db.from("form_flags").select("form_id, flag_key, flag_value").in("form_id", formIds),
  ]);

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
    const flags: Record<string, boolean> = {};
    (allFlags || [])
      .filter((fl) => fl.form_id === f.id)
      .forEach((fl) => {
        flags[fl.flag_key] = fl.flag_value;
      });
    const scores = categoryScores(raw, flags).filter((c) => c.count > 0);
    return {
      id: f.id,
      shortCode: f.short_code,
      shopperName: f.shopper_name,
      overallScore: f.overall_score,
      createdAt: f.created_at,
      comments: f.comments ?? null,
      ratings: scores.map((c) => ({ key: c.key, label: c.label, score: c.average })),
    };
  });

  return {
    id: client.id,
    name: client.name,
    type: client.type,
    city: client.city,
    instagramHandle: client.instagram_handle,
    email: client.email,
    phone: client.phone ?? null,
    contactName: client.contact_name ?? null,
    createdBy: client.created_by ?? null,
    hasWebsite: Boolean(client.has_website),
    hasGoogleBusiness: Boolean(client.has_google_business),
    hasProfessionalPhotos: Boolean(client.has_professional_photos),
    hasReels: Boolean(client.has_reels),
    autoEmailEnabled: client.auto_email_enabled ?? true,
    visits,
    improvementKeywords: extractImprovementKeywords(visits.map((v) => v.comments)),
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
  comments: string | null;
  clientId: string;
  clientName: string;
  clientType: string;
  categoryScores: { key: string; label: string; average: number; count: number }[];
  lastEmail: EmailConfirmationInfo | null;
  /** Promedio y número de visitas del negocio (todas, no solo esta), para dar contexto en el detalle. */
  clientAverageScore: number | null;
  clientVisitCount: number;
};

/**
 * Detalle completo de una evaluación puntual (no del historial de un
 * negocio): usado por /visitas/[formId] para mostrar el desglose de
 * indicadores y, sobre el mismo endpoint genérico de
 * /api/forms/[formId]/email, el estado del correo automático con sus
 * controles de reenvío - tanto para una visita recién guardada como
 * para cualquier evaluación anterior.
 */
export async function getVisitDetail(
  formId: string,
  access?: { isAdmin: boolean; userId: string }
): Promise<VisitFullDetail | null> {
  const db = getSupabaseServiceClient();

  let query = db
    .from("forms")
    .select(
      "id, client_id, short_code, report_url, overall_score, created_at, shopper_name, waiter_name, comments, created_by"
    )
    .eq("id", formId);
  // Un agente/sibarita solo puede ver el detalle de visitas que él mismo
  // levantó (igual que en /mis-visitas); solo admin ve cualquiera. Sin
  // esto, cualquiera con el UUID de una visita ajena (aparece en URLs
  // compartidas, correos, etc.) podía ver comentarios y desglose de otra
  // evaluación con solo tener sesión de agente/sibarita.
  if (access && !access.isAdmin) {
    query = query.eq("created_by", access.userId);
  }
  const { data: form } = await query.maybeSingle();
  if (!form) return null;

  // Ninguna de estas 5 consultas depende del resultado de otra (todas
  // solo necesitan form.id/form.client_id, que ya tenemos) -- antes se
  // esperaban una por una en cadena; lanzarlas juntas corta la espera de
  // esta pantalla a la mitad o menos.
  const [
    { data: client },
    { data: ratingRows },
    { data: flagRows },
    { data: emailRows },
    { data: clientForms },
  ] = await Promise.all([
    db.from("clients").select("id, name, type").eq("id", form.client_id).maybeSingle(),
    db.from("form_ratings").select("category_key, score").eq("form_id", form.id),
    db.from("form_flags").select("flag_key, flag_value").eq("form_id", form.id),
    db
      .from("email_confirmations")
      .select("status, error, recipient_email, sent_at")
      .eq("form_id", form.id)
      .order("sent_at", { ascending: false })
      .limit(1),
    db.from("forms").select("overall_score").eq("client_id", form.client_id),
  ]);
  if (!client) return null;

  const raw: Ratings = {};
  (ratingRows || []).forEach((r) => {
    raw[r.category_key] = r.score;
  });

  const flags: Record<string, boolean> = {};
  (flagRows || []).forEach((fl) => {
    flags[fl.flag_key] = fl.flag_value;
  });

  const catScores = categoryScores(raw, flags).filter((c) => c.count > 0);

  const lastEmailRow = (emailRows || [])[0];

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = form.report_url || (baseUrl ? `${baseUrl}/r/${form.short_code}` : `/r/${form.short_code}`);

  const clientScores = (clientForms || []).map((f) => f.overall_score).filter((s): s is number => typeof s === "number");
  const clientAverageScore =
    clientScores.length > 0
      ? Math.round((clientScores.reduce((sum, s) => sum + s, 0) / clientScores.length) * 10) / 10
      : null;

  return {
    id: form.id,
    shortCode: form.short_code,
    reportUrl,
    overallScore: form.overall_score,
    createdAt: form.created_at,
    shopperName: form.shopper_name,
    waiterName: form.waiter_name,
    comments: form.comments ?? null,
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
    clientAverageScore,
    clientVisitCount: clientScores.length,
  };
}

export type AgentVisit = {
  id: string;
  shortCode: string;
  overallScore: number;
  createdAt: string;
  clientId: string;
  clientName: string;
  /** "Sibarita Davichin", "Foodie Ana", etc. -- quién levantó la visita
   * (rango + nombre, ver ROLE_LABELS), o null si no se pudo resolver. */
  creatorLabel: string | null;
};

const VISIT_CREATOR_ROLE_LABELS = ROLE_LABELS;

async function creatorLabelsByUserId(
  db: ReturnType<typeof getSupabaseServiceClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("id", uniqueIds);
  const map = new Map<string, string>();
  (profiles || []).forEach((p) => {
    const roleLabel = VISIT_CREATOR_ROLE_LABELS[p.role as string] ?? p.role;
    const name = p.full_name || "Sin nombre";
    map.set(p.id, `${roleLabel} ${name}`);
  });
  return map;
}

/** Igual que creatorLabelsByUserId, pero con solo el primer nombre (para
 * la tarjeta de Negocios, donde "Añadido por" va en una línea angosta). */
async function creatorFirstNameLabelsByUserId(
  db: ReturnType<typeof getSupabaseServiceClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("id", uniqueIds);
  const map = new Map<string, string>();
  (profiles || []).forEach((p) => {
    const roleLabel = VISIT_CREATOR_ROLE_LABELS[p.role as string] ?? p.role;
    const firstName = (p.full_name || "").trim().split(/\s+/)[0] || "Sin nombre";
    map.set(p.id, `${roleLabel} ${firstName}`);
  });
  return map;
}

/** Visitas registradas por un agente/mystery shopper específico, para "Mis visitas". */
export async function getVisitsByAgent(agentId: string): Promise<AgentVisit[]> {
  const db = getSupabaseServiceClient();

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, overall_score, created_at, client_id, created_by")
    .eq("created_by", agentId)
    .order("created_at", { ascending: false });

  if (!forms || forms.length === 0) return [];

  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .in("id", forms.map((f) => f.client_id));

  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  const creatorLabelById = await creatorLabelsByUserId(
    db,
    forms.map((f) => f.created_by).filter((id): id is string => Boolean(id))
  );

  return forms.map((f) => ({
    id: f.id,
    shortCode: f.short_code,
    overallScore: f.overall_score,
    createdAt: f.created_at,
    clientId: f.client_id,
    clientName: nameById.get(f.client_id) ?? "Negocio",
    creatorLabel: f.created_by ? creatorLabelById.get(f.created_by) ?? null : null,
  }));
}

export type AdminStats = {
  totalNegocios: number;
  negociosUltimoMes: number;
  totalUsuarios: number;
  usuariosPorRol: { admin: number; agente: number; cliente: number; sibarita: number };
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

  const usuariosPorRol = { admin: 0, agente: 0, cliente: 0, sibarita: 0 };
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
  /** "Sibarita Davichin", etc. -- quién levantó la visita; null si no se pudo resolver. */
  creatorLabel: string | null;
};

export type HomeNegocioItem = {
  id: string;
  nombre: string;
  fecha: string;
  initial: string;
  avatarColor: string;
  /** "Sibarita Davichin", etc. -- quién dio de alta el negocio; null si no se pudo resolver. */
  creatorLabel: string | null;
};

export type HomeSummary = {
  visitasMes: number;
  promedioGeneral: number | null;
  actividadReciente: HomeActivityItem[];
  negociosRecientes: HomeNegocioItem[];
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

/** Estadísticas + actividad reciente para "Inicio" (móvil). Sin agentId = alcance global (admin).
 * includeNegociosRecientes: solo admin/sibarita ven el apartado de negocios
 * recién dados de alta (un Foodie ni siquiera tiene acceso a /negocios). */
export async function getHomeSummary(
  scope: { agentId?: string; includeNegociosRecientes?: boolean } = {}
): Promise<HomeSummary> {
  const db = getSupabaseServiceClient();

  let formsQuery = db
    .from("forms")
    .select("id, client_id, overall_score, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(60);
  if (scope.agentId) formsQuery = formsQuery.eq("created_by", scope.agentId);

  // No dependen entre sí -- se piden junto en vez de una tras otra.
  const [{ data: forms }, { data: recentClients }] = await Promise.all([
    formsQuery,
    scope.includeNegociosRecientes
      ? db
          .from("clients")
          .select("id, name, created_at, created_by")
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] as { id: string; name: string; created_at: string; created_by: string | null }[] }),
  ]);
  const allForms = forms || [];

  const negociosCreatorLabelById = await creatorFirstNameLabelsByUserId(
    db,
    (recentClients || []).map((c) => c.created_by).filter((id): id is string => Boolean(id))
  );
  const negociosRecientes: HomeNegocioItem[] = (recentClients || []).map((c) => ({
    id: c.id,
    nombre: c.name,
    fecha: formatShortDate(c.created_at),
    initial: initialsFor(c.name),
    avatarColor: avatarColorFor(c.name),
    creatorLabel: c.created_by ? negociosCreatorLabelById.get(c.created_by) ?? null : null,
  }));

  if (allForms.length === 0) {
    return { visitasMes: 0, promedioGeneral: null, actividadReciente: [], negociosRecientes };
  }

  const clientIds = Array.from(new Set(allForms.map((f) => f.client_id)));
  const { data: clients } = await db.from("clients").select("id, name").in("id", clientIds);
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  const creatorLabelById = await creatorLabelsByUserId(
    db,
    allForms.map((f) => f.created_by).filter((id): id is string => Boolean(id))
  );

  const now = new Date();
  const visitasMes = allForms.filter((f) => {
    const d = new Date(f.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const promedioGeneral =
    allForms.length > 0
      ? Math.round((allForms.reduce((sum, f) => sum + (f.overall_score || 0), 0) / allForms.length) * 10) / 10
      : null;

  const actividadReciente = allForms.slice(0, 3).map((f) => {
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
      creatorLabel: f.created_by ? creatorLabelById.get(f.created_by) ?? null : null,
    };
  });

  return { visitasMes, promedioGeneral, actividadReciente, negociosRecientes };
}

export type ReyNegocio = { id: string; nombre: string; scoreLabel: string } | null;

/** Misma lógica que getReyNegocio(), pero sin volver a pedir los negocios a
 * Supabase -- para cuando el caller ya tiene un ClientSummary[] a la mano
 * (ver app/negocios/page.tsx) y así evitar duplicar la consulta completa. */
export function reyFromClients(clients: ClientSummary[]): ReyNegocio {
  const withScore = clients.filter((c) => c.lastScore !== null && c.visitCount > 0);
  if (withScore.length === 0) return null;
  const top = withScore.reduce((best, c) => ((c.lastScore ?? 0) > (best.lastScore ?? 0) ? c : best));
  if (!top.lastScore || top.lastScore < 4) return null;
  return { id: top.id, nombre: top.name, scoreLabel: String(top.lastScore) };
}

/** El negocio mejor evaluado (para el banner "El Rey" de Inicio). Solo se muestra si hay un destacado claro (>=4). */
export async function getReyNegocio(): Promise<ReyNegocio> {
  const clients = await getClientsSummary();
  return reyFromClients(clients);
}

/** Todas las visitas registradas (cualquier agente), para el tab Reportes cuando lo ve un admin. */
export async function getAllVisits(): Promise<AgentVisit[]> {
  const db = getSupabaseServiceClient();

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, overall_score, created_at, client_id, created_by")
    .order("created_at", { ascending: false });

  if (!forms || forms.length === 0) return [];

  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .in("id", forms.map((f) => f.client_id));

  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  const creatorLabelById = await creatorLabelsByUserId(
    db,
    forms.map((f) => f.created_by).filter((id): id is string => Boolean(id))
  );

  return forms.map((f) => ({
    id: f.id,
    shortCode: f.short_code,
    overallScore: f.overall_score,
    createdAt: f.created_at,
    clientId: f.client_id,
    clientName: nameById.get(f.client_id) ?? "Negocio",
    creatorLabel: f.created_by ? creatorLabelById.get(f.created_by) ?? null : null,
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
// ============================================================
// Asignación de visitas (Sibarita/Foodie): admin asigna un negocio a
// un Foodie (rol "agente"), que solo puede levantar visitas que le
// hayan sido asignadas -- ver /api/asignaciones y /nueva-visita.
// ============================================================

export type Foodie = {
  id: string;
  fullName: string | null;
  email: string;
  /** Visitas asignadas todavía pendientes de hacer (para decidir a quién asignar). */
  pendingCount: number;
};

/** Usuarios con rol "agente" (Foodie), para el selector de "Asignar visita". */
export async function getFoodies(): Promise<Foodie[]> {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "agente")
    .order("full_name");

  const ids = (data || []).map((p) => p.id);
  const pendingByFoodie = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pending } = await db
      .from("visit_assignments")
      .select("assigned_to")
      .eq("status", "pendiente")
      .in("assigned_to", ids);
    for (const row of pending || []) {
      pendingByFoodie.set(row.assigned_to, (pendingByFoodie.get(row.assigned_to) ?? 0) + 1);
    }
  }

  return (data || []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    pendingCount: pendingByFoodie.get(p.id) ?? 0,
  }));
}

export type PendingAssignment = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: string;
  note: string | null;
  createdAt: string;
};

/** Visitas asignadas y pendientes (status="pendiente") para un Foodie, en "/nueva-visita". */
export async function getPendingAssignmentsFor(userId: string): Promise<PendingAssignment[]> {
  const db = getSupabaseServiceClient();

  const { data: assignments } = await db
    .from("visit_assignments")
    .select("id, client_id, note, created_at")
    .eq("assigned_to", userId)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false });

  if (!assignments || assignments.length === 0) return [];

  const { data: clients } = await db
    .from("clients")
    .select("id, name, type")
    .in("id", assignments.map((a) => a.client_id));

  const clientById = new Map((clients || []).map((c) => [c.id, c]));

  return assignments
    .map((a) => {
      const client = clientById.get(a.client_id);
      if (!client) return null;
      return {
        id: a.id,
        clientId: client.id,
        clientName: client.name,
        clientType: client.type,
        note: a.note,
        createdAt: a.created_at,
      };
    })
    .filter((a): a is PendingAssignment => a !== null);
}

export type PendingAssignmentForClient = {
  id: string;
  foodieId: string;
  foodieName: string | null;
  foodieEmail: string;
  note: string | null;
  createdAt: string;
};

/** La asignación pendiente (si existe) de un negocio, para mostrar "Asignado a" en su detalle. */
export async function getPendingAssignmentForClient(clientId: string): Promise<PendingAssignmentForClient | null> {
  const db = getSupabaseServiceClient();

  const { data: assignment } = await db
    .from("visit_assignments")
    .select("id, assigned_to, note, created_at")
    .eq("client_id", clientId)
    .eq("status", "pendiente")
    .is("plan_id", null) // las visitas de un plan se administran en su propia tarjeta
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assignment || !assignment.assigned_to) return null;

  const { data: foodie } = await db
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", assignment.assigned_to)
    .maybeSingle();
  if (!foodie) return null;

  return {
    id: assignment.id,
    foodieId: foodie.id,
    foodieName: foodie.full_name,
    foodieEmail: foodie.email,
    note: assignment.note,
    createdAt: assignment.created_at,
  };
}

export type AssignmentWithClient = {
  id: string;
  status: string;
  clientId: string;
  assignedTo: string;
  client: {
    id: string;
    name: string;
    type: string;
    instagramHandle: string | null;
    email: string | null;
    city: string | null;
  };
};

/** Una asignación puntual + los datos del negocio, para precargar el wizard al abrirla. */
export async function getAssignmentDetail(assignmentId: string): Promise<AssignmentWithClient | null> {
  const db = getSupabaseServiceClient();

  const { data: assignment } = await db
    .from("visit_assignments")
    .select("id, status, client_id, assigned_to")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return null;

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, instagram_handle, email, city")
    .eq("id", assignment.client_id)
    .maybeSingle();
  if (!client) return null;

  return {
    id: assignment.id,
    status: assignment.status,
    clientId: assignment.client_id,
    assignedTo: assignment.assigned_to,
    client: {
      id: client.id,
      name: client.name,
      type: client.type,
      instagramHandle: client.instagram_handle,
      email: client.email,
      city: client.city,
    },
  };
}
