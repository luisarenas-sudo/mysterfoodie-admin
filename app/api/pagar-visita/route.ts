import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { createPaymentPreference, FULL_REPORT_PRICE_MXN } from "@/lib/mercadopago";

/**
 * Pago en línea de una visita programada (mysterfoodie.com > «Solicita una visita» > «Desbloquear visita asegurada»).
 * GET plano para poder ser una liga (también va en el correo de confirmación): crea la preferencia en Mercado Pago con
 * external_reference "visita:<id>" y redirige a la pasarela. El webhook (settleVisitPayment) marca la solicitud como pagada.
 * El cobro es el precio de la visita ($850, sin IVA agregado; solo se informa el total con IVA por si quieren factura); el consumo se acuerda aparte con el Master Chef.
 */
const SITE = "https://mysterfoodie.com/solicita-visita/";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${SITE}?pago=error`);

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return NextResponse.redirect(`${SITE}?pago=error`);
  }

  const { data: request } = await db.from("visit_requests").select("id, client_id, kind, paid_at").eq("id", id).maybeSingle();
  if (!request || request.kind !== "programada") return NextResponse.redirect(`${SITE}?pago=error`);
  if (request.paid_at) return NextResponse.redirect(`${SITE}?pago=exitoso`);

  const { data: client } = await db.from("clients").select("name, contact_name, email").eq("id", request.client_id as string).maybeSingle();
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const preference = await createPaymentPreference({
      title: `Visita con reporte completo MysterFoodie - ${client?.name ?? "negocio"}`,
      price: FULL_REPORT_PRICE_MXN,
      externalReference: `visita:${request.id}`,
      successUrl: `${SITE}?pago=exitoso`,
      failureUrl: `${SITE}?pago=fallido`,
      pendingUrl: `${SITE}?pago=pendiente`,
      notificationUrl: `${baseUrl}/api/mercadopago/webhook`,
      payer: { name: (client?.contact_name as string | null) ?? undefined, email: (client?.email as string | null) ?? undefined },
    });
    if (!preference.ok) {
      console.error("pagar-visita:", preference.error);
      return NextResponse.redirect(`${SITE}?pago=error`);
    }
    return NextResponse.redirect(preference.initPoint);
  } catch (err) {
    console.error("pagar-visita:", err);
    return NextResponse.redirect(`${SITE}?pago=error`);
  }
}
