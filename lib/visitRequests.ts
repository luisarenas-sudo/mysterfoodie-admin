import { GLOSARIO_NEGOCIO } from "./glosario";
import { getSupabaseServiceClient } from "./supabase";
import { BUSINESS_TYPES, businessTypePhrase } from "./categories";
import { escapeHtml, renderButton, renderEmailShell, sendHtmlEmail, sendTemplatedEmail, type SendEmailOutcome } from "./email";
import { FULL_REPORT_PRICE_MXN, FULL_REPORT_PRICE_WITH_IVA_MXN } from "./mercadopago";
import { PACKAGES_URL } from "./links";
import { sibaritaEarningsCallout, shopperEarningsCallout } from "./earningsCopy";
import { getAutomation, renderTemplate } from "./automations";
import { ACCESS_TTL_DAYS, accessUrl, issueAccessToken } from "./accessTokens";
import { sendAssignmentEmail } from "./assignments";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * "Solicita una visita GRATIS" (mysterfoodie.com).
 *
 * Una persona llena el formulario público -> el negocio se da de alta (clients, source="web"),
 * se le crea su cuenta y recibe un correo con sus datos y el acceso; el Master Chef recibe aviso
 * y asigna la solicitud a un sibarita, un Shopper o a sí mismo desde /solicitudes.
 *
 * Reglas de tiempo (ver supabase/solicitudes_visita.sql):
 *  - Una vez asignada, la persona asignada tiene OPEN_AFTER_DAYS (3) días en exclusiva.
 *  - Del día 4 al 5 la solicitud también aparece a todos los Shoppers, que pueden tomarla.
 *  - Al día EXPIRE_AFTER_DAYS (5) sin visita, se le avisa al negocio que por ahora no hay Shopper
 *    y se le invita a ver los paquetes. Una solicitud que nunca se asignó vence igual, 5 días
 *    después de llegar.
 *
 * Solicitudes sin asignar (escalamiento, en horas hábiles de 8:00 a 20:00 CDMX desde que llegan; ver supabase/solicitudes_escalamiento.sql):
 *  - +2 h: correo al Master Chef "Tienes nuevas visitas no asignadas" con botón a /solicitudes.
 *  - +3 h: se ofrecen a los sibaritas (quien la toma primero se la queda).
 *  - +5 h: se ofrecen también a los Shoppers.
 *  - Una solicitud "programada" ($850 + consumo) no entra a la bolsa ni vence sola: el Master Chef
 *    acuerda fecha, pago y consumo en persona.
 *  - El Master Chef puede, en vez de asignarla, avisar "alta demanda" (sin_foodie + correo con paquetes).
 */
export const OPEN_AFTER_DAYS = 3;
export const EXPIRE_AFTER_DAYS = 5;
export { PACKAGES_URL };
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const ALERT_AFTER_HOURS = 2;
export const SIBARITAS_AFTER_HOURS = 3;
export const SHOPPERS_AFTER_HOURS = 5;

/**
 * Horario de avisos y asignaciones: de 8:00 a 20:00 hora CDMX (UTC-6 todo el año). Fuera de ese horario el Master Chef
 * se entera de inmediato (correo de nueva solicitud y Pendientes del dashboard), pero el reloj de escalamiento
 * (2 h / 3 h / 5 h) solo corre dentro del horario: una solicitud de las 11 pm empieza a contar a las 8 am.
 */
export const NOTIFY_FROM_HOUR = 8;
export const NOTIFY_TO_HOUR = 20;
const CDMX_OFFSET_MS = 6 * HOUR_MS;

/** Milisegundos transcurridos entre dos momentos contando solo las ventanas de 8:00 a 20:00 (CDMX). */
export function businessElapsedMs(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  const from = fromMs - CDMX_OFFSET_MS;
  const to = toMs - CDMX_OFFSET_MS;
  let total = 0;
  for (let day = Math.floor(from / DAY_MS); day <= Math.floor(to / DAY_MS); day++) {
    const start = Math.max(from, day * DAY_MS + NOTIFY_FROM_HOUR * HOUR_MS);
    const end = Math.min(to, day * DAY_MS + NOTIFY_TO_HOUR * HOUR_MS);
    if (end > start) total += end - start;
  }
  return total;
}

/** ¿Ahora estamos dentro del horario de avisos (8:00 a 20:00 CDMX)? */
export function inNotificationWindow(nowMs = Date.now()): boolean {
  const hour = new Date(nowMs - CDMX_OFFSET_MS).getUTCHours();
  return hour >= NOTIFY_FROM_HOUR && hour < NOTIFY_TO_HOUR;
}

/** Horas hábiles (8-20 CDMX) que lleva una solicitud sin asignar. */
export function businessHoursSince(createdIso: string, nowMs = Date.now()): number {
  return businessElapsedMs(new Date(createdIso).getTime(), nowMs) / HOUR_MS;
}

export const REQUEST_SOURCES = new Set(["nav", "inicio", "servicios", "footer", "pagina", "nosotros", "otra"]);

export type RequestStatus = "pendiente" | "asignada" | "completada" | "sin_foodie";
export type RequestKind = "gratis" | "programada";

const baseUrlOf = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";

// ---------------------------------------------------------------------------
// Alta: negocio + cuenta + solicitud
// ---------------------------------------------------------------------------

export type RequestInput = {
  name: string;
  type: string;
  city: string;
  address: string;
  contactName: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  message: string | null;
  source: string;
  ipHash: string;
  /** gratis = "Solicita una visita GRATIS"; programada = quiere contratar una visita ($850 + consumo). */
  kind: RequestKind;
  /** Fecha/horario que pidió (solo programada), ya en texto legible. */
  schedulePref: string | null;
};

export type CreateOutcome =
  | { ok: true; requestId: string; duplicate: false }
  | { ok: true; requestId: string; duplicate: true }
  | { ok: false; error: string };

