import { glosarioIfFirstEmail } from "@/lib/firstContact";
import { isRequestedVisit } from "@/lib/visitRequests";
import { deliverFullReportEmail, getPlanProgress } from "@/lib/fullReportDelivery";
import { NextRequest, NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { STAR_ITEMS, BOOLEAN_ITEMS, SELECT_ITEMS, CONTEXT_SELECT_ITEMS, fullItemLabel, businessTypePhrase } from "@/lib/categories";
import { overallScore, categoryScores, type Ratings } from "@/lib/scoring";
import { buildDmMessage, buildInstagramDmLink, buildInstagramProfileLink } from "@/lib/instagram";
import { sendResultEmail, fullReportSubject } from "@/lib/email";
import { getAutomation, renderTemplate, resultadoVars, DEFAULT_RESULTADO_SUBJECT, DEFAULT_RESULTADO_INTRO, LOW_RESULTADO_SUBJECT, LOW_RESULTADO_INTRO } from "@/lib/automations";
import { isLowScore } from "@/lib/verdict";
import { createShortLink } from "@/lib/shortio";

type Business = {
  name: string;
  type: string;
  contactName?: string;
  phone?: string;
  instagramHandle?: string;
  email?: string;
  address?: string;
  city?: string;
};

type Body = {
  /** Alta libre de negocio (sin usar el formulario "Nuevo negocio"): flujo antiguo, ya sin ruta activa. */
  business?: Business;
  /** Visita directa a un negocio ya existente (admin/sibarita): ver /nueva-visita/negocio/[id]. */
  clientId?: string;
  /** Visita a partir de una asignación (Shopper): ver /nueva-visita/[assignmentId]. */
  assignmentId?: string;
  shopperName?: string;
  ratings: Ratings;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  comments?: string;
  waiterName?: string;
  /** Demo gratis: el reporte se entrega abierto (sin link de pago) y el PDF lleva marca de agua. */
  freeDemo?: boolean;
  /** Contexto de la visita: cuándo empezó (ISO) y sellos de hora de los hitos del servicio. */
  startedAt?: string;
  stamps?: Record<string, string>;
  /** «¿Volverías?» de 1 a 10. */
  wouldReturn?: number;
};

const STAMP_KEYS = ["atendido", "bebida", "platillo", "cuenta"];

/** Fecha ISO razonable (no futura más de 10 min ni de hace más de 2 días); si no, null. */
function cleanIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  if (t > now + 10 * 60_000 || t < now - 2 * 24 * 3600_000) return null;
  return new Date(t).toISOString();
}

