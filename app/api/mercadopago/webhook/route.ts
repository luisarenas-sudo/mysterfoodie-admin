import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getPayment } from "@/lib/mercadopago";
import { deliverFullReportEmail } from "@/lib/fullReportDelivery";

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
        await deliverFullReportEmail(db, unlockedForm, { recipientEmail: payment.payer?.email });
      } catch (err) {
        console.error("No se pudo mandar el correo del reporte completo:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// MercadoPago a veces llama con GET a la misma notification_url
// (depende de configuracion); respondemos igual para evitar reintentos.
export async function GET(req: NextRequest) {
  return POST(req);
}
