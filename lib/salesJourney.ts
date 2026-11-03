import { getSupabaseServiceClient } from "./supabase";
import { PLAN_CATALOG, PLAN_KEYS } from "./planCatalog";
import { PACKAGES_URL } from "./links";

type Db = ReturnType<typeof getSupabaseServiceClient>;
type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Proceso de venta de un negocio en 4 etapas (barra «caramelo» en el perfil del negocio):
 *  1. Muestra: la visita gratis (prospección).
 *  2. Ticket y recordatorios: correo del ticket y recordatorios del reporte, para convencer.
 *  3. Compra: el reporte completo, comprado desde la curiosidad.
 *  4. Expansión: perfil anónimo, asesoría y paquetes de visitas (las ofertas de Automatizaciones).
 * VIP = el negocio tiene un plan o paquete de visitas contratado (activo o pausado).
 * Todo se deduce de las tablas de siempre; cada lectura tolera que su tabla o columna aún no exista.
 */
export type StageKey = "muestra" | "ticket" | "compra" | "expansion";
export type StageState = "done" | "current" | "todo";

export type JourneyStep = { label: string; done: boolean; at: string | null; hint?: string };
export type JourneyStage = {
  key: StageKey;
  /** Título para el equipo. */
  title: string;
  /** Título para el negocio (tono «ustedes»). */
  ownerTitle: string;
  state: StageState;
  steps: JourneyStep[];
};

export type OwnerCta = { label: string; href: string };

export type SalesJourney = {
  stages: JourneyStage[];
  /** Índice de la etapa en curso (0..3); 4 si todo está completo. */
  currentIndex: number;
  vip: boolean;
  vipSince: string | null;
  planNames: string[];
  latestShortCode: string | null;
  /** Qué sigue, para el equipo. */
  nextTeam: string;
  /** Qué sigue, para el negocio. */
  nextOwner: { text: string; ctas: OwnerCta[] };
};

