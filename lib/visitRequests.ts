import { getSupabaseServiceClient } from "./supabase";
import { BUSINESS_TYPES, businessTypePhrase } from "./categories";
import { sendTemplatedEmail, type SendEmailOutcome } from "./email";
import { getAutomation, renderTemplate } from "./automations";
import { ACCESS_TTL_DAYS, accessUrl, issueAccessToken } from "./accessTokens";
import { sendAssignmentEmail } from "./assignments";

type Db = ReturnType<typeof getSupabaseServiceClient>;

/**
 * "Solicita una visita GRATIS" (mysterfoodie.com).
 *
 * Una persona llena el formulario público -> el negocio se da de alta (clients, source="web"),
 * se le crea su cuenta y recibe un correo con sus datos y el acceso; el Master Chef recibe aviso
 * y asigna la solicitud a un sibarita, un Foodie o a sí mismo desde /solicitudes.
 *
 * Reglas de tiempo (ver supabase/solicitudes_visita.sql):
 *  - Una vez asignada, la persona asignada tiene OPEN_AFTER_DAYS (3) días en exclusiva.
 *  - Del día 4 al 5 la solicitud también aparece a todos los Foodies, que pueden tomarla.
 *  - Al día EXPIRE_AFTER_DAYS (5) sin visita, se le avisa al negocio que por ahora no hay Foodie
 *    y se le invita a ver los paquetes. Una solicitud que nunca se asignó vence igual, 5 días
 *    después de llegar.
 */
export const OPEN_AFTER_DAYS = 3;
export const EXPIRE_AFTER_DAYS = 5;
export const PACKAGES_URL = "https://mysterfoodie.com/servicios/#comparativa";
const DAY_MS = 24 * 60 * 60 * 1000;

export const REQUEST_SOURCES = new Set(["nav", "inicio", "servicios", "footer", "pagina", "nosotros", "otra"]);

export type RequestStatus = "pendiente" | "asignada" | "completada" | "sin_foodie";

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
};

export type CreateOutcome =
  | { ok: true; requestId: string; duplicate: false }
  | { ok: true; duplicate: true }
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
      .select("id")
      .eq("client_id", clientId)
      .in("status", ["pendiente", "asignada"])
      .limit(1);
    if (open && open.length > 0) return { ok: true, duplicate: true };
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
      expires_at: expiresAt,
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
    ]
      .filter(Boolean)
      .join("\n"),
    acceso,
    tieneCuenta,
    baseUrl,
  });

  // Aviso al Master Chef.
  const adminOutcome = await notifyAdmins({ negocio: input.name, ubicacion, contacto: input.contactName, baseUrl, isNewClient });

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
}): Promise<SendEmailOutcome> {
  const automation = await getAutomation("solicitud_recibida");
  const useTemplate = Boolean(automation?.enabled && automation.subjectTemplate && automation.bodyTemplate);

  const linkAcceso = p.acceso ? p.acceso.link : `${p.baseUrl}/login`;
  const vars = { negocio: p.negocio, contacto: p.contacto, datos: p.datos, link_acceso: linkAcceso };

  const cuentaDefault = p.acceso
    ? `Ya generamos tu cuenta para que veas el avance de tu solicitud y, cuando termine la visita, tu reporte. Crea tu contraseña aquí (o continúa con Google desde la misma pantalla):\n${linkAcceso}`
    : p.tieneCuenta
      ? `Este correo ya tiene una cuenta en MysterFoodie: entra aquí para ver tu negocio:\n${linkAcceso}`
      : `Estamos terminando de preparar tu cuenta; te escribiremos en cuanto esté lista.`;

  const defaultSubject = `Tu negocio ya está en MysterFoodie: ${p.negocio}`;
  const defaultBody =
    `Hola ${p.contacto},\n\n` +
    `¡Gracias por pedir tu visita gratis! Tu negocio ${p.negocio} ha sido dado de alta y tu solicitud ha sido enviada.\n\n` +
    `Estos son los datos que registramos:\n${p.datos}\n\n` +
    `Qué sigue: asignaremos tu visita a uno de nuestros MysterFoodies. Es una visita anónima, así que no te avisaremos el día ni la hora. ` +
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
  return sendTemplatedEmail({ to: p.to, subject, bodyText, ctaLabel: p.acceso ? "Crear mi cuenta" : "Entrar a mi cuenta" });
}

