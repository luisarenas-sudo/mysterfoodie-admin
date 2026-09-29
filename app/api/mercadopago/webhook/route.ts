import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getPayment } from "@/lib/mercadopago";

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
    await db
      .from("forms")
      .update({ report_unlocked_at: new Date().toISOString() })
      .eq("id", formId)
      .is("report_unlocked_at", null);
  }

  return NextResponse.json({ ok: true });
}

// MercadoPago a veces llama con GET a la misma notification_url
// (depende de configuracion); respondemos igual para evitar reintentos.
export async function GET(req: NextRequest) {
  return POST(req);
}
