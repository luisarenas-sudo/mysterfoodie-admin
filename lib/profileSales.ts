import { getSupabaseServiceClient } from "./supabase";
import { CDMX_OFFSET, shiftMonth } from "./months";
import { BLOCK_BY_KEY, TIER_INCREMENT, type BlockKey, type TierKey } from "./personaCatalog";

/** Una venta de perfil anónimo (ID o Passport) y lo que le tocó al MysterFoodie, para el detalle mensual de Finanzas. */
export type ProfileSale = {
  id: string;
  mysterfoodieId: string;
  mysterfoodieName: string;
  soldAt: string;
  negocio: string;
  tier: TierKey | null;
  /** Precio del perfil (sin cargo). null en ventas anteriores al cargo por uso de la plataforma. */
  price: number | null;
  /** Cargo por uso de la plataforma que pagó el negocio (no sale de la parte del MysterFoodie). */
  fee: number;
  /** Lo que gana el MysterFoodie por esta venta. */
  share: number;
  status: "pendiente" | "pagado";
  /** Desglose por bloque compartido. */
  blocks: { key: BlockKey; label: string; amount: number }[];
};

export async function getMonthProfileSales(month: string, onlyUserId?: string): Promise<ProfileSale[]> {
  const db = getSupabaseServiceClient();
  const start = new Date(`${month}-01T00:00:00${CDMX_OFFSET}`).toISOString();
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00${CDMX_OFFSET}`).toISOString();
  let q = db
    .from("profile_earnings")
    .select("id, mysterfoodie_id, amount, blocks, status, created_at, sale_price, platform_fee, tier, client_id")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });
  if (onlyUserId) q = q.eq("mysterfoodie_id", onlyUserId);
  const { data } = await q;
  const rows = data ?? [];
  const clientIds = [...new Set(rows.map((r) => r.client_id as string | null).filter((x): x is string => !!x))];
  const { data: clients } = clientIds.length ? await db.from("clients").select("id, name").in("id", clientIds) : { data: [] as { id: string; name: string }[] };
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const personIds = [...new Set(rows.map((r) => r.mysterfoodie_id as string))];
  const { data: people } = personIds.length ? await db.from("profiles").select("id, full_name, alias").in("id", personIds) : { data: [] as { id: string; full_name: string | null; alias: string | null }[] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.alias || "MysterFoodie"]));
  return rows.map((r) => {
    const keys = ((r.blocks as string[]) ?? []).filter((k): k is BlockKey => k in BLOCK_BY_KEY);
    return {
      id: r.id as string,
      mysterfoodieId: r.mysterfoodie_id as string,
      mysterfoodieName: who.get(r.mysterfoodie_id as string) ?? "MysterFoodie",
      soldAt: r.created_at as string,
      negocio: (r.client_id && names.get(r.client_id as string)) || "Negocio",
      tier: (r.tier as TierKey | null) ?? null,
      price: r.sale_price === null || r.sale_price === undefined ? null : Number(r.sale_price),
      fee: Number(r.platform_fee ?? 0),
      share: Number(r.amount),
      status: (r.status as "pendiente" | "pagado") ?? "pendiente",
      blocks: keys.map((k) => ({ key: k, label: BLOCK_BY_KEY[k].label, amount: Math.round((BLOCK_BY_KEY[k].pct / 100) * TIER_INCREMENT[BLOCK_BY_KEY[k].tier] * 100) / 100 })),
    };
  });
}