/** Avisa a los admins (Master Chef) que llegó una solicitud nueva. Devuelve "sent" si salió al menos un correo. */
async function notifyAdmins(p: {
  negocio: string;
  ubicacion: string;
  contacto: string;
  baseUrl: string;
  isNewClient: boolean;
}): Promise<"sent" | "failed"> {
  const db = getSupabaseServiceClient();
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  let sent = false;
  for (const a of admins || []) {
    const out = await sendTemplatedEmail({
      to: a.email as string,
      subject: `Nueva solicitud de visita gratis: ${p.negocio}`,
      bodyText:
        `Llegó una solicitud de visita gratis desde la web.\n\n` +
        `Negocio: ${p.negocio}\nUbicación: ${p.ubicacion}\nContacto: ${p.contacto}\n` +
        `${p.isNewClient ? "El negocio se dio de alta solo." : "El negocio ya existía."}\n\n` +
        `Asígnala a un sibarita, un Foodie o a ti desde aquí:\n${p.baseUrl}/solicitudes`,
      ctaLabel: "Asignar la visita",
    });
    if (out.status === "sent") sent = true;
  }
  return sent ? "sent" : "failed";
}

// ---------------------------------------------------------------------------
// Asignar / tomar
// ---------------------------------------------------------------------------

export type AssignResult = { ok: true; email: SendEmailOutcome } | { ok: false; error: string; status: number };

/** Asigna (o reasigna) una solicitud a un admin, Foodie o sibarita y arranca el reloj de 3 + 2 días. */
export async function assignVisitRequest(
  db: Db,
  p: { requestId: string; assigneeId: string; assignedBy: string; baseUrl: string }
): Promise<AssignResult> {
  const { data: request } = await db
    .from("visit_requests")
    .select("id, client_id, status, assignment_id")
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
    return { ok: false, error: "Solo puedes asignar a un sibarita, un Foodie o a ti mismo", status: 400 };
  }

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, city")
    .eq("id", request.client_id)
    .maybeSingle();
  if (!client) return { ok: false, error: "Negocio no encontrado", status: 404 };

  const note = `Solicitud de visita gratis desde la web. Tienes ${OPEN_AFTER_DAYS} días para hacerla; después se abre a los demás Foodies.`;

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
      open_at: new Date(now + OPEN_AFTER_DAYS * DAY_MS).toISOString(),
      expires_at: new Date(now + EXPIRE_AFTER_DAYS * DAY_MS).toISOString(),
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
  });
  return { ok: true, email };
}

/** Un Foodie toma una solicitud que ya está en la bolsa abierta (días 4 y 5). */
export async function takeVisitRequest(
  db: Db,
  p: { requestId: string; foodieId: string; baseUrl: string }
): Promise<AssignResult> {
  const { data: request } = await db
    .from("visit_requests")
    .select("id, client_id, status, assignment_id, assigned_to, open_at, expires_at")
    .eq("id", p.requestId)
    .maybeSingle();
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
  if (!foodie || foodie.role !== "agente") return { ok: false, error: "Solo los Foodies pueden tomar visitas", status: 403 };

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
    note: "Tomaste esta visita gratis de la bolsa de Foodies.",
    baseUrl: p.baseUrl,
    linkVisitas: `${p.baseUrl}/nueva-visita/${request.assignment_id}`,
  });
  return { ok: true, email };
}

// ---------------------------------------------------------------------------
// Sincronización: visitas hechas y solicitudes vencidas
// ---------------------------------------------------------------------------

