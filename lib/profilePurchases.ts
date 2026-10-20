import { getSupabaseServiceClient } from "@/lib/supabase";

export type BuyableProfile = {
  formId: string;
  mysterfoodieId: string;
  alias: string;
  rankLabel: string;
  visitDate: string;
  purchased: boolean;
};

/** ¿Esta cuenta de negocio ya compró el perfil de ese MysterFoodie? */
export async function hasPurchasedProfile(clientId: string, mysterfoodieId: string): Promise<boolean> {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from("profile_purchases")
    .select("id")
    .eq("client_id", clientId)
    .eq("mysterfoodie_id", mysterfoodieId)
    .eq("status", "approved")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Perfiles que un negocio puede comprar: los MysterFoodies (con alias) que hicieron visitas a ese negocio cuyo reporte
 * completo ya está desbloqueado (pagado o por plan). Un perfil por persona, ligado a su visita más reciente.
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

  const ids = [...new Set(unlocked.map((f) => f.created_by as string))];
  const { data: people } = await db.from("profiles").select("id, alias, role").in("id", ids).not("alias", "is", null);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const { data: paid } = await db
    .from("profile_purchases")
    .select("mysterfoodie_id")
    .eq("client_id", clientId)
    .eq("status", "approved");
  const paidSet = new Set((paid ?? []).map((r) => r.mysterfoodie_id));

  const seen = new Set<string>();
  const out: BuyableProfile[] = [];
  for (const f of unlocked) {
    const id = f.created_by as string;
    const p = byId.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    out.push({
      formId: f.id,
      mysterfoodieId: id,
      alias: p.alias as string,
      rankLabel: p.role === "sibarita" ? "Sibarita" : "Shopper",
      visitDate: f.created_at,
      purchased: paidSet.has(id),
    });
  }
  return out;
}
