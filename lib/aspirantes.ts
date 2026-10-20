import { getSupabaseServiceClient } from "./supabase";
import { sendTemplatedEmail } from "./email";
import { accessUrl, issueAccessToken } from "./accessTokens";
import { sendInviteEmail } from "./accessEmails";
import { ROLE_LABELS } from "./brand";
import { aliasSlug, isAliasStyle, pickAlias, type AliasStyle } from "./alias";
import { appBaseUrl } from "./aliasStore";
import { isValidPostalCode } from "./zonas";
import { PASSPORT_BLOCKS, isBlockComplete, isBlockKey, sanitizePersona, type BlockKey, type Persona } from "./personaCatalog";
import { CUISINES, DISHES, EXPERIENCE_LEVELS, MIN_CUISINES, MIN_DISHES, TIME_SLOTS, WEEK_DAYS } from "./foodCatalog";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export type ApplicationInput = {
  inviterSlug: string;
  fullName: string;
  whatsapp: string;
  email: string;
  city: string;
  colonia: string;
  postalCode: string;
  isAdult: boolean;
  instagram: string;
  experienceLevel: string;
  experienceText: string;
  days: string[];
  slots: string[];
  hasVehicle: boolean;
  aliasStyle: AliasStyle;
  cuisines: string[];
  dishes: string[];
  persona: Persona;
  shareBlocks: BlockKey[];
  ipHash: string | null;
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const list = (v: unknown, allowed: readonly string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];

/** Valida el cuerpo del formulario público. TODO es obligatorio. */
export function parseApplication(p: Record<string, unknown>): { ok: true; value: Omit<ApplicationInput, "ipHash"> } | { ok: false; error: string } {
  const fullName = str(p.fullName, 120);
  const email = str(p.email, 254).toLowerCase();
  const whatsapp = str(p.whatsapp, 30);
  const city = str(p.city, 80);
  const colonia = str(p.colonia, 80);
  const postalCode = str(p.postalCode, 5);
  const instagram = str(p.instagram, 60).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  const experienceText = str(p.experienceText, 400);
  const experienceLevel = EXPERIENCE_LEVELS.find((l) => l === p.experienceLevel) ?? "";
  const days = list(p.days, WEEK_DAYS);
  const slots = list(p.slots, TIME_SLOTS);
  const cuisines = list(p.cuisines, CUISINES.map((c) => c.key));
  const dishes = list(p.dishes, DISHES.map((d) => d.key));
  const inviterSlug = str(p.inviterSlug, 80);
  const persona = sanitizePersona(p.persona);
  const shareBlocks: BlockKey[] = Array.isArray(p.shareBlocks) ? [...new Set((p.shareBlocks as unknown[]).filter(isBlockKey))] : [];

  if (!inviterSlug) return { ok: false, error: "Esta invitación no es válida." };
  if (fullName.split(" ").filter(Boolean).length < 2) return { ok: false, error: "Escribe tu nombre completo (nombre y apellido)." };
  if (whatsapp.replace(/\D/g, "").length < 10 || whatsapp.replace(/\D/g, "").length > 15) return { ok: false, error: "Escribe tu WhatsApp (10 dígitos)." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Escribe un correo válido." };
  if (city.length < 2) return { ok: false, error: "Escribe tu ciudad." };
  if (colonia.length < 2) return { ok: false, error: "Escribe tu colonia." };
  if (!isValidPostalCode(postalCode)) return { ok: false, error: "Escribe tu código postal (5 dígitos)." };
  if (p.isAdult !== true) return { ok: false, error: "Debes confirmar que eres mayor de 18 años." };
  if (instagram.length < 2) return { ok: false, error: "Escribe tu Instagram." };
  if (!experienceLevel) return { ok: false, error: "Elige tu experiencia en restaurantes." };
  if (experienceText.length < 5) return { ok: false, error: "Cuéntanos en una línea tu experiencia (si no tienes, escribe «ninguna»)." };
  if (days.length < 1) return { ok: false, error: "Elige al menos un día disponible." };
  if (slots.length < 1) return { ok: false, error: "Elige al menos un horario disponible." };
  if (typeof p.hasVehicle !== "boolean") return { ok: false, error: "Dinos si cuentas con vehículo." };
  if (!isAliasStyle(p.aliasStyle)) return { ok: false, error: "Elige el estilo de tu nombre anónimo." };
  if (cuisines.length < MIN_CUISINES) return { ok: false, error: "Elige al menos un tipo de cocina que te guste." };
  if (dishes.length < MIN_DISHES) return { ok: false, error: `Elige al menos ${MIN_DISHES} platillos que te gusten.` };
  if (!PASSPORT_BLOCKS.every((k) => isBlockComplete(k, persona))) return { ok: false, error: "Contesta las preguntas de tu perfil anónimo." };
  if (p.consent !== true) return { ok: false, error: "Acepta el aviso de privacidad para continuar." };

  return {
    ok: true,
    value: { inviterSlug, fullName, whatsapp, email, city, colonia, postalCode, isAdult: true, instagram, experienceLevel, experienceText, days, slots, hasVehicle: p.hasVehicle, aliasStyle: p.aliasStyle, cuisines, dishes, persona, shareBlocks: shareBlocks.filter((k) => isBlockComplete(k, persona)) },
  };
}

export async function countPendingApplications(db: Db): Promise<number> {
  const { count } = await db.from("shopper_applications").select("id", { count: "exact", head: true }).eq("status", "pendiente");
  return count ?? 0;
}

/** Guarda la solicitud y avisa (a quien aplicó y a los Master Chef). Devuelve ok también si ya había una abierta con ese correo. */
export async function createApplication(db: Db, input: ApplicationInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: inviter } = await db.from("profiles").select("id, role, alias").eq("alias_slug", input.inviterSlug).maybeSingle();
  if (!inviter || !["admin", "sibarita"].includes(inviter.role as string)) return { ok: false, error: "Esta invitación ya no está disponible." };

  const [{ data: open }, { data: exists }] = await Promise.all([
    db.from("shopper_applications").select("id").eq("status", "pendiente").ilike("email", input.email).limit(1),
    db.from("profiles").select("id").ilike("email", input.email).limit(1),
  ]);
  if ((open && open.length > 0) || (exists && exists.length > 0)) return { ok: true };

  const { error } = await db.from("shopper_applications").insert({
    inviter_id: inviter.id,
    inviter_alias: inviter.alias,
    full_name: input.fullName,
    whatsapp: input.whatsapp,
    email: input.email,
    city: input.city,
    colonia: input.colonia,
    postal_code: input.postalCode,
    is_adult: input.isAdult,
    instagram: input.instagram,
    experience_level: input.experienceLevel,
    experience_text: input.experienceText,
    days: input.days,
    slots: input.slots,
    has_vehicle: input.hasVehicle,
    alias_style: input.aliasStyle,
    cuisines: input.cuisines,
    dishes: input.dishes,
    persona: input.persona,
    share_blocks: input.shareBlocks,
    ip_hash: input.ipHash,
  });
  if (error) return { ok: false, error: error.message };

  const base = appBaseUrl().replace(/\/$/, "");
  const first = input.fullName.split(" ")[0];
  // A quien aplicó: confirmación sin pendientes ni prisa.
  await sendTemplatedEmail({
    to: input.email,
    subject: "Recibimos tu solicitud para ser MysterFoodie Shopper",
    bodyText:
      `Hola ${first},\n\n` +
      `${inviter.alias ? `${inviter.alias} te invitó y ` : ""}ya recibimos tu solicitud para ser MysterFoodie Shopper. ¡Gracias por tu interés!\n\n` +
      `Un Master Chef va a revisarla con calma. Si todo va bien, te llegará un correo para crear tu acceso a la app. No tienes que hacer nada más por ahora.\n\n` +
      `Si tienes dudas, responde a este correo o escríbenos a hola@mysterfoodie.com.`,
  }).catch(() => null);
  // A los Master Chef.
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  for (const a of admins || []) {
    await sendTemplatedEmail({
      to: a.email as string,
      subject: `Nuevo aspirante a Shopper: ${input.fullName}`,
      bodyText:
        `${input.fullName} llenó el formulario para ser Shopper (invitó: ${inviter.alias ?? "—"}).\n\n` +
        `Ciudad y colonia: ${input.city}, ${input.colonia}\nWhatsApp: ${input.whatsapp}\nInstagram: @${input.instagram}\n\n` +
        `Revisa su solicitud y apruébala o recházala aquí:\n${base}/admin/aspirantes`,
      ctaLabel: "Revisar aspirante",
    }).catch(() => null);
  }
  return { ok: true };
}

/** Aprueba: crea la cuenta de Shopper (con su nombre anónimo y quién lo invitó) y manda el correo de acceso. */
export async function approveApplication(db: Db, id: string, reviewerId: string): Promise<{ ok: true; emailStatus: string } | { ok: false; error: string; status: number }> {
  const { data: app } = await db.from("shopper_applications").select("*").eq("id", id).maybeSingle();
  if (!app) return { ok: false, error: "Solicitud no encontrada.", status: 404 };
  if (app.status !== "pendiente") return { ok: false, error: "Esta solicitud ya fue revisada.", status: 409 };

  const email = String(app.email).toLowerCase();
  const { data: existing } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return { ok: false, error: "Ya existe una cuenta con ese correo.", status: 409 };

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: app.full_name },
  });
  if (createError || !created?.user) return { ok: false, error: createError?.message || "No se pudo crear la cuenta.", status: 500 };
  const userId = created.user.id;

  const { data: taken } = await db.from("profiles").select("alias_slug").not("alias_slug", "is", null);
  const slugs = new Set((taken || []).map((r) => r.alias_slug as string));
  const style = app.alias_style as AliasStyle;
  const alias = pickAlias(style, slugs);

  const { error: profileError } = await db.from("profiles").upsert({
    id: userId,
    email,
    full_name: app.full_name,
    role: "agente",
    phone: app.whatsapp,
    alias,
    alias_style: style,
    alias_slug: aliasSlug(alias),
    invited_by: app.inviter_id,
    postal_code: app.postal_code ?? null,
    food_cuisines: app.cuisines ?? null,
    food_dishes: app.dishes ?? null,
    persona: app.persona ?? {},
    share_blocks: app.share_blocks ?? [],
  });
  if (profileError) return { ok: false, error: profileError.message, status: 500 };

  await db
    .from("shopper_applications")
    .update({ status: "aprobada", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), profile_id: userId })
    .eq("id", id);

  const { token, code } = await issueAccessToken(db, { userId, email, purpose: "invite" });
  const base = appBaseUrl();
  const outcome = await sendInviteEmail({
    to: email,
    name: app.full_name as string,
    invitedBy: (app.inviter_alias as string | null) ?? null,
    role: "agente",
    roleLabel: ROLE_LABELS.agente,
    businessName: null,
    url: accessUrl(base, token),
    code,
    baseUrl: base,
  });
  return { ok: true, emailStatus: outcome.status };
}

export async function rejectApplication(db: Db, id: string, reviewerId: string): Promise<boolean> {
  const { error } = await db
    .from("shopper_applications")
    .update({ status: "rechazada", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendiente");
  return !error;
}