export type SyncResult = { completed: number; expired: number; emailed: number };

/**
 * 1) Marca como completadas las solicitudes cuyo negocio ya tiene una visita posterior a la solicitud
 *    (la haya hecho quien la tenía asignada, otro Foodie o el Master Chef).
 * 2) Las que llegaron a expires_at sin visita pasan a "sin_foodie" y el negocio recibe el correo
 *    "Por el momento no contamos con un foodie" (una sola vez).
 * La corre el cron diario/frecuente y también se ejecuta al abrir /solicitudes.
 */
export async function syncVisitRequests(db: Db): Promise<SyncResult> {
  const result: SyncResult = { completed: 0, expired: 0, emailed: 0 };
  const { data: open } = await db
    .from("visit_requests")
    .select("id, client_id, status, created_at, assignment_id, expires_at, nofoodie_email_sent_at")
    .in("status", ["pendiente", "asignada", "sin_foodie"]);
  if (!open || open.length === 0) return result;

  const nowIso = new Date().toISOString();

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
    }
  }
  return result;
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
    `Por el momento y dado el alto volumen de solicitudes, no contamos con un foodie para tu visita a ${client.name}.\n\n` +
    `Puedes agendar paquetes de visitas con nosotros aquí, donde también encuentras la tabla comparativa de paquetes:\n${PACKAGES_URL}\n\n` +
    `Gracias por tu interés,\nMysterFoodie`;

  const subject = useTemplate ? renderTemplate(automation!.subjectTemplate, vars) : defaultSubject;
  const bodyText = useTemplate ? renderTemplate(automation!.bodyTemplate, vars) : defaultBody;
  const out = await sendTemplatedEmail({
    to: client.email as string,
    subject,
    bodyText,
    ctaLabel: "Ver la tabla comparativa de paquetes",
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
  /** La bolsa de Foodies ya está abierta (días 4 y 5) para esta solicitud. */
  inOpenPool: boolean;
};

export type Assignee = { id: string; name: string; role: "admin" | "agente" | "sibarita"; pendingCount: number };

/** Todas las solicitudes, las abiertas primero (para /solicitudes). */
export async function getSolicitudes(db: Db): Promise<SolicitudRow[]> {
  const { data: rows } = await db
    .from("visit_requests")
    .select("id, status, created_at, message, source, client_id, assignment_id, assigned_to, assigned_at, open_at, expires_at")
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
      } satisfies SolicitudRow;
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt));
}

/** Personas a quienes el Master Chef puede asignar: él, sibaritas y Foodies. */
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
};

/** Solicitudes en los días 4 y 5 que cualquier Foodie puede tomar (excluye las suyas). */
export async function getOpenPoolFor(db: Db, userId: string): Promise<OpenPoolItem[]> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("visit_requests")
    .select("id, client_id, assigned_to, expires_at")
    .eq("status", "asignada")
    .lte("open_at", nowIso)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true });
  const mine = (rows || []).filter((r) => r.assigned_to !== userId);
  if (mine.length === 0) return [];
  const { data: clients } = await db
    .from("clients")
    .select("id, name, type, city")
    .in("id", mine.map((r) => r.client_id as string));
  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));
  return mine
    .map((r) => {
      const c = clientById.get(r.client_id as string);
      if (!c) return null;
      return {
        requestId: r.id as string,
        clientName: c.name as string,
        clientType: c.type as string,
        city: (c.city as string | null) ?? null,
        expiresAt: r.expires_at as string,
      };
    })
    .filter(Boolean) as OpenPoolItem[];
}

/** Cuántas solicitudes esperan asignación (para el aviso del Master Chef). */
export async function countPendingRequests(db: Db): Promise<number> {
  const { count } = await db.from("visit_requests").select("id", { count: "exact", head: true }).in("status", ["pendiente", "sin_foodie"]);
  return count ?? 0;
}