export async function POST(req: NextRequest) {
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como Shopper, Sibarita o admin para registrar una visita" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Un Shopper (agente) ya no puede levantar visitas libres: solo puede
  // completar una visita que le hayan asignado explícitamente (ver
  // "añade ... foodies, solo pueden hacer visitas asignadas").
  if (profile.role === "agente" && !body.assignmentId) {
    return NextResponse.json(
      { error: "Como Shopper solo puedes registrar visitas que te hayan sido asignadas" },
      { status: 403 }
    );
  }

  if (body.freeDemo && profile.role === "agente") {
    return NextResponse.json({ error: "Solo un Master Chef o un Sibarita puede enviar un demo gratis" }, { status: 403 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  // No dependen de nada de lo que sigue (ni del negocio ni del form que se
  // va a crear) -- se lanzan ya para que terminen mientras se resuelve el
  // resto, en vez de esperar hasta el momento en que se usan más abajo.
  const automationsPromise = Promise.all([
    getAutomation("resultado_visita"),
    getAutomation("instagram_dm"),
  ]);

  // ------------------------------------------------------------
  // Resolver el negocio: de una asignación (Shopper), de un negocio ya
  // existente elegido directamente (admin/sibarita), o se da de alta /
  // reutiliza a partir del formulario libre (compatibilidad).
  // ------------------------------------------------------------
  let clientId: string;
  let business: Business;
  let assignmentId: string | null = null;
  // Visita de un plan mensual (segunda etapa): el reporte ya viene incluido.
  let planId: string | null = null;

  if (body.assignmentId) {
    const { data: assignment } = await db
      .from("visit_assignments")
      .select("id, client_id, assigned_to, status, plan_id")
      .eq("id", body.assignmentId)
      .maybeSingle();

    if (!assignment || assignment.assigned_to !== profile.userId) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
    }
    if (assignment.status !== "pendiente") {
      return NextResponse.json({ error: "Esta visita ya fue completada o cancelada" }, { status: 400 });
    }

    const { data: client } = await db
      .from("clients")
      .select("id, name, type, instagram_handle, email, city")
      .eq("id", assignment.client_id)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    assignmentId = assignment.id;
    planId = (assignment.plan_id as string | null) ?? null;
    clientId = client.id;
    business = {
      name: client.name,
      type: client.type,
      instagramHandle: client.instagram_handle || undefined,
      email: client.email || undefined,
      city: client.city || undefined,
    };
  } else if (body.clientId) {
    if (profile.role === "agente") {
      return NextResponse.json(
        { error: "Como Shopper solo puedes registrar visitas que te hayan sido asignadas" },
        { status: 403 }
      );
    }

    const { data: client } = await db
      .from("clients")
      .select("id, name, type, instagram_handle, email, city")
      .eq("id", body.clientId)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    clientId = client.id;
    business = {
      name: client.name,
      type: client.type,
      instagramHandle: client.instagram_handle || undefined,
      email: client.email || undefined,
      city: client.city || undefined,
    };
  } else {
    if (!body.business?.name?.trim()) {
      return NextResponse.json({ error: "Falta el nombre del negocio" }, { status: 400 });
    }
    business = body.business;

    let existingId: string | null = null;
    if (business.instagramHandle) {
      const { data: existing } = await db
        .from("clients")
        .select("id")
        .eq("instagram_handle", business.instagramHandle)
        .maybeSingle();
      if (existing) existingId = existing.id;
    }

    if (existingId) {
      clientId = existingId;
    } else {
      const { data: newClient, error: clientError } = await db
        .from("clients")
        .insert({
          name: business.name,
          type: business.type || "restaurante",
          contact_name: business.contactName || null,
          phone: business.phone || null,
          instagram_handle: business.instagramHandle || null,
          email: business.email || null,
          address: business.address || null,
          city: business.city || null,
          created_by: profile.userId,
        })
        .select("id")
        .single();

      if (clientError || !newClient) {
        return NextResponse.json(
          { error: clientError?.message || "No se pudo crear el negocio" },
          { status: 500 }
        );
      }
      clientId = newClient.id;
    }
  }

  // Los indicadores tipo estrella son opcionales: si no se le "pica" una
  // estrella, ese indicador simplemente no se considera en el promedio de
  // su categoría ni en el promedio general (ver overallScore/categoryScores
  // en lib/scoring.ts). Solo se exige calificar al menos un indicador en
  // toda la visita para que el reporte no quede vacío.
  const hasAnyRating = Boolean(
    body.ratings && Object.values(body.ratings).some((v) => typeof v === "number" && v > 0)
  );
  if (!hasAnyRating) {
    return NextResponse.json(
      { error: "Califica al menos un indicador para poder guardar la visita" },
      { status: 400 }
    );
  }

  const missingSelects = SELECT_ITEMS.filter(
    (item) => !body.selects || !body.selects[item.key]
  );
  if (missingSelects.length > 0) {
    return NextResponse.json(
      { error: "Faltan opciones por elegir", missing: missingSelects.map((i) => i.key) },
      { status: 400 }
    );
  }

  // Demo gratis: se trata como un reporte ya comprado (queda desbloqueado, llega el
  // PDF y corren las mismas automatizaciones), pero sin cobro y con marca de agua.
  // Una visita de plan ya viene incluida, así que ahí no aplica.
  const freeDemo = Boolean(body.freeDemo) && !planId;

  const score = overallScore(body.ratings, body.flags || {});
  const catScores = categoryScores(body.ratings, body.flags || {});
  const shortCode = nanoid(8);

  // El link corto (Short.io) solo necesita el código y la calificación: se pide ya,
  // mientras se guarda la visita, en vez de esperarlo después.
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const internalReportUrl = `${baseUrl}/r/${shortCode}`;
  // El link que se comparte con el negocio siempre es el de go.mysterfoodie.com
  // (via Short.io), igual que en el sitio anterior. Si Short.io falla o no esta
  // configurado (falta SHORTIO_API_KEY), se usa el link interno como respaldo
  // para que el flujo nunca se rompa.
  let reportUrl = internalReportUrl;
  const shortLinkPromise = createShortLink(internalReportUrl, {
    title: `${business.name} - ${score}/5`,
  }).catch(() => ({ ok: false as const, error: "Short.io no respondió" }));

  const menuTipo = SELECT_ITEMS.length > 0 ? body.selects?.[SELECT_ITEMS[0].key] || null : null;

  // Contexto de la visita (opcional para no romper borradores viejos; la pantalla sí lo pide).
  const occupancyItem = CONTEXT_SELECT_ITEMS[0];
  const occupancyRaw = body.selects?.[occupancyItem.key];
  const occupancy = occupancyItem.options?.some((o) => o.value === occupancyRaw) ? (occupancyRaw as string) : null;
  const stamps: Record<string, string> = {};
  for (const k of STAMP_KEYS) {
    const iso = cleanIso(body.stamps?.[k]);
    if (iso) stamps[k] = iso;
  }
  const wouldReturn =
    Number.isInteger(body.wouldReturn) && (body.wouldReturn as number) >= 1 && (body.wouldReturn as number) <= 10
      ? (body.wouldReturn as number)
      : null;

  const { data: form, error: formError } = await db
    .from("forms")
    .insert({
      client_id: clientId,
      // Desde móvil el wizard ya no pregunta el nombre (la visita va ligada a un
      // negocio/asignación): se toma del perfil de quien la levanta.
      shopper_name: body.shopperName?.trim() || profile.fullName || null,
      overall_score: score,
      short_code: shortCode,
      status: "completado",
      created_by: profile.userId,
      menu_type: menuTipo,
      comments: body.comments?.trim() || null,
      waiter_name: body.waiterName?.trim() || null,
      visit_started_at: cleanIso(body.startedAt),
      visit_ended_at: new Date().toISOString(),
      service_stamps: Object.keys(stamps).length > 0 ? stamps : null,
      occupancy,
      would_return: wouldReturn,
      // Visita de plan: queda ligada al plan y con el reporte completo ya abierto.
      ...(planId ? { plan_id: planId, report_unlocked_at: new Date().toISOString() } : {}),
      ...(freeDemo ? { free_demo: true, report_unlocked_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();

  if (formError || !form) {
    return NextResponse.json(
      { error: formError?.message || "No se pudo guardar la evaluación" },
      { status: 500 }
    );
  }

  // Ninguna de estas 3 escrituras depende de las otras (todas solo
  // necesitan form.id, que ya tenemos) -- se lanzan juntas en vez de
  // esperarlas una por una.
  // Solo se guarda lo que el Shopper SÍ contestó: una estrella sin calificar
  // o un Sí/No marcado "No aplica" no genera fila (score es NOT NULL 1-5, así
  // que una fila vacía haría fallar todo el guardado de calificaciones).
  const ratingRows = STAR_ITEMS.filter((item) => {
    const v = body.ratings?.[item.key];
    return Number.isInteger(v) && v >= 1 && v <= 5;
  }).map((item) => ({
    form_id: form.id,
    category_key: item.key,
    category_label: fullItemLabel(item),
    score: body.ratings[item.key],
  }));
  const flagRows = BOOLEAN_ITEMS.filter((item) => typeof body.flags?.[item.key] === "boolean").map((item) => ({
    form_id: form.id,
    flag_key: item.key,
    flag_label: fullItemLabel(item),
    flag_value: body.flags[item.key],
  }));

  await Promise.all([
    assignmentId
      ? db
          .from("visit_assignments")
          .update({ status: "completada", completed_form_id: form.id })
          .eq("id", assignmentId)
      : Promise.resolve(),
    ratingRows.length > 0 ? db.from("form_ratings").insert(ratingRows) : Promise.resolve(),
    flagRows.length > 0 ? db.from("form_flags").insert(flagRows) : Promise.resolve(),
    shortLinkPromise.then(async (shortLink) => {
      if (shortLink.ok) reportUrl = shortLink.shortURL;
      await db.from("forms").update({ report_url: reportUrl }).eq("id", form.id);
    }),
  ]);

  // Visita de plan: el avance del mes se calcula ya (la pantalla lo muestra); el correo
  // del reporte sale en segundo plano, igual que los demás.
  const planProgress = planId ? await getPlanProgress(db, form.id) : null;
  const bgForm = {
    id: form.id,
    overall_score: score,
    client_id: clientId,
    report_url: reportUrl,
    short_code: shortCode,
    created_at: new Date().toISOString(),
  };

  const waiterName = body.waiterName?.trim() || null;
  const templateVars = resultadoVars({
    negocio: business.name,
    tipoNegocio: businessTypePhrase(business.type) || "negocio",
    mesero: waiterName,
    promedio: score,
  });
  const [resultadoAutomation, dmAutomation] = await automationsPromise;
  const defaultSubject = renderTemplate(DEFAULT_RESULTADO_SUBJECT, templateVars);
  const defaultIntro = renderTemplate(DEFAULT_RESULTADO_INTRO, templateVars);
  const lowScore = isLowScore(score);
  const resultSubject = lowScore
    ? renderTemplate(LOW_RESULTADO_SUBJECT, templateVars)
    : resultadoAutomation?.enabled && resultadoAutomation.subjectTemplate
      ? renderTemplate(resultadoAutomation.subjectTemplate, templateVars)
      : defaultSubject;
  const resultIntro = lowScore
    ? renderTemplate(LOW_RESULTADO_INTRO, templateVars)
    : resultadoAutomation?.enabled && resultadoAutomation.bodyTemplate
      ? renderTemplate(resultadoAutomation.bodyTemplate, templateVars)
      : defaultIntro;

  // En un plan no se manda el resumen "gancho" de venta: el negocio ya pagó y
  // recibe el reporte completo con PDF (más abajo).
  const recipientEmail = planId || freeDemo ? "" : business.email || process.env.ADMIN_EMAIL || "";

  // Los correos (reporte con PDF, comprobante, resultado) salen DESPUÉS de responder:
  // guardar la visita ya no espera a generar el PDF ni a Resend. Cada correo queda en
  // email_confirmations; si falla (o truena el PDF) queda como "failed" y avisa en Pendientes.
  if (freeDemo) {
    // Pago simulado: queda como un pago aprobado de $0 (no cuenta como venta en Ganancias).
    await db.from("report_payments").insert({
      form_id: form.id,
      mercadopago_payment_id: `GRATIS-${shortCode}`,
      status: "approved",
      amount: 0,
    });
  }
  const demoRecipient = business.email || process.env.ADMIN_EMAIL || null;
  const queued = planId ? (business.email ? 1 : 0) : freeDemo ? (demoRecipient ? 2 : 0) : recipientEmail ? 1 : 0;
  if (queued > 0) {
    after(async () => {
      const logFailure = async (to: string, subject: string, err: unknown) => {
        console.error("No se pudo mandar el correo de la visita:", err);
        try {
          await db.from("email_confirmations").insert({
            form_id: form.id,
            recipient_email: to,
            subject,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        } catch {
          // el registro es de cortesía: si tampoco se puede, ya quedó en la bitácora del servidor
        }
      };

      if (planId) {
        try {
          await deliverFullReportEmail(db, bgForm, { planProgress: planProgress ?? undefined });
        } catch (err) {
          await logFailure(business.email || "", fullReportSubject(business.name, planProgress ?? undefined), err);
        }
      } else if (freeDemo) {
        try {
          await deliverFullReportEmail(db, bgForm, {
            recipientEmail: demoRecipient,
            demo: true,
            receipt: { free: true, paymentId: `GRATIS-${shortCode}`, amountPaid: 0 },
          });
        } catch (err) {
          await logFailure(demoRecipient || "", fullReportSubject(business.name), err);
        }
      } else {
        try {
          const outcome = await sendResultEmail({
            glosario: await glosarioIfFirstEmail(db, recipientEmail, form.id),
            requested: await isRequestedVisit(db, { id: form.id, client_id: clientId, created_at: bgForm.created_at }).catch(() => false),
            to: recipientEmail,
            businessName: business.name,
            subject: resultSubject,
            introText: resultIntro,
            hideScore: lowScore,
            score,
            reportUrl,
            categoryScores: catScores,
          });
          await db.from("email_confirmations").insert({
            form_id: form.id,
            recipient_email: recipientEmail,
            subject: resultSubject,
            status: outcome.status,
            provider_id: outcome.providerId || null,
            error: outcome.error || null,
          });
        } catch (err) {
          await logFailure(recipientEmail, resultSubject, err);
        }
      }
    });
  }

  const dmMessage = buildDmMessage(
    {
      businessName: business.name,
      score,
      reportUrl,
      waiterName,
      tipoNegocio: businessTypePhrase(business.type) || "negocio",
      freeGift: freeDemo,
    },
    dmAutomation?.enabled && dmAutomation.bodyTemplate ? dmAutomation.bodyTemplate : undefined
  );
  const dmLink = business.instagramHandle
    ? buildInstagramDmLink(business.instagramHandle)
    : null;
  const profileLink = business.instagramHandle
    ? buildInstagramProfileLink(business.instagramHandle)
    : null;

  return NextResponse.json({
    formId: form.id,
    shortCode,
    reportUrl,
    overallScore: score,
    categoryScores: catScores,
    // "queued": el correo sale en segundo plano; la pantalla consulta su estado.
    email:
      queued > 0
        ? { status: "queued", expected: queued, to: planId ? business.email : freeDemo ? demoRecipient : recipientEmail }
        : planId || freeDemo
          ? { status: "skipped_no_email" }
          : null,
    freeDemo,
    plan: planProgress,
    dmMessage,
    dmLink,
    profileLink,
  });
}
