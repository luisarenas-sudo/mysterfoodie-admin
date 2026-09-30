/**
 * Integracion con MercadoPago (Checkout Pro) para cobrar el reporte
 * completo desde el link publico del reporte (/r/[shortCode]). Requiere
 * la variable de entorno MERCADOPAGO_ACCESS_TOKEN (Access Token de
 * produccion, obtenido en el panel de MercadoPago > Tus integraciones).
 *
 * Flujo:
 * 1. GET /api/checkout?shortCode=xxx crea una "preference" (createPaymentPreference)
 *    y redirige al comprador al init_point (la pasarela de pago hospedada por MercadoPago).
 * 2. MercadoPago llama a notification_url (POST /api/mercadopago/webhook) cuando el
 *    pago cambia de estado. El webhook vuelve a consultar el pago directamente
 *    con getPayment() (nunca confia en el body del webhook) y, si esta aprobado,
 *    desbloquea forms.report_unlocked_at para ese external_reference (form.id).
 */

const MP_API_URL = "https://api.mercadopago.com";

export const FULL_REPORT_PRICE_MXN = Number(process.env.FULL_REPORT_PRICE_MXN) || 850;

export type CreatePreferenceResult =
  | { ok: true; preferenceId: string; initPoint: string }
  | { ok: false; error: string };

export async function createPaymentPreference(opts: {
  title: string;
  price: number;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
  /** Precarga nombre/correo en el checkout de MercadoPago si el comprador ya los escribió en /r/[shortCode]. */
  payer?: { name?: string; email?: string };
}): Promise<CreatePreferenceResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, error: "MERCADOPAGO_ACCESS_TOKEN no configurada" };
  }

  try {
    const res = await fetch(`${MP_API_URL}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: opts.title,
            quantity: 1,
            unit_price: opts.price,
            currency_id: "MXN",
          },
        ],
        external_reference: opts.externalReference,
        payer:
          opts.payer && (opts.payer.name || opts.payer.email)
            ? { name: opts.payer.name || undefined, email: opts.payer.email || undefined }
            : undefined,
        back_urls: {
          success: opts.successUrl,
          failure: opts.failureUrl,
          pending: opts.pendingUrl,
        },
        auto_return: "approved",
        notification_url: opts.notificationUrl,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `MercadoPago respondio ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { id?: string; init_point?: string };
    if (!data.id || !data.init_point) {
      return { ok: false, error: "MercadoPago no devolvio id/init_point" };
    }

    return { ok: true, preferenceId: data.id, initPoint: data.init_point };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
};

/**
 * Consulta el estado real de un pago directamente con la API de
 * MercadoPago (nunca confiar solo en el body de la notificacion del
 * webhook, que puede ser falsificado por un tercero).
 */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const res = await fetch(`${MP_API_URL}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as MercadoPagoPayment;
  } catch {
    return null;
  }
}
