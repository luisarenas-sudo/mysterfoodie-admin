import { getSupabaseServiceClient } from "@/lib/supabase";
import { getProfileOffer, type ProfileOffer } from "@/lib/mysterfoodieProfile";
import { BLOCK_BY_KEY, ID_BLOCKS, PASSPORT_BLOCKS, TIERS, earningsForBlocks, type BlockKey, type TierKey } from "@/lib/personaCatalog";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export type BuyableProfile = {
  formId: string;
  mysterfoodieId: string;
  alias: string;
  rankLabel: string;
  visitDate: string;
  /** Nivel más alto que el negocio ya tiene de esta persona. */
  owned: TierKey | null;
  idAvailable: boolean;
  passportAvailable: boolean;
};

/** Niveles ya pagados por un negocio de un MysterFoodie. */
export async function getOwnedTiers(clientId: string, mysterfoodieId: string): Promise<Set<TierKey>> {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from("profile_purchases")
    .select("tier")
    .eq("client_id", clientId)
    .eq("mysterfoodie_id", mysterfoodieId)
    .eq("status", "approved");
  return new Set((data ?? []).map((r) => r.tier as TierKey));
}

/** Nivel más alto que se puede ver (Passport incluye ID). */
export function highestTier(owned: Set<TierKey>): TierKey | null {
  return owned.has("passport") ? "passport" : owned.has("id") ? "id" : null;
}

/** Cuánto cuesta `tier` para quien ya tiene `owned`: la mejora de ID a Passport solo cobra la diferencia. */
export function priceFor(tier: TierKey, owned: Set<TierKey>): number {
  if (tier === "passport" && owned.has("id")) return TIERS.passport.price - TIERS.id.price;
  return TIERS[tier].price;
}

/** Bloques que se venden en esta compra (lo que el MysterFoodie comparte hoy y entra en el nivel), sin repetir lo ya comprado. */
export function blocksForPurchase(offer: ProfileOffer, tier: TierKey, owned: Set<TierKey>): BlockKey[] {
  const wanted: BlockKey[] = tier === "passport" ? (owned.has("id") ? PASSPORT_BLOCKS : [...ID_BLOCKS, ...PASSPORT_BLOCKS]) : ID_BLOCKS;
  return wanted.filter((k) => offer.shared.includes(k));
}

/**
 * Perfiles que un negocio puede comprar: los MysterFoodies (con alias) que hicieron visitas a ese negocio cuyo reporte
 * completo ya está desbloqueado (pagado o por plan) y que comparten al menos un bloque. Un perfil por persona.
 */
export async function listBuyableProfiles(clientId: string): Promise<BuyableProfile[]> {
  const db = getSupabaseServiceClient();
  const { data: forms } = await db
    .from("forms")
    .select("id, created_by, created_at, report_unlocked_at, plan_id")
    .eq("client_id", clientId)
    .not("created_by", "is", null)
    .order("created_at", { ascending: false });
  const unlocked = (forms ?? []).filter((f) => f.report_unlocked_at || f.plan_id);
  if (unlocked.length === 0) return [];

  const seen = new Set<string>();
  const out: BuyableProfile[] = [];
  for (const f of unlocked) {
    const id = f.created_by as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const offer = await getProfileOffer(id);
    if (!offer || !offer.idAvailable) continue;
    out.push({
      formId: f.id,
      mysterfoodieId: id,
      alias: offer.alias,
      rankLabel: offer.rankLabel,
      visitDate: f.created_at,
      owned: highestTier(await getOwnedTiers(clientId, id)),
      idAvailable: offer.idAvailable,
      passportAvailable: offer.passportAvailable,
    });
  }
  return out;
}

/**
 * Cierra una compra cuando MercadoPago la confirma: la marca aprobada y, una sola vez, le abona a la persona lo que ganó
 * por los bloques vendidos (profile_earnings). Idempotente: el webhook puede llegar varias veces.
 */
export async function settleProfilePurchase(
  db: Db,
  purchaseId: string,
  payment: { id: string | number; status?: string | null; transaction_amount?: number | null }
): Promise<void> {
  const { data: purchase } = await db.from("profile_purchases").select("id, mysterfoodie_id, client_id, status, blocks, tier, price_amount, platform_fee").eq("id", purchaseId).maybeSingle();
  if (!purchase) return;
  const patch: Record<string, string | number | null> = {
    mercadopago_payment_id: String(payment.id),
    status: payment.status ?? "pending",
    amount: payment.transaction_amount ?? null,
  };
  const approved = payment.status === "approved";
  if (approved && purchase.status !== "approved") patch.paid_at = new Date().toISOString();
  if (purchase.status === "approved" && !approved) return; // nunca degradar una compra ya cobrada
  const { error } = await db.from("profile_purchases").update(patch).eq("id", purchaseId);
  if (error) {
    console.error("No se pudo actualizar la compra del perfil:", error.message);
    return;
  }
  if (approved) {
    const blocks = ((purchase.blocks as string[]) ?? []).filter((k): k is BlockKey => k in BLOCK_BY_KEY);
    const amount = earningsForBlocks(blocks);
    if (amount > 0) {
      await db
        .from("profile_earnings")
        .upsert(
          {
            purchase_id: purchaseId,
            mysterfoodie_id: purchase.mysterfoodie_id,
            amount,
            blocks,
            // Foto de la venta para el detalle mensual: precio del perfil, cargo por uso de la plataforma, nivel y negocio.
            sale_price: purchase.price_amount ?? null,
            platform_fee: purchase.platform_fee ?? 0,
            tier: purchase.tier ?? null,
            client_id: purchase.client_id ?? null,
          },
          { onConflict: "purchase_id", ignoreDuplicates: true }
        );
    }
  }
}
