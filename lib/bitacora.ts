import { getSupabaseServiceClient } from "./supabase";
import { ROLE_LABELS } from "./brand";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Bitácora por negocio (solo Master Chef): una línea de tiempo con fecha, hora y acción —quién la hizo— que mezcla
 *  (a) lo que ya queda guardado en las tablas de siempre (alta, solicitud, asignación, visita, correos, aperturas,
 *      pagos, recordatorios, plan, asesoría), así que también cuenta el pasado; y
 *  (b) business_log, para lo que antes no dejaba huella (reasignaciones, visita tomada de la bolsa, reenvíos, ediciones).
 * Cada bloque tolera que su tabla o columna aún no exista.
 */
export type BitacoraGroup = "negocio" | "visita" | "correo" | "reporte" | "pago" | "plan";

export type BitacoraEntry = {
  at: string;
  group: BitacoraGroup;
  emoji: string;
  title: string;
  detail?: string;
  warn?: boolean;
};

export const GROUP_LABEL: Record<BitacoraGroup, string> = {
  negocio: "Negocio",
  visita: "Visitas",
  correo: "Correos",
  reporte: "Reporte",
  pago: "Pagos",
  plan: "Plan y asesorías",
};

// ------------------------------------------------------------------ escritura
/** Anota una acción en la bitácora. Nunca rompe la acción que se está registrando (si falla, se ignora). */
export async function logBusinessEvent(
  db: Db,
  e: { clientId: string; kind: string; title: string; detail?: string | null; actorId?: string | null; refId?: string | null }
): Promise<void> {
  try {
    let actorName: string | null = null;
    let actorRole: string | null = null;
    if (e.actorId) {
      const { data } = await db.from("profiles").select("full_name, email, role").eq("id", e.actorId).maybeSingle();
      actorName = (data?.full_name as string | null) || (data?.email as string | null) || null;
      actorRole = (data?.role as string | null) ?? null;
    }
    await db.from("business_log").insert({
      client_id: e.clientId,
      kind: e.kind,
      title: e.title,
      detail: e.detail ?? null,
      actor_id: e.actorId ?? null,
      actor_name: actorName,
      actor_role: actorRole,
      ref_id: e.refId ?? null,
    });
  } catch {
    // sin bitácora la acción igual se hizo
  }
}

/** "Master Chef Luis Arenas", "Sibarita Ana", "Shopper Pedro". */
export function personLabel(name: string | null | undefined, role: string | null | undefined): string {
  const r = role ? ROLE_LABELS[role] ?? role : "";
  const n = (name || "").trim();
  return [r, n].filter(Boolean).join(" ") || "alguien del equipo";
}

// ------------------------------------------------------------------ lectura
type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const money = (n: unknown) => Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const SOURCE_LABEL: Record<string, string> = {
  nav: "menú", inicio: "botón del Inicio", servicios: "página de Servicios", footer: "pie de página", pagina: "página de la solicitud", nosotros: "página de Nosotros", otra: "la web",
};

