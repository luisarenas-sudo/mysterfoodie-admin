import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { RATING_CATEGORIES, FLAG_QUESTIONS } from "@/lib/categories";
import { overallScore, topAndBottomCategories, type Ratings } from "@/lib/scoring";
import { buildDmMessage, buildInstagramDmLink, buildInstagramProfileLink } from "@/lib/instagram";
import { sendResultEmail } from "@/lib/email";

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

  const missingRatings = RATING_CATEGORIES.filter(
    (c) => !body.ratings || !(c.key in body.ratings)
  );
  if (missingRatings.length > 0) {
    return NextResponse.json(
      { error: "Faltan categorías por calificar", missing: missingRatings.map((c) => c.key) },
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
  const { strengths, opportunities } = topAndBottomCategories(body.ratings, 3);
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

  const { data: form, error: formError } = await db
    .from("forms")
    .insert({
      client_id: clientId,
      shopper_name: body.shopperName || null,
      overall_score: score,
      short_code: shortCode,
      status: "completado",
      created_by: profile.userId,
    })
    .select("id")
    .single();

  if (formError || !form) {
    return NextResponse.json(
      { error: formError?.message || "No se pudo guardar la evaluación" },
      { status: 500 }
    );
  }

  const ratingRows = RATING_CATEGORIES.map((c) => ({
    form_id: form.id,
    category_key: c.key,
    category_label: c.label,
    score: body.ratings[c.key],
  }));
  await db.from("form_ratings").insert(ratingRows);

  const flagRows = FLAG_QUESTIONS.map((f) => ({
    form_id: form.id,
    flag_key: f.key,
    flag_label: f.label,
    flag_value: Boolean(body.flags?.[f.key]),
  })).filter((f) => body.flags && f.flag_key in body.flags);
  if (flagRows.length > 0) {
    await db.from("form_flags").insert(flagRows);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const reportUrl = `${baseUrl}/r/${shortCode}`;

  const recipientEmail = body.business.email || process.env.ADMIN_EMAIL || "";
  let emailOutcome: Awaited<ReturnType<typeof sendResultEmail>> | null = null;

  if (recipientEmail) {
    emailOutcome = await sendResultEmail({
      to: recipientEmail,
      businessName: body.business.name,
      score,
      strengths,
      opportunities,
      reportUrl,
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
    strengths,
    opportunities,
    email: emailOutcome,
    dmMessage,
    dmLink,
    profileLink,
  });
}
