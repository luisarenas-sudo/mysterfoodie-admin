import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { STAR_ITEMS, BOOLEAN_ITEMS, SELECT_ITEMS, fullItemLabel, businessTypePhrase } from "@/lib/categories";
import { overallScore, categoryScores, type Ratings } from "@/lib/scoring";
import { buildDmMessage, buildInstagramDmLink, buildInstagramProfileLink } from "@/lib/instagram";
import { sendResultEmail } from "@/lib/email";
import { getAutomation, renderTemplate } from "@/lib/automations";
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
  /** Visita a partir de una asignación (Foodie): ver /nueva-visita/[assignmentId]. */
  assignmentId?: string;
  shopperName?: string;
  ratings: Ratings;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  comments?: string;
  waiterName?: string;
};

export async function POST(req: NextRequest) {
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como Foodie, Sibarita o admin para registrar una visita" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Un Foodie (agente) ya no puede levantar visitas libres: solo puede
  // completar una visita que le hayan asignado explícitamente (ver
  // "añade ... foodies, solo pueden hacer visitas asignadas").
  if (profile.role === "agente" && !body.assignmentId) {
    return NextResponse.json(
      { error: "Como Foodie solo puedes registrar visitas que te hayan sido asignadas" },
      { status: 403 }
    );
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
  // Resolver el negocio: de una asignación (Foodie), de un negocio ya
  // existente elegido directamente (admin/sibarita), o se da de alta /
  // reutiliza a partir del formulario libre (compatibilidad).
  // ------------------------------------------------------------
  let clientId: string;
  let business: Business;
  let assignmentId: string | null = null;

  if (body.assignmentId) {
    const { data: assignment } = await db
      .from("visit_assignments")
      .select("id, client_id, assigned_to, status")
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
        { error: "Como Foodie solo puedes registrar visitas que te hayan sido asignadas" },
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

  const score = overallScore(body.ratings, body.flags || {});
  const catScores = categoryScores(body.ratings, body.flags || {});
  const shortCode = nanoid(8);

  const menuTipo = SELECT_ITEMS.length > 0 ? body.selects?.[SELECT_ITEMS[0].key] || null : null;

  const { data: form, error: formError } = await db
    .from("forms")
    .insert({
      client_id: clientId,
      shopper_name: body.shopperName || null,
      overall_score: score,
      short_code: shortCode,
      status: "completado",
      created_by: profile.userId,
      menu_type: menuTipo,
      comments: body.comments?.trim() || null,
      waiter_name: body.waiterName?.trim() || null,
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
  const ratingRows = STAR_ITEMS.map((item) => ({
    form_id: form.id,
    category_key: item.key,
    category_label: fullItemLabel(item),
    score: body.ratings[item.key],
  }));
  const flagRows = BOOLEAN_ITEMS.map((item) => ({
    form_id: form.id,
    flag_key: item.key,
    flag_label: fullItemLabel(item),
    flag_value: Boolean(body.flags?.[item.key]),
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
  ]);

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const internalReportUrl = `${baseUrl}/r/${shortCode}`;

  // El link que se comparte con el negocio siempre es el de go.mysterfoodie.com
  // (via Short.io), igual que en el sitio anterior. Si Short.io falla o no
  // esta configurado (falta SHORTIO_API_KEY), se usa el link interno como
  // respaldo para que el flujo nunca se rompa.
  let reportUrl = internalReportUrl;
  const shortLink = await createShortLink(internalReportUrl, {
    title: `${business.name} - ${score}/5`,
  });
  if (shortLink.ok) {
    reportUrl = shortLink.shortURL;
  }

  await db.from("forms").update({ report_url: reportUrl }).eq("id", form.id);

  const waiterName = body.waiterName?.trim() || null;
  const templateVars = {
    negocio: business.name,
    tipo_negocio: businessTypePhrase(business.type) || "",
    mesero: waiterName || "",
    promedio: String(score),
  };
  const [resultadoAutomation, dmAutomation] = await automationsPromise;
  const defaultSubject = `Resultado de tu evaluación Mystery Shopper - ${score} estrellas`;
  const defaultIntro = `Recientemente realizamos una visita de evaluación (Mystery Shopper) sin previo aviso a ${business.name}. El promedio general obtenido fue:`;
  const resultSubject =
    resultadoAutomation?.enabled && resultadoAutomation.subjectTemplate
      ? renderTemplate(resultadoAutomation.subjectTemplate, templateVars)
      : defaultSubject;
  const resultIntro =
    resultadoAutomation?.enabled && resultadoAutomation.bodyTemplate
      ? renderTemplate(resultadoAutomation.bodyTemplate, templateVars)
      : defaultIntro;

  const recipientEmail = business.email || process.env.ADMIN_EMAIL || "";
  let emailOutcome: Awaited<ReturnType<typeof sendResultEmail>> | null = null;

  if (recipientEmail) {
    emailOutcome = await sendResultEmail({
      to: recipientEmail,
      businessName: business.name,
      subject: resultSubject,
      introText: resultIntro,
      score,
      reportUrl,
      categoryScores: catScores,
    });

    await db.from("email_confirmations").insert({
      form_id: form.id,
      recipient_email: recipientEmail,
      subject: resultSubject,
      status: emailOutcome.status,
      provider_id: emailOutcome.providerId || null,
      error: emailOutcome.error || null,
    });
  }

  const dmMessage = buildDmMessage(
    {
      businessName: business.name,
      score,
      reportUrl,
      waiterName,
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
    email: emailOutcome,
    dmMessage,
    dmLink,
    profileLink,
  });
}