export async function getBitacora(db: Db, clientId: string): Promise<BitacoraEntry[]> {
  const out: BitacoraEntry[] = [];
  const add = (at: unknown, group: BitacoraGroup, emoji: string, title: string, detail?: string | null, warn = false) => {
    const when = s(at);
    if (when) out.push({ at: when, group, emoji, title, detail: detail || undefined, warn });
  };
  const rows = async (q: PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Row[]> => {
    try {
      const r = await q;
      return r.error || !r.data ? [] : (r.data as Row[]);
    } catch {
      return [];
    }
  };

  const [clients, forms, requests, assignments, plans, bookings, purchases, logs] = await Promise.all([
    rows(db.from("clients").select("*").eq("id", clientId).limit(1)),
    rows(db.from("forms").select("*").eq("client_id", clientId).order("created_at", { ascending: true }).limit(200)),
    rows(db.from("visit_requests").select("*").eq("client_id", clientId).limit(50)),
    rows(db.from("visit_assignments").select("*").eq("client_id", clientId).limit(200)),
    rows(db.from("client_plans").select("*").eq("client_id", clientId).limit(20)),
    rows(db.from("consultation_bookings").select("*").eq("client_id", clientId).limit(20)),
    rows(db.from("profile_purchases").select("*").eq("client_id", clientId).limit(50)),
    rows(db.from("business_log").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(300)),
  ]);

  const formIds = forms.map((f) => f.id as string);
  const planIds = plans.map((p) => p.id as string);
  const [emails, periods] = await Promise.all([
    formIds.length ? rows(db.from("email_confirmations").select("form_id, recipient_email, subject, status, sent_at").in("form_id", formIds).limit(500)) : Promise.resolve([] as Row[]),
    planIds.length ? rows(db.from("plan_periods").select("plan_id, month, amount, paid_at").in("plan_id", planIds).limit(100)) : Promise.resolve([] as Row[]),
  ]);

  // Nombres de las personas que aparecen (quién dio de alta, asignó, hizo la visita...).
  const ids = new Set<string>();
  const collect = (r: Row, ...keys: string[]) => keys.forEach((k) => s(r[k]) && ids.add(r[k] as string));
  clients.forEach((c) => collect(c, "created_by"));
  forms.forEach((f) => collect(f, "created_by"));
  requests.forEach((r) => collect(r, "assigned_to"));
  assignments.forEach((a) => collect(a, "assigned_to", "assigned_by"));
  plans.forEach((p) => collect(p, "created_by", "default_foodie_id"));
  purchases.forEach((p) => collect(p, "mysterfoodie_id"));
  const people = new Map<string, string>();
  if (ids.size) {
    const profs = await rows(db.from("profiles").select("id, full_name, email, role").in("id", [...ids]));
    profs.forEach((p) => people.set(p.id as string, personLabel((s(p.full_name) || s(p.email)) as string | null, s(p.role))));
  }
  const who = (id: unknown) => (s(id) ? people.get(id as string) ?? null : null);

  // ---- Negocio
  const c = clients[0];
  if (c) {
    const web = c.source === "web";
    const by = who(c.created_by);
    add(c.created_at, "negocio", "🏪", web ? "Se dio de alta solo desde mysterfoodie.com" : by ? `Se añadió a MysterFoodie por ${by}` : "Se añadió a MysterFoodie", web ? "Pidió su visita gratis en la web" : undefined);
    add(c.account_invited_at, "negocio", "🔑", "Se le invitó a crear su cuenta");
  }

  // ---- Solicitudes de visita (web)
  for (const r of requests) {
    const programada = r.kind === "programada";
    add(r.created_at, "visita", "🎁", programada ? "Pidió una visita programada en la web" : "Pidió su visita GRATIS en la web", `Desde: ${SOURCE_LABEL[(s(r.source) || "otra")] ?? "la web"}${s(r.schedule_pref) ? ` · pidió ${r.schedule_pref}` : ""}`);
    add(r.confirmation_sent_at, "correo", "✉️", "Correo: «tu solicitud fue recibida»");
    add(r.admin_notified_at, "correo", "🔔", "Aviso enviado al Master Chef");
    add(r.paid_at, "pago", "💳", `Pagó su visita asegurada${r.payment_amount ? ` (${money(r.payment_amount)})` : ""}`);
    add(r.nofoodie_email_sent_at, "correo", "✉️", "Correo: por alta demanda no hubo MysterFoodie (con opción de asegurar su visita)");
    add(r.completed_at, "visita", "✅", "La solicitud de visita se completó");
  }

  // ---- Asignaciones. Las que tienen entradas en business_log se muestran desde ahí (con quién y cuándo reales).
  const logged = new Set(logs.filter((l) => l.kind === "asignacion").map((l) => s(l.ref_id)).filter(Boolean));
  for (const a of assignments) {
    if (logged.has(a.id as string)) {
      add(a.notified_at, "correo", "✉️", `Correo al Shopper: nueva visita asignada${who(a.assigned_to) ? ` (${who(a.assigned_to)})` : ""}`);
      continue;
    }
    const to = who(a.assigned_to);
    const by = who(a.assigned_by);
    if (a.plan_id && !to) add(a.created_at, "plan", "📅", "Se programó una visita del plan", s(a.plan_month) ? `Mes ${a.plan_month}` : undefined);
    else add(a.created_at, "visita", "🧭", `Se asignó visita${to ? ` a ${to}` : ""}${by ? ` por ${by}` : ""}`);
    add(a.notified_at, "correo", "✉️", `Correo al Shopper: nueva visita asignada${to ? ` (${to})` : ""}`);
  }

  // ---- Visitas y todo lo que pasó con su reporte
  for (const f of forms) {
    const n = Number(f.overall_score ?? 0).toFixed(1);
    const who2 = who(f.created_by) || s(f.shopper_name);
    const plan = Boolean(f.plan_id);
    add(f.created_at, "visita", "✅", `Se finalizó la visita${plan ? " del plan" : ""}`, `Calificación ${n}${who2 ? ` · por ${who2}` : ""}`);
    add(f.ticket_uploaded_at, "visita", "🧾", "Se subió el ticket de la visita");
    add(f.ticket_email_sent_at, "correo", "✉️", "Correo: ticket de la visita");
    add(f.followup_sent_at, "correo", "✉️", "Correo de seguimiento automático");
    add(f.profile_offer_sent_at, "correo", "✉️", "Correo: oferta del perfil anónimo");
    if (!plan) {
      add(f.first_viewed_at, "reporte", "👀", "Abrió su reporte por primera vez");
      if (Number(f.view_count ?? 0) > 1) add(f.last_viewed_at, "reporte", "👀", `Volvió a abrir su reporte (${f.view_count} aperturas en total)`);
      add(f.lead_email_at, "reporte", "📬", "Dejó su correo para ver el resumen por categoría", s(f.lead_email));
      add(f.checkout_clicked_at, "reporte", "🛒", "Tocó «Comprar» el reporte completo");
      add(f.remind1_sent_at, "correo", "⏰", "Recordatorio 1 enviado (día 2)");
      add(f.remind2_sent_at, "correo", "⏰", "Recordatorio 2 enviado (día 7)");
      add(f.followup_optout_at, "correo", "🚫", "Se dio de baja de los recordatorios");
    }
    add(f.report_unlocked_at, "pago", "💰", plan ? "Reporte completo entregado" : "Pagó el reporte completo");
  }
  for (const e of emails) {
    const failed = e.status === "failed";
    add(e.sent_at, "correo", failed ? "⚠️" : "✉️", failed ? `Falló el correo «${e.subject}»` : `Correo enviado: «${e.subject}»`, `Para ${e.recipient_email}`, failed);
  }

  // ---- Planes, cobros, asesorías, perfiles
  for (const p of plans) {
    const by = who(p.created_by);
    add(p.created_at, "plan", "📅", `Se contrató el plan ${p.plan_name ?? ""}`.trim(), `${p.visits_per_month} visitas al mes${by ? ` · registrado por ${by}` : ""}`);
    add(p.ticket_sent_at, "correo", "✉️", "Correo: acuerdo del plan");
    if (p.status && p.status !== "activo") add(p.created_at, "plan", "⏸️", `El plan está ${p.status}`);
  }
  for (const m of periods) add(m.paid_at, "pago", "💰", `Cobro del plan de ${m.month} registrado`, money(m.amount));
  for (const b of bookings) add(b.created_at, "plan", "🗓️", "Agendó una asesoría", s(b.slot_start) ? `Para el ${new Date(b.slot_start as string).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })}` : undefined);
  for (const p of purchases) if (p.paid_at) add(p.paid_at, "pago", "💳", `Compró el perfil de ${who(p.mysterfoodie_id) ?? "un MysterFoodie"}`, money(p.amount));

  // ---- Acciones registradas en la bitácora
  for (const l of logs) {
    const actor = l.actor_name || l.actor_role ? personLabel(s(l.actor_name), s(l.actor_role)) : null;
    const emoji = l.kind === "asignacion" ? "🧭" : l.kind === "correo_reenvio" ? "📨" : l.kind === "datos_editados" ? "✏️" : "📝";
    const group: BitacoraGroup = l.kind === "correo_reenvio" ? "correo" : l.kind === "asignacion" ? "visita" : "negocio";
    add(l.created_at, group, emoji, `${l.title}${actor ? ` · ${actor}` : ""}`, s(l.detail));
  }

  return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
