import { getSupabaseServiceClient } from "./supabase";
import { getReportFunnel, type ReportFunnel } from "./reportTracking";
import { fetchWebEvents, summarizeWeb, type WebSummary } from "./webStats";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Todo lo que se MIDE, junto, para Perfil > Stats (solo Master Chef): el embudo del reporte, qué hizo cada reporte,
 * correos y recordatorios, de dónde llegan las solicitudes y el contador propio de mysterfoodie.com.
 * Cada bloque tolera que su SQL aún no se haya corrido (devuelve null y la pantalla lo avisa).
 */
export type ReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  checkoutClickedAt: string | null;
  paid: boolean;
  leadEmail: boolean;
  remind1: boolean;
  remind2: boolean;
  optedOut: boolean;
};

export type Seguimiento = {
  days: number;
  funnel: ReportFunnel | null;
  reports: ReportRow[] | null;
  reminders: { sent1: number; sent2: number; optOut: number; leads: number } | null;
  emails: { sent: number; failed: number; recent: { to: string; subject: string; status: string; at: string }[] } | null;
  requests: { total: number; bySource: { source: string; n: number; assigned: number }[]; byKind: { gratis: number; programada: number } } | null;
  web: WebSummary | null;
};

export async function getSeguimiento(db: Db, days: number): Promise<Seguimiento> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const funnel = await getReportFunnel(db, days).catch(() => null);

  // Reportes enviados en el periodo (primero con las columnas de recordatorios; si no existen, sin ellas).
  const full = "id, client_id, created_at, view_count, first_viewed_at, last_viewed_at, checkout_clicked_at, report_unlocked_at, lead_email, remind1_sent_at, remind2_sent_at, followup_optout_at";
  const basic = "id, client_id, created_at, view_count, first_viewed_at, last_viewed_at, checkout_clicked_at, report_unlocked_at";
  let hasReminders = true;
  const q = (cols: string) =>
    db.from("forms").select(cols).is("plan_id", null).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
  let res: { data: unknown[] | null; error: unknown } = await q(full);
  if (res.error) {
    hasReminders = false;
    res = await q(basic);
  }
  let reports: ReportRow[] | null = null;
  let reminders: Seguimiento["reminders"] = null;
  if (!res.error && res.data) {
    const rows = res.data as Record<string, string | number | null>[];
    const ids = [...new Set(rows.map((r) => r.client_id as string))];
    const { data: clients } = ids.length ? await db.from("clients").select("id, name").in("id", ids) : { data: [] };
    const nameOf = new Map((clients || []).map((c) => [c.id as string, c.name as string]));
    reports = rows.map((r) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      clientName: nameOf.get(r.client_id as string) ?? "Negocio",
      createdAt: r.created_at as string,
      viewCount: Number(r.view_count ?? 0),
      firstViewedAt: (r.first_viewed_at as string | null) ?? null,
      lastViewedAt: (r.last_viewed_at as string | null) ?? null,
      checkoutClickedAt: (r.checkout_clicked_at as string | null) ?? null,
      paid: Boolean(r.report_unlocked_at),
      leadEmail: Boolean(r.lead_email),
      remind1: Boolean(r.remind1_sent_at),
      remind2: Boolean(r.remind2_sent_at),
      optedOut: Boolean(r.followup_optout_at),
    }));
    if (hasReminders) {
      reminders = {
        sent1: reports.filter((r) => r.remind1).length,
        sent2: reports.filter((r) => r.remind2).length,
        optOut: reports.filter((r) => r.optedOut).length,
        leads: reports.filter((r) => r.leadEmail).length,
      };
    }
  }

  // Correos enviados por la app (tabla email_confirmations: estado = enviado / failed).
  let emails: Seguimiento["emails"] = null;
  const em = await db.from("email_confirmations").select("recipient_email, subject, status, sent_at").gte("sent_at", since).order("sent_at", { ascending: false }).limit(2000);
  if (!em.error && em.data) {
    const failed = em.data.filter((e) => e.status === "failed");
    emails = {
      sent: em.data.length - failed.length,
      failed: failed.length,
      recent: em.data.slice(0, 8).map((e) => ({ to: e.recipient_email as string, subject: e.subject as string, status: e.status as string, at: e.sent_at as string })),
    };
  }

  // Solicitudes de visita por botón de origen de la web.
  let requests: Seguimiento["requests"] = null;
  const rq = await db.from("visit_requests").select("source, kind, status").gte("created_at", since).limit(5000);
  if (!rq.error && rq.data) {
    const by = new Map<string, { n: number; assigned: number }>();
    for (const r of rq.data) {
      const k = (r.source as string | null) || "otra";
      const cur = by.get(k) ?? { n: 0, assigned: 0 };
      cur.n++;
      if (r.status === "asignada" || r.status === "completada") cur.assigned++;
      by.set(k, cur);
    }
    requests = {
      total: rq.data.length,
      bySource: [...by.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.n - a.n),
      byKind: { gratis: rq.data.filter((r) => r.kind !== "programada").length, programada: rq.data.filter((r) => r.kind === "programada").length },
    };
  }

  const events = await fetchWebEvents(db, days).catch(() => null);
  const web = events ? summarizeWeb(events, days) : null;

  return { days, funnel, reports, reminders, emails, requests, web };
}
