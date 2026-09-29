import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { STAR_ITEMS, BOOLEAN_ITEMS, SELECT_ITEMS } from "@/lib/categories";
import { overallScore, categoryScores, type Ratings } from "@/lib/scoring";
import { buildDmMessage, buildInstagramDmLink, buildInstagramProfileLink } from "@/lib/instagram";
import { sendResultEmail } from "@/lib/email";
import { createShortLink } from "@/lib/shortio";

type Body = {
  business: {
    name: string;
    type: string;
    contactName?: string;
    phone?: string;
    instagramHandle?: string;
    email?: string;
    address?: string;
    city?: string;
  };
  shopperName?: string;
  ratings: Ratings;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  comments?: string;
};

export async function POST(req: NextRequest) {
  let profile;
  try {
    profile = await requireRole("admin", "agente");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como agente o admin para registrar una visita" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.business?.name?.trim()) {
    return NextResponse.json({ error: "Falta el nombre del negocio" }, { status: 400 });
  }

  const missingRatings = STAR_ITEMS.filter(
    (item) => !body.ratings || !(item.key in body.ratings)
  );
  if (missingRatings.length > 0) {
    return NextResponse.json(
      { error: "Faltan indicadores por calificar", missing: missingRatings.map((i) => i.key) },
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

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  const score = overallScore(body.ratings);
  const catScores = categoryScores(body.ratings);
  const shortCode = nanoid(8);

  let clientId: string | null = null;
  if (body.business.instagramHandle) {
    const { data: existing } = await db
      .from("clients")
      .select("id")
      .eq("instagram_handle", body.business.instagramHandle)
      .maybeSingle();
    if (existing) clientId = existing.id;
  }

  if (!clientId) {
    const { data: newClient, error: clientError } = await db
      .from("clients")
      .insert({
        name: body.business.name,
        type: body.business.type || "restaurante",
        contact_name: body.business.contactName || null,
        phone: body.business.phone || null,
        instagram_handle: body.business.instagramHandle || null,
        email: body.business.email || null,
        address: body.business.address || null,
        city: body.business.city || null,
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
    })
    .select("id")
    .single();

  if (formError || !form) {
    return NextResponse.json(
      { error: formError?.message || "No se pudo guardar la evaluación" },
      { status: 500 }
    );
  }

  const ratingRows = STAR_ITEMS.map((item) => ({
    form_id: form.id,
    category_key: item.key,
    category_label: item.label,
    score: body.ratings[item.key],
  }));
  if (ratingRows.length > 0) {
    await db.from("form_ratings").insert(ratingRows);
  }

  const flagRows = BOOLEAN_ITEMS.map((item) => ({
    form_id: form.id,
    flag_key: item.key,
    flag_label: item.label,
    flag_value: Boolean(body.flags?.[item.key]),
  }));
  if (flagRows.length > 0) {
    await db.from("form_flags").insert(flagRows);
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const internalReportUrl = `${baseUrl}/r/${shortCode}`;

  // El link que se comparte con el negocio siempre es el de go.mysterfoodie.com
  // (via Short.io), igual que en el sitio anterior. Si Short.io falla o no
  // esta configurado (falta SHORTIO_API_KEY), se usa el link interno como
  // respaldo para que el flujo nunca se rompa.
  let reportUrl = internalReportUrl;
  const shortLink = await createShortLink(internalReportUrl, {
    title: `${body.business.name} - ${score}/5`,
  });
  if (shortLink.ok) {
    reportUrl = shortLink.shortURL;
  }

  const recipientEmail = body.business.email || process.env.ADMIN_EMAIL || "";
  let emailOutcome: Awaited<ReturnType<typeof sendResultEmail>> | null = null;

  if (recipientEmail) {
    emailOutcome = await sendResultEmail({
      to: recipientEmail,
      businessName: body.business.name,
      score,
      reportUrl,
      categoryScores: catScores,
    });

    await db.from("email_confirmations").insert({
      form_id: form.id,
      recipient_email: recipientEmail,
      subject: `Resultado de tu evaluación Mystery Shopper - ${score} estrellas`,
      status: emailOutcome.status,
      provider_id: emailOutcome.providerId || null,
      error: emailOutcome.error || null,
    });
  }

  const dmMessage = buildDmMessage({ businessName: body.business.name, score, reportUrl });
  const dmLink = body.business.instagramHandle
    ? buildInstagramDmLink(body.business.instagramHandle)
    : null;
  const profileLink = body.business.instagramHandle
    ? buildInstagramProfileLink(body.business.instagramHandle)
    : null;

  return NextResponse.json({
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
