import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getPayment, type MercadoPagoPayment } from "@/lib/mercadopago";
import { categoryScores, overallScore, type Ratings } from "@/lib/scoring";
import { buildReportPdf } from "@/lib/reportPdf";
import { sendFullReportEmail } from "@/lib/email";

/**
 * Webhook de MercadoPago (configurar esta URL como notification_url;
 * ya se manda automaticamente en cada preference creada desde
 * /api/checkout, pero MercadoPago tambien permite configurarla a mano
 * en el panel de la app por si se quiere reforzar).
 *
 * Nunca confiamos en el body de la notificacion (se puede falsificar):
 * solo lo usamos para saber que payment_id consultar, y el estado real
 * se pide siempre a la API de MercadoPago con getPayment().
 */
export async function POST(req: NextRequest) {
  let paymentId: string | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (body?.type === "payment" && body?.data?.id) {
      paymentId = String(body.data.id);
    }
  } catch {
    // ignorar, se intenta por query params abajo
  }

  if (!paymentId) {
    paymentId =
      req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id");
  }

  if (!paymentId) {
    // Notificacion de un tipo que no nos interesa (ej. merchant_order).
    return NextResponse.json({ ok: true });
  }

  const payment = await getPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ ok: true });
  }

  const formId = payment.external_reference;
  if (!formId) {
    return NextResponse.json({ ok: true });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return NextResponse.json({ ok: true });
  }

  await db.from("report_payments").insert({
    form_id: formId,
    mercadopago_payment_id: String(payment.id),
    status: payment.status,
    amount: payment.transaction_amount ?? null,
  });

  if (payment.status === "approved") {
    // .is("report_unlocked_at", null) hace esto idempotente: si el
    // webhook llega más de una vez (MercadoPago reintenta), el update
    // solo afecta una fila la primera vez. select() de vuelta nos dice
    // si esta llamada fue la que realmente desbloqueó el reporte, para
    // mandar el correo con el PDF una sola vez.
    const { data: updatedForms } = await db
      .from("forms")
      .update({ report_unlocked_at: new Date().toISOString() })
      .eq("id", formId)
      .is("report_unlocked_at", null)
      .select("id, overall_score, client_id, report_url, short_code, created_at");

    const unlockedForm = updatedForms?.[0];
    if (unlockedForm) {
      // No se deja que un error al generar/mandar el PDF tumbe la
      // respuesta del webhook (MercadoPago reintentaría innecesariamente
      // y el reporte ya quedó desbloqueado, que es lo importante).
      try {
        await deliverFullReportEmail(db, unlockedForm, payment);
      } catch (err) {
        console.error("No se pudo mandar el correo del reporte completo:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

type UnlockedForm = {
  id: string;
  overall_score: number;
  client_id: string;
  report_url: string | null;
  short_code: string;
  created_at: string;
};

/** Genera el PDF del reporte completo y lo manda por correo al
 * comprador (o, si MercadoPago no entregó su correo, al correo del
 * negocio ya registrado), con el link al reporte en línea y el botón
 * de WhatsApp si está configurado. */
async function deliverFullReportEmail(
  db: ReturnType<typeof getSupabaseServiceClient>,
  form: UnlockedForm,
  payment: MercadoPagoPayment
) {
  const { data: client } = await db
    .from("clients")
    .select("name, type, city, email")
    .eq("id", form.client_id)
    .maybeSingle();

  const recipientEmail = payment.payer?.email || client?.email;
  if (!recipientEmail) {
    // Sin a quién mandarlo (ni el pago ni el negocio tienen correo
    // registrado); el reporte ya quedó desbloqueado en la página
    // pública, así que no es un error fatal.
    console.error(`No hay correo para mandar el PDF del reporte completo (form ${form.id}).`);
    return;
  }

  const { data: ratingRows } = await db
    .from("form_ratings")
    .select("category_key, score")
    .eq("form_id", form.id);

  const ratings: Ratings = {};
  for (const row of ratingRows ?? []) {
    if (typeof row.score === "number") ratings[row.category_key as string] = row.score;
  }

  const catScores = categoryScores(ratings);
  const score = form.overall_score || overallScore(ratings);

  const pdfBuffer = await buildReportPdf({
    businessName: client?.name || "Negocio",
    clientType: client?.type ?? null,
    city: client?.city ?? null,
    visitDate: new Date(form.created_at),
    overallScore: score,
    categoryScores: catScores,
    shortCode: form.short_code,
  });

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";
  const reportUrl = form.report_url || `${baseUrl}/r/${form.short_code}`;

  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const whatsappLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(
        `Hola, tengo una duda sobre el reporte completo de ${client?.name ?? ""} (código ${form.short_code}).`
      )}`
    : null;

  await sendFullReportEmail({
    to: recipientEmail,
    businessName: client?.name || "Negocio",
    score,
    reportUrl,
    whatsappLink,
    pdfBuffer,
    pdfFilename: `reporte-completo-${form.short_code}.pdf`,
  });
}

// MercadoPago a veces llama con GET a la misma notification_url
// (depende de configuracion); respondemos igual para evitar reintentos.
export async function GET(req: NextRequest) {
  return POST(req);
}
