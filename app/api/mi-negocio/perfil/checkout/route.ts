import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { createPaymentPreference } from "@/lib/mercadopago";
import { MYSTERFOODIE_PROFILE_PRICE_MXN } from "@/lib/mysterfoodieProfile";
import { hasPurchasedProfile } from "@/lib/profilePurchases";

/**
 * "Comprar perfil completo" de un MysterFoodie (solo cuentas de negocio).
 * GET /api/mi-negocio/perfil/checkout?formId=<visita> -> crea la compra pendiente y redirige a MercadoPago.
 * external_reference = "perfil:<purchaseId>"; el webhook la marca aprobada.
 */
export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get("formId");
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const back = `${baseUrl}/mi-negocio/mysterfoodie/${formId ?? ""}`;

  let profile;
  try {
    profile = await requireRole("cliente");
  } catch {
    return NextResponse.redirect(`${baseUrl}/login`);
  }
  if (!formId || !profile.clientId) return NextResponse.redirect(`${baseUrl}/mi-negocio`);

  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, client_id, created_by, report_unlocked_at, plan_id")
    .eq("id", formId)
    .maybeSingle();
  if (!form || form.client_id !== profile.clientId || !form.created_by || !(form.report_unlocked_at || form.plan_id)) {
    return NextResponse.redirect(`${baseUrl}/mi-negocio`);
  }
  const { data: person } = await db.from("profiles").select("alias").eq("id", form.created_by).maybeSingle();
  if (!person?.alias) return NextResponse.redirect(`${baseUrl}/mi-negocio`);

  if (await hasPurchasedProfile(profile.clientId, form.created_by)) return NextResponse.redirect(back);

  try {
    const { data: purchase, error } = await db
      .from("profile_purchases")
      .insert({
        client_id: profile.clientId,
        mysterfoodie_id: form.created_by,
        form_id: form.id,
        buyer_id: profile.userId,
        status: "pending",
        amount: MYSTERFOODIE_PROFILE_PRICE_MXN,
      })
      .select("id")
      .single();
    if (error || !purchase) return NextResponse.redirect(`${back}?pago=error`);

    const preference = await createPaymentPreference({
      title: `Perfil completo de ${person.alias} - MysterFoodie`,
      price: MYSTERFOODIE_PROFILE_PRICE_MXN,
      externalReference: `perfil:${purchase.id}`,
      successUrl: `${back}?pago=exitoso`,
      failureUrl: `${back}?pago=fallido`,
      pendingUrl: `${back}?pago=pendiente`,
      notificationUrl: `${baseUrl}/api/mercadopago/webhook`,
      payer: { email: profile.email },
    });
    if (!preference.ok) return NextResponse.redirect(`${back}?pago=error`);

    await db.from("profile_purchases").update({ mercadopago_preference_id: preference.preferenceId }).eq("id", purchase.id);
    return NextResponse.redirect(preference.initPoint);
  } catch (err) {
    console.error("Error al iniciar la compra del perfil:", err);
    return NextResponse.redirect(`${back}?pago=error`);
  }
}