const rows = async (q: PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Row[]> => {
  try {
    const r = await q;
    return r.error || !r.data ? [] : (r.data as Row[]);
  } catch {
    return [];
  }
};

/** La fecha más antigua de una columna entre varias filas (la «primera vez» que pasó). */
const first = (rs: Row[], key: string): string | null => {
  const v = rs.map((r) => str(r[key])).filter((x): x is string => Boolean(x)).sort();
  return v[0] ?? null;
};

const ACTIVE_PLAN = ["activo", "pausado"];

/** ¿Es VIP? (tiene un plan o paquete de visitas contratado). Liviano: lo usan el reporte público y el correo. */
export async function getVipStatus(db: Db, clientId: string): Promise<{ vip: boolean; since: string | null; planNames: string[] }> {
  const plans = await rows(db.from("client_plans").select("plan_name, status, created_at").eq("client_id", clientId).in("status", ACTIVE_PLAN).limit(20));
  const since = plans.map((p) => str(p.created_at)).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  return { vip: plans.length > 0, since, planNames: plans.map((p) => str(p.plan_name) ?? "").filter(Boolean) };
}

export async function getSalesJourney(db: Db, clientId: string): Promise<SalesJourney> {
  const [clients, forms, requests, assignments, plans, bookings, purchases] = await Promise.all([
    rows(db.from("clients").select("*").eq("id", clientId).limit(1)),
    rows(db.from("forms").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200)),
    rows(db.from("visit_requests").select("*").eq("client_id", clientId).limit(50)),
    rows(db.from("visit_assignments").select("id, created_at").eq("client_id", clientId).limit(100)),
    rows(db.from("client_plans").select("*").eq("client_id", clientId).limit(20)),
    rows(db.from("consultation_bookings").select("created_at").eq("client_id", clientId).limit(20)),
    rows(db.from("profile_purchases").select("paid_at, status").eq("client_id", clientId).eq("status", "approved").limit(50)),
  ]);

  const client = clients[0] ?? {};
  const sample = forms.filter((f) => !f.plan_id); // visitas de muestra o compradas una por una (no del plan)
  const paidReports = sample.filter((f) => str(f.report_unlocked_at));
  const livePlans = plans.filter((p) => ACTIVE_PLAN.includes(String(p.status)));
  const latestShortCode = str((forms[0] ?? {}).short_code);

  // ---- Estado de cada etapa
  const visited = forms.length > 0;
  const bought = paidReports.length > 0 || requests.some((r) => str(r.paid_at)) || livePlans.length > 0;
  const nudged = sample.some((f) => str(f.ticket_email_sent_at) || str(f.remind1_sent_at) || str(f.remind2_sent_at)) || bought;
  const expanded = livePlans.length > 0 || purchases.length > 0 || paidReports.length >= 2;

  const done = [visited, nudged && visited, bought, expanded];
  // La etapa en curso es la primera que falta; una etapa posterior completa «salta» las anteriores.
  let currentIndex = done.findIndex((d) => !d);
  if (currentIndex === -1) currentIndex = 4;

  const step = (label: string, at: string | null, hint?: string): JourneyStep => ({ label, done: Boolean(at), at, hint });

  const muestraSteps: JourneyStep[] = [
    step("Pidió su visita gratis", first(requests, "created_at"), "Llega desde la web (Solicita una visita)"),
    step("Visita asignada a un MysterFoodie", first(assignments, "created_at") ?? (visited ? first(forms, "created_at") : null), "Se asigna desde Negocios"),
    step("Visita realizada y resultado enviado", first(forms, "created_at"), "El correo de resultado sale al guardar la visita"),
  ];
  const ticketSteps: JourneyStep[] = [
    step("Ticket de consumo subido", first(sample, "ticket_uploaded_at"), "Lo sube el MysterFoodie"),
    step("Correo del ticket (oferta o aviso)", first(sample, "ticket_email_sent_at"), "Sale 3 días después de subir el ticket"),
    step("Abrió su reporte", first(sample, "first_viewed_at"), "Se mide con el enlace del reporte"),
    step("Recordatorio · día 2", first(sample, "remind1_sent_at"), "Solo si aún no compra"),
    step("Recordatorio · día 7", first(sample, "remind2_sent_at"), "Solo si aún no compra"),
    step("Tocó «Comprar»", first(sample, "checkout_clicked_at"), "Señal de que está por decidir"),
  ];
  const compraSteps: JourneyStep[] = [
    step(livePlans.length && !paidReports.length ? "Contrató un plan" : "Compró el reporte completo", first(paidReports, "report_unlocked_at") ?? first(requests, "paid_at") ?? first(livePlans, "created_at"), "Pago con MercadoPago"),
    step("Invitación a crear su cuenta", str(client.account_invited_at), "Correo 20 min después de la compra"),
    step("Correo de la asesoría gratuita", first(sample, "followup_sent_at"), "Sale a las 8 am del día siguiente"),
  ];
  const expansionSteps: JourneyStep[] = [
    step("Oferta del perfil del MysterFoodie (ID / Passport)", first(sample, "profile_offer_sent_at"), "Correo 2 días después de tener el reporte completo"),
    step("Compró un perfil anónimo", first(purchases, "paid_at"), "Nivel 🪪 ID o 👑 Passport"),
    step("Agendó su asesoría gratuita", first(bookings, "created_at"), "20 min para platicar los resultados"),
    step("Contrató un plan o paquete de visitas", first(livePlans, "created_at"), "Starter, Appetizer o Main course"),
  ];

  const mk = (key: StageKey, title: string, ownerTitle: string, steps: JourneyStep[], i: number): JourneyStage => ({
    key, title, ownerTitle, steps, state: i < currentIndex ? "done" : i === currentIndex ? "current" : "todo",
  });
  const stages = [
    mk("muestra", "Muestra · visita gratis", "Su visita de muestra", muestraSteps, 0),
    mk("ticket", "Ticket y recordatorios", "Su resultado y ticket", ticketSteps, 1),
    mk("compra", "Compra del reporte", "Su reporte completo", compraSteps, 2),
    mk("expansion", "Expansión · perfil y paquetes", "Crecer con MysterFoodie", expansionSteps, 3),
  ];

  const vip = livePlans.length > 0;
  const vipSince = first(livePlans, "created_at");
  const planNames = livePlans.map((p) => str(p.plan_name) ?? "").filter(Boolean);

  // ---- Qué sigue
  const undone = (s: JourneyStage) => s.steps.find((x) => !x.done);
  const cur = stages[currentIndex];
  const packages = PLAN_KEYS.map((k) => `${PLAN_CATALOG[k].name} (${PLAN_CATALOG[k].visitsPerMonth} visitas al mes por sucursal, $${PLAN_CATALOG[k].pricePerVisit} c/u)`).join(" · ");
  let nextTeam: string;
  if (!cur) nextTeam = vip ? "Es VIP: cuídalo, pídele una reseña y propón sumar sucursales." : "Proceso completo: propón más visitas o sucursales.";
  else if (cur.key === "muestra") nextTeam = visited ? "Falta enviar el resultado de la visita." : "Asigna la visita gratis a un MysterFoodie y espera su resultado.";
  else if (cur.key === "ticket") nextTeam = undone(cur) ? `${undone(cur)!.label}. ${undone(cur)!.hint ?? ""}`.trim() : "Esperar su decisión: ya recibió todos los correos de seguimiento.";
  else if (cur.key === "compra") nextTeam = "Ya conoce su resultado: ayúdalo a decidir por el reporte completo (detalle de la visita, ticket e indicadores).";
  else nextTeam = `Expande: ofrece el perfil del MysterFoodie (ID o Passport), la asesoría gratuita o un paquete de visitas. Paquetes: ${packages}.`;

  const link = latestShortCode ? `/r/${latestShortCode}` : null;
  const ctas: OwnerCta[] = [];
  let ownerText: string;
  if (!cur) {
    ownerText = "Gracias por confiar en nosotros. Seguimos a sus órdenes para lo que sigue.";
  } else if (cur.key === "muestra") {
    ownerText = visited ? "Su visita de muestra ya se realizó; pronto verán su resultado." : "Su visita de muestra va en camino. Cuando se realice, les llegará su resultado por correo.";
  } else if (cur.key === "ticket") {
    ownerText = "Ya tienen el resultado de su visita. Ábranlo para ver cómo los calificó un MysterFoodie, de forma anónima e independiente.";
    if (link) ctas.push({ label: "Ver mi resultado", href: link });
  } else if (cur.key === "compra") {
    ownerText = "Su resultado es solo el comienzo: con el reporte completo ven el detalle de la visita, el ticket y los indicadores, además de una asesoría gratuita de 20 minutos.";
    if (link) ctas.push({ label: "Ver el reporte completo", href: link });
  } else {
    ownerText = "Ya conocen el detalle de su visita. Sigan creciendo: conozcan el perfil de quien los visitó, platiquen con nosotros o programen visitas cada mes.";
    if (link && !bookings.length) ctas.push({ label: "Agendar mi asesoría gratuita", href: `/agendar/${latestShortCode}` });
    ctas.push({ label: "Ver paquetes de visitas", href: PACKAGES_URL });
  }

  return {
    stages,
    currentIndex,
    vip,
    vipSince,
    planNames,
    latestShortCode,
    nextTeam,
    nextOwner: { text: ownerText, ctas },
  };
}