/** Crea (o reutiliza) el negocio, su cuenta y la solicitud; manda los correos. */
export async function createVisitRequest(db: Db, input: RequestInput): Promise<CreateOutcome> {
  const baseUrl = baseUrlOf();
  const type = BUSINESS_TYPES.some((t) => t.value === input.type) ? input.type : "otro";

  // ¿Ya existe una persona con ese correo? (cuenta de cliente, o incluso de equipo)
  const { data: profile } = await db
    .from("profiles")
    .select("id, role, client_id")
    .ilike("email", input.email)
    .maybeSingle();

  // ¿Ya existe un negocio con ese correo?
  let clientId: string | null = (profile?.role === "cliente" ? (profile.client_id as string | null) : null) ?? null;
  if (!clientId) {
    const { data: byEmail } = await db
      .from("clients")
      .select("id")
      .ilike("email", input.email)
      .order("created_at", { ascending: true })
      .limit(1);
    clientId = byEmail?.[0]?.id ?? null;
  }

  // Si ya tiene una solicitud abierta no se duplica (se responde igual, sin reenviar correos).
  if (clientId) {
    const { data: open } = await db
      .from("visit_requests")
      .select("id, kind")
      .eq("client_id", clientId)
      .in("status", ["pendiente", "asignada"])
      .limit(1);
    if (open && open.length > 0) {
      // Ya tenía una solicitud gratis abierta y ahora pide programar: se convierte (el Master Chef recibe aviso).
      if (input.kind === "programada" && open[0].kind !== "programada") {
        await db.from("visit_requests").update({ kind: "programada", schedule_pref: input.schedulePref, expires_at: null }).eq("id", open[0].id);
        await notifyAdmins({
          negocio: input.name,
          ubicacion: [businessTypePhrase(type), input.city].filter(Boolean).join(" · "),
          contacto: input.contactName,
          baseUrl,
          isNewClient: false,
          kind: "programada",
          schedulePref: input.schedulePref,
          phone: input.phone,
        });
      }
      return { ok: true, duplicate: true, requestId: open[0].id as string };
    }
  }

  let isNewClient = false;
  if (!clientId) {
    const { data: created, error } = await db
      .from("clients")
      .insert({
        name: input.name,
        type,
        city: input.city,
        address: input.address,
        contact_name: input.contactName,
        phone: input.phone,
        instagram_handle: input.instagram,
        email: input.email,
        auto_email_enabled: true,
        has_website: false,
        has_google_business: false,
        has_professional_photos: false,
        has_reels: false,
        created_by: null,
        source: "web",
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message || "No se pudo crear el negocio" };
    clientId = created.id as string;
    isNewClient = true;
  }

  const expiresAt = new Date(Date.now() + EXPIRE_AFTER_DAYS * DAY_MS).toISOString();
  const { data: request, error: reqError } = await db
    .from("visit_requests")
    .insert({
      client_id: clientId,
      status: "pendiente",
      source: input.source,
      message: input.message,
      kind: input.kind,
      schedule_pref: input.kind === "programada" ? input.schedulePref : null,
      // La programada no vence sola: el Master Chef la acuerda en persona.
      expires_at: input.kind === "programada" ? null : expiresAt,
      ip_hash: input.ipHash,
    })
    .select("id")
    .single();
  if (reqError || !request) return { ok: false, error: reqError?.message || "No se pudo guardar la solicitud" };

  // Cuenta del negocio (solo si el correo no tiene ya una).
  let acceso: { link: string; code: string } | null = null;
  let tieneCuenta = Boolean(profile);
  if (!profile) {
    const { data: createdUser, error: userError } = await db.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
    });
    if (createdUser?.user && !userError) {
      await db.from("profiles").upsert({
        id: createdUser.user.id,
        email: input.email,
        full_name: input.contactName,
        role: "cliente",
        client_id: clientId,
      });
      const { token, code } = await issueAccessToken(db, {
        userId: createdUser.user.id,
        email: input.email,
        purpose: "invite",
      });
      acceso = { link: accessUrl(baseUrl, token), code };
      tieneCuenta = true;
      await db.from("clients").update({ account_invited_at: new Date().toISOString() }).eq("id", clientId);
    } else {
      console.error("solicitud: createUser", userError?.message);
    }
  }

  const ubicacion = [businessTypePhrase(type), input.city].filter(Boolean).join(" · ");

  // Correo de confirmación al negocio.
  const confirmation = await sendRequestReceivedEmail({
    to: input.email,
    negocio: input.name,
    contacto: input.contactName,
    datos: [
      `Negocio: ${input.name}`,
      `Tipo y ciudad: ${ubicacion}`,
      `Dirección: ${input.address}`,
      `Contacto: ${input.contactName}`,
      `Correo: ${input.email}`,
      input.phone ? `Teléfono / WhatsApp: ${input.phone}` : null,
      input.instagram ? `Instagram: @${input.instagram}` : null,
      input.kind === "programada" && input.schedulePref ? `Fecha y horario que prefieres: ${input.schedulePref}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    acceso,
    tieneCuenta,
    baseUrl,
    kind: input.kind,
    payUrl: input.kind === "programada" ? visitPayUrl(baseUrl, request.id as string) : null,
  });

  // Aviso al Master Chef.
  const adminOutcome = await notifyAdmins({
    negocio: input.name,
    ubicacion,
    contacto: input.contactName,
    baseUrl,
    isNewClient,
    kind: input.kind,
    schedulePref: input.schedulePref,
    phone: input.phone,
  });

  await db
    .from("visit_requests")
    .update({
      confirmation_sent_at: confirmation.status === "sent" ? new Date().toISOString() : null,
      admin_notified_at: adminOutcome === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", request.id);

  return { ok: true, requestId: request.id as string, duplicate: false };
}

async function sendRequestReceivedEmail(p: {
  to: string;
  negocio: string;
  contacto: string;
  datos: string;
  acceso: { link: string; code: string } | null;
  tieneCuenta: boolean;
  baseUrl: string;
  kind: RequestKind;
  /** Liga para pagar la visita programada (solo programada). */
  payUrl: string | null;
}): Promise<SendEmailOutcome> {
  const programada = p.kind === "programada";
  // La plantilla editable habla de la visita gratis: la programada usa siempre su propio texto.
  const automation = programada ? null : await getAutomation("solicitud_recibida");
  const useTemplate = Boolean(automation?.enabled && automation.subjectTemplate && automation.bodyTemplate);

  const linkAcceso = p.acceso ? p.acceso.link : `${p.baseUrl}/login`;
  const vars = { negocio: p.negocio, contacto: p.contacto, datos: p.datos, link_acceso: linkAcceso };

  const cuentaDefault = p.acceso
    ? `Ya generamos tu cuenta para que veas el avance de tu solicitud y, cuando termine la visita, tu reporte. Crea tu contraseña aquí (o continúa con Google desde la misma pantalla):\n${linkAcceso}`
    : p.tieneCuenta
      ? `Este correo ya tiene una cuenta en MysterFoodie: entra aquí para ver tu negocio:\n${linkAcceso}`
      : `Estamos terminando de preparar tu cuenta; te escribiremos en cuanto esté lista.`;

  const defaultSubject = programada ? `Recibimos tu solicitud para programar tu visita: ${p.negocio}` : `Tu negocio ya está en MysterFoodie: ${p.negocio}`;
  const defaultBody = programada
    ? `Hola ${p.contacto},\n\n` +
      `¡Gracias por querer programar tu visita! Tu negocio ${p.negocio} ya está en MysterFoodie y recibimos tu solicitud.\n\n` +
      `Estos son los datos que registramos:\n${p.datos}\n\n` +
      `Qué sigue: tu visita queda asegurada en cuanto se confirme el pago de $${FULL_REPORT_PRICE_MXN} MXN (más el consumo de la visita). Si necesitas factura, el total con IVA es $${FULL_REPORT_PRICE_WITH_IVA_MXN} MXN: respóndenos con tus datos fiscales. ` +
      `Si aún no pagas o se interrumpió, puedes hacerlo cuando quieras con Mercado Pago: ${p.payUrl ?? ""}\n\n` +
      `Con tu pago confirmado, la visita queda programada y la realiza un MysterFoodie en exclusiva para tu negocio; el Master Chef te escribirá por WhatsApp o correo para confirmar el día y acordar el consumo. ` +
      `La visita es anónima: el MysterFoodie llegará como un cliente más.\n\n` +
      `${cuentaDefault}\n\n` +
      `Saludos,\nMysterFoodie`
    : `Hola ${p.contacto},\n\n` +
      `¡Gracias por pedir tu visita gratis! Tu negocio ${p.negocio} ha sido dado de alta y tu solicitud ha sido enviada.\n\n` +
      `Estos son los datos que registramos:\n${p.datos}\n\n` +
      `Qué sigue: asignaremos tu visita a uno de nuestros MysterFoodies, según su disponibilidad (no podemos garantizar que se pueda realizar). ` +
      `Es una visita anónima, así que no te avisaremos el día ni la hora. ` +
      `Cuando termine, recibirás por correo el resultado de tu visita.\n\n` +
      `${cuentaDefault}\n\n` +
      `Saludos,\nMysterFoodie`;

  const subject = useTemplate ? renderTemplate(automation!.subjectTemplate, vars) : defaultSubject;
  let bodyText = useTemplate ? renderTemplate(automation!.bodyTemplate, vars) : defaultBody;
  if (p.acceso) {
    bodyText += `\n\nSi el botón no abre, entra a ${p.baseUrl}/set-password, escribe tu correo y este código de 6 dígitos: ${p.acceso.code
      .split("")
      .join(" ")} (vale ${ACCESS_TTL_DAYS} días).`;
  }
  return sendTemplatedEmail({ to: p.to, subject, bodyText, ctaLabel: p.acceso ? "Crear mi cuenta" : "Entrar a mi cuenta", glosario: GLOSARIO_NEGOCIO });
}

/** Avisa a los admins (Master Chef) que llegó una solicitud nueva. Devuelve "sent" si salió al menos un correo. */
async function notifyAdmins(p: {
  negocio: string;
  ubicacion: string;
  contacto: string;
  baseUrl: string;
  isNewClient: boolean;
  kind: RequestKind;
  schedulePref: string | null;
  phone: string | null;
}): Promise<"sent" | "failed"> {
  const db = getSupabaseServiceClient();
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  let sent = false;
  for (const a of admins || []) {
    const programada = p.kind === "programada";
    const out = await sendTemplatedEmail({
      to: a.email as string,
      subject: programada ? `Visita PROGRAMADA solicitada: ${p.negocio}` : `Nueva solicitud de visita gratis: ${p.negocio}`,
      bodyText: programada
        ? `Un negocio programó su visita ($${FULL_REPORT_PRICE_MXN} + consumo) y está pasando a pagar en línea con Mercado Pago. Es prioridad: cuando se confirme el pago te llega otro correo; si no paga, escríbele para cerrarla.\n\n` +
          `Negocio: ${p.negocio}\nUbicación: ${p.ubicacion}\nContacto: ${p.contacto}\n` +
          `${p.phone ? `WhatsApp / teléfono: ${p.phone}\n` : ""}` +
          `${p.schedulePref ? `Fecha y horario que pidió: ${p.schedulePref}\n` : ""}` +
          `${p.isNewClient ? "El negocio se dio de alta solo." : "El negocio ya existía."}\n\n` +
          `Cuando lo acuerdes, asígnala a un sibarita, un Shopper o a ti desde aquí:\n${p.baseUrl}/solicitudes`
        : `Llegó una solicitud de visita gratis desde la web.\n\n` +
          `Negocio: ${p.negocio}\nUbicación: ${p.ubicacion}\nContacto: ${p.contacto}\n` +
          `${p.isNewClient ? "El negocio se dio de alta solo." : "El negocio ya existía."}\n\n` +
          `Asígnala a un sibarita, un Shopper o a ti desde aquí (si en ${ALERT_AFTER_HOURS} h nadie la asigna, te avisamos otra vez):\n${p.baseUrl}/solicitudes`,
      ctaLabel: programada ? "Ver la solicitud" : "Asignar la visita",
    });
    if (out.status === "sent") sent = true;
  }
  return sent ? "sent" : "failed";
}

// ---------------------------------------------------------------------------
// Pago en línea de la visita programada
// ---------------------------------------------------------------------------

/** Liga que lleva a Mercado Pago a pagar una visita programada (la crea la preferencia al abrirla). */
export const visitPayUrl = (baseUrl: string, requestId: string) => `${baseUrl}/api/pagar-visita?id=${requestId}`;

/**
 * Mercado Pago avisó de un pago con external_reference "visita:<id>". Marca la solicitud como pagada (una sola vez),
 * le avisa al negocio que su visita quedó asegurada y al Master Chef que ya puede coordinar fecha y consumo.
 */
export async function settleVisitPayment(
  db: Db,
  requestId: string,
  payment: { id: string | number; status?: string | null; transaction_amount?: number | null }
): Promise<void> {
  const { data: request } = await db.from("visit_requests").select("id, client_id, kind, paid_at, schedule_pref").eq("id", requestId).maybeSingle();
  if (!request || payment.status !== "approved" || request.paid_at) return;
  const { data: updated, error } = await db
    .from("visit_requests")
    .update({ paid_at: new Date().toISOString(), payment_id: String(payment.id), payment_amount: payment.transaction_amount ?? null })
    .eq("id", requestId)
    .is("paid_at", null)
    .select("id");
  if (error) {
    console.error("No se pudo marcar la visita como pagada:", error.message);
    return;
  }
  if (!updated || updated.length === 0) return; // otro aviso del mismo pago ya la marcó

  const { data: client } = await db.from("clients").select("name, type, city, contact_name, email, phone").eq("id", request.client_id as string).maybeSingle();
  const baseUrl = baseUrlOf();
  const negocio = (client?.name as string) ?? "Negocio";
  if (client?.email) {
    await sendTemplatedEmail({
      to: client.email as string,
      subject: `Pago recibido: tu visita está asegurada (${negocio})`,
      bodyText:
        `Hola ${(client.contact_name as string) || ""},\n\n`.replace("Hola ,", "Hola,") +
        `¡Recibimos tu pago! La visita a ${negocio} queda asegurada y programada: la realizará un MysterFoodie en exclusiva para tu negocio.\n\n` +
        `${request.schedule_pref ? `Fecha y horario que pediste: ${request.schedule_pref}.\n` : ""}` +
        `El Master Chef te escribirá por WhatsApp o correo para confirmar el día y acordar el consumo de la visita. ` +
        `Es una visita anónima: el MysterFoodie llegará como un cliente más. Cuando termine, recibirás tu reporte completo.\n\n` +
        `Saludos,\nMysterFoodie`,
      glosario: GLOSARIO_NEGOCIO,
    }).catch(() => undefined);
  }
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  for (const a of admins || []) {
    await sendTemplatedEmail({
      to: a.email as string,
      subject: `Visita programada PAGADA: ${negocio}`,
      bodyText:
        `${negocio} pagó su visita programada ($${payment.transaction_amount ?? FULL_REPORT_PRICE_MXN} MXN, Mercado Pago). Ya está asegurada: coordina fecha y consumo con el negocio y asígnala.\n\n` +
        `${client?.phone ? `WhatsApp / teléfono: ${client.phone}\n` : ""}${request.schedule_pref ? `Fecha y horario que pidió: ${request.schedule_pref}\n` : ""}\n` +
        `Asígnala aquí:\n${baseUrl}/solicitudes`,
      ctaLabel: "Asignar la visita",
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Asignar / tomar
// ---------------------------------------------------------------------------

export type AssignResult = { ok: true; email: SendEmailOutcome } | { ok: false; error: string; status: number };

/** Asigna (o reasigna) una solicitud a un admin, Shopper o sibarita y arranca el reloj de 3 + 2 días. */
export async function assignVisitRequest(
  db: Db,
  p: { requestId: string; assigneeId: string; assignedBy: string; baseUrl: string }
): Promise<AssignResult> {
  const { data: request } = await db
    .from("visit_requests")
    .select("id, client_id, status, assignment_id, kind, schedule_pref")
    .eq("id", p.requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Solicitud no encontrada", status: 404 };
  if (request.status === "completada") return { ok: false, error: "Esa visita ya se realizó", status: 400 };

  const { data: assignee } = await db
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", p.assigneeId)
    .maybeSingle();
  if (!assignee || !["admin", "agente", "sibarita"].includes(assignee.role as string)) {
    return { ok: false, error: "Solo puedes asignar a un sibarita, un Shopper o a ti mismo", status: 400 };
  }

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, city")
    .eq("id", request.client_id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Negocio no encontrado", status: 404 };

  const programada = request.kind === "programada";
  const note = programada
    ? `Visita PROGRAMADA acordada por el Master Chef con el negocio${request.schedule_pref ? ` (pidió: ${request.schedule_pref})` : ""}. Haz la visita en la fecha acordada.`
    : `Solicitud de visita gratis desde la web. Tienes ${OPEN_AFTER_DAYS} días para hacerla; después se abre a los demás Shoppers.`;

  // Si ya había una asignación pendiente se reutiliza (cambia de persona); si no, se crea una.
  let assignmentId: string | null = null;
  if (request.assignment_id) {
    const { data: prev } = await db
      .from("visit_assignments")
      .select("id, status")
      .eq("id", request.assignment_id)
      .maybeSingle();
    if (prev && prev.status === "pendiente") {
      const { error } = await db
        .from("visit_assignments")
        .update({ assigned_to: assignee.id, assigned_by: p.assignedBy, note, notified_at: null })
        .eq("id", prev.id);
      if (error) return { ok: false, error: error.message, status: 500 };
      assignmentId = prev.id as string;
    }
  }
  if (!assignmentId) {
    const { data: created, error } = await db
      .from("visit_assignments")
      .insert({ client_id: client.id, assigned_to: assignee.id, assigned_by: p.assignedBy, note })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message || "No se pudo crear la asignación", status: 500 };
    assignmentId = created.id as string;
  }

  const now = Date.now();
  const { error: updError } = await db
    .from("visit_requests")
    .update({
      status: "asignada",
      assignment_id: assignmentId,
      assigned_to: assignee.id,
      assigned_at: new Date(now).toISOString(),
      // La programada no se abre a la bolsa ni vence sola; la gratis corre 3 + 2 días.
      open_at: programada ? null : new Date(now + OPEN_AFTER_DAYS * DAY_MS).toISOString(),
      expires_at: programada ? null : new Date(now + EXPIRE_AFTER_DAYS * DAY_MS).toISOString(),
      decision: "visita",
    })
    .eq("id", request.id);
  if (updError) return { ok: false, error: updError.message, status: 500 };

  const email = await sendAssignmentEmail(db, {
    assignmentId,
    client: { name: client.name, type: client.type, city: client.city },
    foodie: { email: assignee.email, full_name: assignee.full_name },
    note,
    baseUrl: p.baseUrl,
    linkVisitas: `${p.baseUrl}/nueva-visita/${assignmentId}`,
    // A un sibarita o Shopper se le explica cuánto podría ganar (lo asigne el Master Chef o la tome de la bolsa).
    callout:
      assignee.role === "sibarita"
        ? sibaritaEarningsCallout(programada ? "programada" : "gratis")
        : assignee.role === "agente"
          ? shopperEarningsCallout(programada ? "programada" : "gratis")
          : undefined,
  });
  return { ok: true, email };
}

/** Un Shopper toma una solicitud que ya está en la bolsa abierta (días 4 y 5). */
export async function takeVisitRequest(
  db: Db,
  p: { requestId: string; foodieId: string; baseUrl: string }
): Promise<AssignResult> {
  const { data: request } = await db
    .from("visit_requests")
    .select("id, client_id, status, assignment_id, assigned_to, open_at, expires_at, kind, created_at")
    .eq("id", p.requestId)
    .maybeSingle();
  if (request && request.status === "pendiente") return takeUnassignedRequest(db, p, request);
  if (!request || request.status !== "asignada" || !request.assignment_id) {
    return { ok: false, error: "Esta visita ya no está disponible", status: 409 };
  }
  const now = Date.now();
  if (!request.open_at || !request.expires_at || now < new Date(request.open_at).getTime() || now >= new Date(request.expires_at).getTime()) {
    return { ok: false, error: "Esta visita ya no está disponible", status: 409 };
  }
  if (request.assigned_to === p.foodieId) {
    return { ok: false, error: "Esta visita ya es tuya", status: 400 };
  }

  const { data: foodie } = await db.from("profiles").select("id, email, full_name, role").eq("id", p.foodieId).maybeSingle();
  if (!foodie || foodie.role !== "agente") return { ok: false, error: "Solo los Shoppers pueden tomar visitas", status: 403 };

  // Condicional: solo se toma si la asignación sigue pendiente y con la misma persona (quien llegue primero).
  const { data: taken } = await db
    .from("visit_assignments")
    .update({ assigned_to: foodie.id, notified_at: null })
    .eq("id", request.assignment_id)
    .eq("status", "pendiente")
    .eq("assigned_to", request.assigned_to)
    .select("id");
  if (!taken || taken.length === 0) return { ok: false, error: "Alguien más ya tomó esta visita", status: 409 };

  await db.from("visit_requests").update({ assigned_to: foodie.id }).eq("id", request.id);

  const { data: client } = await db.from("clients").select("name, type, city").eq("id", request.client_id).maybeSingle();
  const email = await sendAssignmentEmail(db, {
    assignmentId: request.assignment_id as string,
    client: { name: client?.name ?? "Negocio", type: client?.type ?? null, city: client?.city ?? null },
    foodie: { email: foodie.email, full_name: foodie.full_name },
    note: "Tomaste esta visita gratis de la bolsa de Shoppers.",
    callout: shopperEarningsCallout("gratis"),
    baseUrl: p.baseUrl,
    linkVisitas: `${p.baseUrl}/nueva-visita/${request.assignment_id}`,
  });
  return { ok: true, email };
}

/**
 * Un sibarita (desde +3 h) o un Shopper (desde +5 h) toma una solicitud GRATIS que nadie ha asignado.
 * Quien llegue primero se la queda: el primer paso es un cambio condicional (pendiente -> asignada).
 */
async function takeUnassignedRequest(
  db: Db,
  p: { requestId: string; foodieId: string; baseUrl: string },
  request: { id: unknown; kind: unknown; created_at: unknown }
): Promise<AssignResult> {
  const { data: foodie } = await db.from("profiles").select("id, role").eq("id", p.foodieId).maybeSingle();
  const role = foodie?.role as string | undefined;
  if (role !== "sibarita" && role !== "agente") {
    return { ok: false, error: "Solo los sibaritas y los Shoppers pueden tomar visitas", status: 403 };
  }
  if (request.kind === "programada") {
    return { ok: false, error: "Esta visita la acuerda el Master Chef", status: 409 };
  }
  const needed = role === "sibarita" ? SIBARITAS_AFTER_HOURS : SHOPPERS_AFTER_HOURS;
  if (businessHoursSince(request.created_at as string) < needed) return { ok: false, error: "Esta visita todavía no está disponible para ti", status: 409 };

  const { data: claimed } = await db
    .from("visit_requests")
    .update({ status: "asignada", assigned_to: p.foodieId, assigned_at: new Date().toISOString() })
    .eq("id", p.requestId)
    .eq("status", "pendiente")
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, error: "Alguien más ya tomó esta visita", status: 409 };

  const out = await assignVisitRequest(db, { requestId: p.requestId, assigneeId: p.foodieId, assignedBy: p.foodieId, baseUrl: p.baseUrl });
  if (!out.ok) {
    await db.from("visit_requests").update({ status: "pendiente", assigned_to: null, assigned_at: null }).eq("id", p.requestId);
  }
  return out;
}

/**
 * El Master Chef decide NO hacer la visita gratis: se avisa al negocio que el volumen de solicitudes es más alto
 * de lo normal para nuestros MysterFoodies y se le muestran los paquetes (mismo correo que el de vencimiento).
 */
export async function declineForHighDemand(
  db: Db,
  requestId: string
): Promise<{ ok: true; email: string } | { ok: false; error: string; status: number }> {
  const { data: r } = await db
    .from("visit_requests")
    .select("id, client_id, status, nofoodie_email_sent_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!r) return { ok: false, error: "Solicitud no encontrada", status: 404 };
  if (r.status !== "pendiente") return { ok: false, error: "Solo se puede avisar en solicitudes por asignar", status: 409 };
  const { data: changed } = await db
    .from("visit_requests")
    .update({ status: "sin_foodie", decision: "alta_demanda" })
    .eq("id", requestId)
    .eq("status", "pendiente")
    .select("id");
  if (!changed || changed.length === 0) return { ok: false, error: "Esa solicitud ya cambió de estado", status: 409 };
  let email = "ya_enviado";
  if (!r.nofoodie_email_sent_at) {
    email = await sendNoFoodieEmail(db, r.client_id as string);
    if (email === "sent") await db.from("visit_requests").update({ nofoodie_email_sent_at: new Date().toISOString() }).eq("id", requestId);
  }
  return { ok: true, email };
}

/**
 * ¿Esta visita (forms) es la que se hizo por una solicitud del negocio (gratis o programada)? Si sí, el reporte
 * NO se vende a $850 sin consumo: el negocio ve el resumen y la opción de programar su visita o ver paquetes.
 * Solo las personas visitadas por un MysterFoodie SIN haber solicitado pueden comprar el reporte directo.
 */
export async function isRequestedVisit(db: Db, form: { id: string; client_id: string | null; created_at: string }): Promise<boolean> {
  if (!form.client_id) return false;
  const { data: reqs } = await db
    .from("visit_requests")
    .select("created_at")
    .eq("client_id", form.client_id)
    .lte("created_at", form.created_at)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!reqs || reqs.length === 0) return false;
  const { data: first } = await db
    .from("forms")
    .select("id")
    .eq("client_id", form.client_id)
    .gte("created_at", reqs[0].created_at as string)
    .order("created_at", { ascending: true })
    .limit(1);
  return first?.[0]?.id === form.id;
}

// ---------------------------------------------------------------------------
// Sincronización: visitas hechas y solicitudes vencidas
// ---------------------------------------------------------------------------

export type SyncResult = { completed: number; expired: number; emailed: number; alerted: number; offered: number };

type Escalation = { alert: string[]; sibaritas: string[]; shoppers: string[] };

/**
 * 1) Marca como completadas las solicitudes cuyo negocio ya tiene una visita posterior a la solicitud
 *    (la haya hecho quien la tenía asignada, otro Shopper o el Master Chef).
 * 2) Las que llegaron a expires_at sin visita pasan a "sin_foodie" y el negocio recibe el correo
 *    "Por el momento no contamos con un MysterFoodie" (una sola vez).
 * 3) Escalamiento de las que siguen sin asignar: +2 h aviso al Master Chef, +3 h se ofrecen a los sibaritas,
 *    +5 h también a los Shoppers (cada paso se hace una sola vez).
 * La corre el cron (cada 10 min) y también se ejecuta al abrir /solicitudes.
 */
export async function syncVisitRequests(db: Db): Promise<SyncResult> {
  const result: SyncResult = { completed: 0, expired: 0, emailed: 0, alerted: 0, offered: 0 };
  const { data: open } = await db
    .from("visit_requests")
    .select(
      "id, client_id, status, kind, created_at, assignment_id, expires_at, nofoodie_email_sent_at, unassigned_alert_at, pool_sibaritas_notified_at, pool_shoppers_notified_at"
    )
    .in("status", ["pendiente", "asignada", "sin_foodie"]);
  if (!open || open.length === 0) return result;

  const nowIso = new Date().toISOString();
  const esc: Escalation = { alert: [], sibaritas: [], shoppers: [] };

  for (const r of open) {
    const { data: form } = await db
      .from("forms")
      .select("id, created_at")
      .eq("client_id", r.client_id)
      .gte("created_at", r.created_at as string)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (form) {
      await db.from("visit_requests").update({ status: "completada", completed_at: nowIso }).eq("id", r.id);
      if (r.assignment_id) {
        await db
          .from("visit_assignments")
          .update({ status: "completada", completed_form_id: form.id })
          .eq("id", r.assignment_id)
          .eq("status", "pendiente");
      }
      result.completed += 1;
      continue;
    }

    const vencida = r.expires_at && new Date(r.expires_at as string).getTime() <= Date.now();
    if (vencida && (r.status === "pendiente" || r.status === "asignada")) {
      await db.from("visit_requests").update({ status: "sin_foodie" }).eq("id", r.id);
      result.expired += 1;
      if (!r.nofoodie_email_sent_at) {
        const outcome = await sendNoFoodieEmail(db, r.client_id as string);
        if (outcome === "sent") {
          await db.from("visit_requests").update({ nofoodie_email_sent_at: nowIso }).eq("id", r.id);
          result.emailed += 1;
        }
      }
    } else if (r.status === "pendiente") {
      const age = businessHoursSince(r.created_at as string);
      if (age >= ALERT_AFTER_HOURS && !r.unassigned_alert_at) esc.alert.push(r.id as string);
      if (r.kind !== "programada") {
        if (age >= SIBARITAS_AFTER_HOURS && !r.pool_sibaritas_notified_at) esc.sibaritas.push(r.id as string);
        if (age >= SHOPPERS_AFTER_HOURS && !r.pool_shoppers_notified_at) esc.shoppers.push(r.id as string);
      }
    }
  }

  await escalateUnassigned(db, esc, result).catch((err) => console.error("solicitudes: escalamiento", err instanceof Error ? err.message : err));
  return result;
}

const typeLine = (type: string | null, city: string | null) => [businessTypePhrase(type ?? "otro"), city].filter(Boolean).join(" · ");

/** Manda los avisos de escalamiento (una sola vez por solicitud y paso). */
async function escalateUnassigned(db: Db, esc: Escalation, result: SyncResult): Promise<void> {
  // Los avisos solo salen de 8:00 a 20:00 (CDMX); lo pendiente sale en la primera corrida de la mañana.
  if (!inNotificationWindow()) return;
  const ids = [...new Set([...esc.alert, ...esc.sibaritas, ...esc.shoppers])];
  if (ids.length === 0) return;
  const { data: reqs } = await db.from("visit_requests").select("id, status, kind, schedule_pref, client_id").in("id", ids);
  const live = (reqs || []).filter((r) => r.status === "pendiente");
  if (live.length === 0) return;
  const { data: clients } = await db
    .from("clients")
    .select("id, name, type, city")
    .in("id", [...new Set(live.map((r) => r.client_id as string))]);
  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  const infoOf = (id: string) => {
    const r = live.find((x) => x.id === id);
    if (!r) return null;
    const c = clientById.get(r.client_id as string);
    return { name: (c?.name as string) ?? "Negocio", where: typeLine((c?.type as string) ?? null, (c?.city as string) ?? null), kind: r.kind as RequestKind, pref: r.schedule_pref as string | null };
  };
  const baseUrl = baseUrlOf();
  const stamp = new Date().toISOString();
  const mark = async (column: string, list: string[]) => {
    if (list.length) await db.from("visit_requests").update({ [column]: stamp }).in("id", list);
  };

  // 1) Master Chef: "Tienes nuevas visitas no asignadas"
  const alertIds = esc.alert.filter((id) => infoOf(id));
  if (alertIds.length > 0) {
    const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
    const items = alertIds.map((id) => infoOf(id)!);
    const hayProgramada = items.some((i) => i.kind === "programada");
    const hayGratis = items.some((i) => i.kind !== "programada");
    const lis = items
      .map(
        (i) =>
          `<li style="margin: 0 0 8px;"><strong>${escapeHtml(i.name)}</strong>${i.where ? ` · ${escapeHtml(i.where)}` : ""}${
            i.kind === "programada" ? ` <span style="color: #f24444; font-weight: bold;">· visita programada</span>${i.pref ? ` (pidió: ${escapeHtml(i.pref)})` : ""}` : ""
          }</li>`
      )
      .join("");
    const pie = [
      hayGratis ? `Si no las asignas en ${SIBARITAS_AFTER_HOURS - ALERT_AFTER_HOURS} hora más, se ofrecerán automáticamente a los sibaritas; si nadie las acepta en ${SHOPPERS_AFTER_HOURS - SIBARITAS_AFTER_HOURS} horas, a los Shoppers.` : "",
      hayProgramada ? "Las visitas programadas no se ofrecen solas: necesitan que tú acuerdes fecha, pago y consumo con el negocio." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const html = renderEmailShell(`
      <div style="width: 68px; height: 68px; line-height: 68px; margin: 0 auto 18px; border-radius: 34px; background-color: #fff1f0; color: #f24444; font-size: 38px; font-weight: bold; text-align: center;">?</div>
      <h2 style="margin: 0 0 14px; font-size: 24px; line-height: 1.25; color: #111827; text-align: center;">Tienes nuevas visitas no asignadas</h2>
      <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #374151;">Estas solicitudes llevan más de ${ALERT_AFTER_HOURS} horas (en horario de 8 am a 8 pm) esperando que alguien las tome:</p>
      <ul style="margin: 0 0 18px; padding-left: 20px; font-size: 15px; line-height: 1.55; color: #374151;">${lis}</ul>
      <div style="margin: 0 0 16px;">${renderButton(`${baseUrl}/solicitudes`, "Ir a asignar las visitas")}</div>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">${escapeHtml(pie)}</p>
    `);
    const text =
      `Tienes nuevas visitas no asignadas\n\n` +
      items.map((i) => `- ${i.name}${i.where ? ` · ${i.where}` : ""}${i.kind === "programada" ? " (visita programada)" : ""}`).join("\n") +
      `\n\nAsígnalas aquí: ${baseUrl}/solicitudes\n\n${pie}`;
    let sent = 0;
    for (const a of admins || []) {
      const out = await sendHtmlEmail({ to: a.email as string, subject: "Tienes nuevas visitas no asignadas", html, text });
      if (out.status === "sent") sent += 1;
    }
    if (sent > 0 || (admins || []).length === 0) {
      await mark("unassigned_alert_at", alertIds);
      result.alerted += alertIds.length;
    }
  }

  // 2) y 3) Se ofrecen a sibaritas y, más tarde, a Shoppers.
  const offer = async (role: "sibarita" | "agente", list: string[], column: string, intro: string) => {
    const mine = list.filter((id) => infoOf(id));
    if (mine.length === 0) return;
    const { data: people } = await db.from("profiles").select("email").eq("role", role).not("email", "is", null);
    const items = mine.map((id) => infoOf(id)!);
    const lista = items.map((i) => `- ${i.name}${i.where ? ` · ${i.where}` : ""}`).join("\n");
    let sent = 0;
    for (const person of people || []) {
      const out = await sendTemplatedEmail({
        to: person.email as string,
        subject: items.length === 1 ? `Visita gratis disponible: ${items[0].name}` : `${items.length} visitas gratis disponibles`,
        bodyText: `${intro}\n\n${lista}\n\nQuien la tome primero se la queda. Tómala desde la app:\n${baseUrl}/nueva-visita`,
        ctaLabel: "Ver las visitas disponibles",
        callout: role === "sibarita" ? sibaritaEarningsCallout("gratis") : shopperEarningsCallout("gratis"),
      });
      if (out.status === "sent") sent += 1;
    }
    if (sent > 0 || (people || []).length === 0) {
      await mark(column, mine);
      result.offered += mine.length;
    }
  };
  await offer(
    "sibarita",
    esc.sibaritas,
    "pool_sibaritas_notified_at",
    "Hay una visita gratis por hacer que todavía no tiene MysterFoodie. Te la ofrecemos primero a los sibaritas:"
  );
  await offer(
    "agente",
    esc.shoppers,
    "pool_shoppers_notified_at",
    "Hay una visita gratis por hacer que ningún sibarita tomó. Ahora se abre a los Shoppers:"
  );
}

async function sendNoFoodieEmail(db: Db, clientId: string): Promise<string> {
  const { data: client } = await db
    .from("clients")
    .select("name, email, contact_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.email) return "no_email";

  const automation = await getAutomation("solicitud_sin_foodie");
  const useTemplate = Boolean(automation?.enabled && automation.subjectTemplate && automation.bodyTemplate);
  const contacto = (client.contact_name as string | null) || `equipo de ${client.name}`;
  const vars = { negocio: client.name as string, contacto, link_paquetes: PACKAGES_URL };

  const defaultSubject = `Sobre tu solicitud de visita en MysterFoodie`;
  const defaultBody =
    `Hola ${contacto},\n\n` +
    `Por el momento y dado el alto volumen de solicitudes, no contamos con un MysterFoodie para tu visita a ${client.name}.\n\n` +
    `Puedes agendar paquetes de visitas con nosotros aquí, donde también encuentras la tabla comparativa de paquetes:\n${PACKAGES_URL}\n\n` +
    `Gracias por tu interés,\nMysterFoodie`;

  const subject = useTemplate ? renderTemplate(automation!.subjectTemplate, vars) : defaultSubject;
  const bodyText = useTemplate ? renderTemplate(automation!.bodyTemplate, vars) : defaultBody;
  const out = await sendTemplatedEmail({
    to: client.email as string,
    subject,
    bodyText,
    ctaLabel: "Ver la tabla comparativa de paquetes",
    glosario: GLOSARIO_NEGOCIO,
  });
  return out.status;
}

// ---------------------------------------------------------------------------
// Consultas para las pantallas
// ---------------------------------------------------------------------------

export type SolicitudRow = {
  id: string;
  status: RequestStatus;
  createdAt: string;
  message: string | null;
  source: string | null;
  clientId: string;
  clientName: string;
  clientType: string;
  city: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  assignmentId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  openAt: string | null;
  expiresAt: string | null;
  /** La bolsa de Shoppers ya está abierta (días 4 y 5) para esta solicitud. */
  inOpenPool: boolean;
  kind: RequestKind;
  /** Fecha y horario que pidió el negocio (solo programada). */
  schedulePref: string | null;
  decision: "visita" | "alta_demanda" | null;
  /** Cuándo pagó la visita programada en línea (null = sin pagar). */
  paidAt: string | null;
  /** Solo en pendientes gratis: quién la puede tomar ahora (según las horas sin asignar). */
  stage: "master" | "sibaritas" | "shoppers" | null;
};

export type Assignee = { id: string; name: string; role: "admin" | "agente" | "sibarita"; pendingCount: number };

/** Todas las solicitudes, las abiertas primero (para /solicitudes). */
export async function getSolicitudes(db: Db): Promise<SolicitudRow[]> {
  const { data: rows } = await db
    .from("visit_requests")
    .select("id, status, created_at, message, source, client_id, assignment_id, assigned_to, assigned_at, open_at, expires_at, kind, schedule_pref, decision, paid_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!rows || rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.client_id as string))];
  const assigneeIds = [...new Set(rows.map((r) => r.assigned_to as string | null).filter(Boolean) as string[])];
  const [{ data: clients }, { data: people }] = await Promise.all([
    db.from("clients").select("id, name, type, city, address, contact_name, email, phone, instagram_handle").in("id", clientIds),
    assigneeIds.length
      ? db.from("profiles").select("id, full_name, email").in("id", assigneeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);
  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  const personById = new Map((people || []).map((p) => [p.id as string, p]));
  const now = Date.now();

  const rank: Record<string, number> = { pendiente: 0, asignada: 1, sin_foodie: 2, completada: 3 };
  return rows
    .map((r) => {
      const c = clientById.get(r.client_id as string);
      const person = r.assigned_to ? personById.get(r.assigned_to as string) : null;
      const openAt = r.open_at as string | null;
      const expiresAt = r.expires_at as string | null;
      return {
        id: r.id as string,
        status: r.status as RequestStatus,
        createdAt: r.created_at as string,
        message: (r.message as string | null) ?? null,
        source: (r.source as string | null) ?? null,
        clientId: r.client_id as string,
        clientName: (c?.name as string) ?? "Negocio",
        clientType: (c?.type as string) ?? "restaurante",
        city: (c?.city as string | null) ?? null,
        address: (c?.address as string | null) ?? null,
        contactName: (c?.contact_name as string | null) ?? null,
        email: (c?.email as string | null) ?? null,
        phone: (c?.phone as string | null) ?? null,
        instagram: (c?.instagram_handle as string | null) ?? null,
        assignmentId: (r.assignment_id as string | null) ?? null,
        assignedTo: (r.assigned_to as string | null) ?? null,
        assignedToName: person ? person.full_name || person.email || "Sin nombre" : null,
        assignedAt: (r.assigned_at as string | null) ?? null,
        openAt,
        expiresAt,
        inOpenPool:
          r.status === "asignada" && !!openAt && !!expiresAt && now >= new Date(openAt).getTime() && now < new Date(expiresAt).getTime(),
        kind: ((r.kind as string | null) === "programada" ? "programada" : "gratis") as RequestKind,
        schedulePref: (r.schedule_pref as string | null) ?? null,
        decision: ((r.decision as string | null) ?? null) as SolicitudRow["decision"],
        paidAt: (r.paid_at as string | null) ?? null,
        stage:
          r.status === "pendiente" && (r.kind as string | null) !== "programada"
            ? (() => {
                const age = businessHoursSince(r.created_at as string, now);
                return age >= SHOPPERS_AFTER_HOURS ? "shoppers" : age >= SIBARITAS_AFTER_HOURS ? "sibaritas" : "master";
              })()
            : null,
      } satisfies SolicitudRow;
    })
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.status === "pendiente" ? Number(b.kind === "programada") - Number(a.kind === "programada") : 0) ||
        b.createdAt.localeCompare(a.createdAt)
    );
}

/** Personas a quienes el Master Chef puede asignar: él, sibaritas y Shoppers. */
export async function getAssignees(db: Db): Promise<Assignee[]> {
  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["admin", "agente", "sibarita"])
    .order("full_name");
  const ids = (people || []).map((p) => p.id as string);
  const pending = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await db.from("visit_assignments").select("assigned_to").eq("status", "pendiente").in("assigned_to", ids);
    for (const r of rows || []) pending.set(r.assigned_to as string, (pending.get(r.assigned_to as string) ?? 0) + 1);
  }
  return (people || []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string | null) || (p.email as string | null) || "Sin nombre",
    role: p.role as Assignee["role"],
    pendingCount: pending.get(p.id as string) ?? 0,
  }));
}

export type OpenPoolItem = {
  requestId: string;
  clientName: string;
  clientType: string;
  city: string | null;
  expiresAt: string;
  /** sin_asignar = nadie la tomó (se ofrece a sibaritas/Shoppers); vencimiento = días 4 y 5 de una ya asignada. */
  origin: "sin_asignar" | "vencimiento";
};

/**
 * Solicitudes gratis que esta persona puede tomar ahora (excluye las suyas y las programadas):
 *  - Shopper: las de los días 4 y 5 de una asignación + las sin asignar con 5 h o más.
 *  - Sibarita: las sin asignar con 3 h o más.
 */
export async function getOpenPoolFor(db: Db, userId: string, role: "agente" | "sibarita" = "agente"): Promise<OpenPoolItem[]> {
  const nowIso = new Date().toISOString();
  type Row = { id: string; client_id: string; assigned_to: string | null; expires_at: string; origin: OpenPoolItem["origin"] };
  const rows: Row[] = [];

  if (role === "agente") {
    const { data } = await db
      .from("visit_requests")
      .select("id, client_id, assigned_to, expires_at")
      .eq("status", "asignada")
      .lte("open_at", nowIso)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: true });
    for (const r of data || []) rows.push({ ...(r as Omit<Row, "origin">), origin: "vencimiento" });
  }

  const hours = role === "sibarita" ? SIBARITAS_AFTER_HOURS : SHOPPERS_AFTER_HOURS;
  const { data: sin } = await db
    .from("visit_requests")
    .select("id, client_id, assigned_to, expires_at, created_at")
    .eq("status", "pendiente")
    .neq("kind", "programada")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true });
  for (const r of sin || []) {
    if (businessHoursSince(r.created_at as string) < hours) continue;
    rows.push({ id: r.id as string, client_id: r.client_id as string, assigned_to: (r.assigned_to as string | null) ?? null, expires_at: r.expires_at as string, origin: "sin_asignar" });
  }

  const mine = rows.filter((r) => r.assigned_to !== userId);
  if (mine.length === 0) return [];
  const { data: clients } = await db
    .from("clients")
    .select("id, name, type, city")
    .in("id", mine.map((r) => r.client_id));
  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  return mine
    .map((r) => {
      const c = clientById.get(r.client_id);
      if (!c) return null;
      return {
        requestId: r.id,
        clientName: c.name as string,
        clientType: c.type as string,
        city: (c.city as string | null) ?? null,
        expiresAt: r.expires_at,
        origin: r.origin,
      };
    })
    .filter(Boolean) as OpenPoolItem[];
}

/** Cuántas solicitudes esperan asignación (para el aviso del Master Chef). */
export async function countPendingRequests(db: Db): Promise<number> {
  const { count } = await db.from("visit_requests").select("id", { count: "exact", head: true }).in("status", ["pendiente", "sin_foodie"]);
  return count ?? 0;
}
