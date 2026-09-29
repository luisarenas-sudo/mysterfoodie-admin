import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { createPaymentPreference, FULL_REPORT_PRICE_MXN } from "@/lib/mercadopago";

/**
 * Punto de entrada del boton "Comprar reporte completo" en /r/[shortCode].
 * Es un GET normal (no un fetch desde el cliente) para poder ser un link
 * <a href="/api/checkout?shortCode=..."> plano: crea la preference en
 * MercadoPago y redirige de una vez a la pasarela de pago (init_point).
 */
export async function GET(req: NextRequest) {
  const shortCode = req.nextUrl.searchParams.get("shortCode");
  if (!shortCode) {
    return NextResponse.json({ error: "Falta shortCode" }, { status: 400 });
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

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, report_unlocked_at")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const reportUrl = `${baseUrl}/r/${shortCode}`;

  // Ya esta pagado: no tiene sentido crear otra preference, regresa
  // directo al reporte (que ya mostrara el detalle completo).
  if (form.report_unlocked_at) {
    return NextResponse.redirect(reportUrl);
  }

  const { data: client } = await db
    .from("clients")
    .select("name")
    .eq("id", form.client_id)
    .maybeSingle();

  const preference = await createPaymentPreference({
    title: `Reporte completo Mystery Shopper - ${client?.name ?? "negocio"}`,
    price: FULL_REPORT_PRICE_MXN,
    externalReference: form.id,
    successUrl: `${reportUrl}?pago=exitoso`,
    failureUrl: `${reportUrl}?pago=fallido`,
    pendingUrl: `${reportUrl}?pago=pendiente`,
    notificationUrl: `${baseUrl}/api/mercadopago/webhook`,
  });

  if (!preference.ok) {
    return NextResponse.redirect(`${reportUrl}?pago=error`);
  }

  await db.from("report_payments").insert({
    form_id: form.id,
    mercadopago_preference_id: preference.preferenceId,
    status: "pending",
    amount: FULL_REPORT_PRICE_MXN,
  });

  return NextResponse.redirect(preference.initPoint);
}
