import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { createPaymentPreference } from "@/lib/mercadopago";
import { getProfileOffer } from "@/lib/mysterfoodieProfile";
import { TIERS, type TierKey } from "@/lib/personaCatalog";
import { blocksForPurchase, getOwnedTiers, priceFor } from "@/lib/profilePurchases";

/**
 * "Comprar perfil" de un MysterFoodie (solo cuentas de negocio): nivel ID ($350) o Passport ($700; $350 si ya tienes el ID).
 * GET /api/mi-negocio/perfil/checkout?formId=<visita>&tier=id|passport -> crea la compra pendiente y redirige a MercadoPago.
 * external_reference = "perfil:<purchaseId>"; el webhook la marca aprobada y le abona sus ganancias al MysterFoodie.
 */
export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get("formId");
  const tier: TierKey = req.nextUrl.searchParams.get("tier") === "passport" ? "passport" : "id";
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

  const offer = await getProfileOffer(form.created_by);
  if (!offer) return NextResponse.redirect(`${baseUrl}/mi-negocio`);
  const available = tier === "passport" ? offer.passportAvailable : offer.idAvailable;
  const owned = await getOwnedTiers(profile.clientId, form.created_by);
  if (!available || owned.has(tier) || (tier === "id" && owned.has("passport"))) return NextResponse.redirect(back);

  const price = priceFor(tier, owned);
  const blocks = blocksForPurchase(offer, tier, owned);

  try {
    const { data: purchase, error } = await db
      .from("profile_purchases")
      .insert({
        client_id: profile.clientId,
        mysterfoodie_id: form.created_by,
        form_id: form.id,
        buyer_id: profile.userId,
        tier,
        blocks,
        status: "pending",
        amount: price,
      })
      .select("id")
      .single();
    if (error || !purchase) return NextResponse.redirect(`${back}?pago=error`);

    const preference = await createPaymentPreference({
      title: `Perfil ${TIERS[tier].label} de ${offer.alias} - MysterFoodie`,
      price,
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
