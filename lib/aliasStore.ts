import { getSupabaseServiceClient } from "./supabase";
import { aliasSlug, isAliasStyle, isValidAlias, pickAlias, type AliasStyle } from "./alias";
import { createShortLink } from "./shortio";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export const appBaseUrl = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";

export const ALIAS_MAX_ATTEMPTS = 3;

export type MyAlias = {
  alias: string | null;
  style: AliasStyle | null;
  slug: string | null;
  inviteUrl: string | null;
  /** true = perfil nuevo: elige su nombre una sola vez, con 3 intentos. false = perfil que ya existía: puede cambiarlo. */
  capped: boolean;
  rollsUsed: number;
  proposals: string[];
};

export async function getMyAlias(db: Db, userId: string): Promise<MyAlias> {
  const { data } = await db
    .from("profiles")
    .select("alias, alias_style, alias_slug, invite_short_url, alias_capped, alias_rolls, alias_proposals")
    .eq("id", userId)
    .maybeSingle();
  return {
    alias: (data?.alias as string | null) ?? null,
    style: isAliasStyle(data?.alias_style) ? data?.alias_style : null,
    slug: (data?.alias_slug as string | null) ?? null,
    inviteUrl: (data?.invite_short_url as string | null) ?? null,
    capped: data?.alias_capped === true,
    rollsUsed: Number(data?.alias_rolls ?? 0),
    proposals: Array.isArray(data?.alias_proposals) ? (data?.alias_proposals as string[]) : [],
  };
}

/** Ligas ya usadas: los nombres actuales y los anteriores (esos siguen apuntando a su dueño, nadie más los toma). */
async function takenSlugs(db: Db): Promise<Set<string>> {
  const { data } = await db.from("profiles").select("alias_slug, old_slugs");
  const set = new Set<string>();
  for (const r of data || []) {
    if (r.alias_slug) set.add(r.alias_slug as string);
    for (const o of (r.old_slugs as string[] | null) || []) set.add(o);
  }
  return set;
}

/** Perfil dueño de una liga de invitación: por su nombre actual o por uno anterior (las ligas viejas siguen funcionando). */
export async function findProfileBySlug<T extends string>(db: Db, slug: string, columns: T) {
  const clean = slug.toLowerCase();
  if (!/^[a-z0-9-]{1,60}$/.test(clean)) return null;
  const direct = await db.from("profiles").select(columns).eq("alias_slug", clean).maybeSingle();
  if (direct.data) return direct.data as unknown as Record<string, unknown>;
  const old = await db.from("profiles").select(columns).contains("old_slugs", [clean]).maybeSingle();
  return (old.data as unknown as Record<string, unknown> | null) ?? null;
}

/** Propone un alias libre del estilo (no lo guarda ni gasta intento). Solo para perfiles que ya existían. */
export async function suggestAlias(db: Db, style: AliasStyle): Promise<string> {
  return pickAlias(style, await takenSlugs(db));
}

function styleOfAlias(alias: string): AliasStyle | null {
  for (const s of ["femenino", "masculino", "no_binarie"] as const) if (isValidAlias(s, alias)) return s;
  return null;
}

export type ProposeResult =
  | { ok: true; alias: string; rollsUsed: number; remaining: number; proposals: string[] }
  | { ok: false; error: string; locked?: boolean };

/** Perfil nuevo: gasta un intento y devuelve un nombre distinto a los anteriores (máximo 3). */
export async function proposeAlias(db: Db, userId: string, style: AliasStyle): Promise<ProposeResult> {
  const mine = await getMyAlias(db, userId);
  if (mine.alias) return { ok: false, error: "Tu nombre ya quedó fijo.", locked: true };
  if (mine.rollsUsed >= ALIAS_MAX_ATTEMPTS) return { ok: false, error: "Ya usaste tus 3 intentos. Elige uno de los que te salieron." };
  const taken = await takenSlugs(db);
  for (const p of mine.proposals) taken.add(aliasSlug(p)); // no repetir los anteriores
  const alias = pickAlias(style, taken);
  const proposals = [...mine.proposals, alias];
  // El intento se cobra solo si nadie más lo gastó en paralelo (doble clic / dos pestañas).
  const { data, error } = await db
    .from("profiles")
    .update({ alias_rolls: mine.rollsUsed + 1, alias_proposals: proposals })
    .eq("id", userId)
    .eq("alias_rolls", mine.rollsUsed)
    .is("alias", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Intenta de nuevo." };
  return { ok: true, alias, rollsUsed: mine.rollsUsed + 1, remaining: ALIAS_MAX_ATTEMPTS - (mine.rollsUsed + 1), proposals };
}

/** Perfil nuevo: se queda con uno de sus (máx. 3) nombres propuestos. Queda fijo para siempre. */
export async function confirmAlias(
  db: Db,
  userId: string,
  alias: string
): Promise<{ ok: true; alias: string } | { ok: false; error: string }> {
  const mine = await getMyAlias(db, userId);
  if (mine.alias) return { ok: true, alias: mine.alias };
  if (!mine.proposals.includes(alias)) return { ok: false, error: "Ese nombre no es de los que te salieron." };
  const style = styleOfAlias(alias);
  if (!style) return { ok: false, error: "Nombre inválido." };
  const { data, error } = await db
    .from("profiles")
    .update({ alias, alias_style: style, alias_slug: aliasSlug(alias) })
    .eq("id", userId)
    .is("alias", null)
    .select("id");
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "Ese nombre se acaba de ocupar. Usa otro de tus intentos." };
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) return { ok: false, error: "Intenta de nuevo." };
  return { ok: true, alias };
}

/** Perfil que ya existía: pone o cambia su nombre (sin tope). El anterior sigue llevando a su liga de invitación. */
export async function changeAlias(
  db: Db,
  userId: string,
  style: AliasStyle,
  alias?: string | null
): Promise<{ ok: true; alias: string } | { ok: false; error: string }> {
  const mine = await getMyAlias(db, userId);
  if (mine.capped) return { ok: false, error: "Tu nombre no se puede cambiar." };
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await takenSlugs(db);
    if (mine.slug) taken.delete(mine.slug);
    const wanted = alias && attempt === 0 && isValidAlias(style, alias) && !taken.has(aliasSlug(alias)) ? alias : null;
    if (alias && attempt === 0 && !wanted) return { ok: false, error: "Ese nombre ya no está disponible." };
    const chosen = wanted ?? pickAlias(style, taken);
    if (mine.slug && aliasSlug(chosen) === mine.slug) return { ok: true, alias: chosen };
    const oldSlugs = mine.slug ? Array.from(new Set([...(await currentOldSlugs(db, userId)), mine.slug])) : await currentOldSlugs(db, userId);
    const { error } = await db
      .from("profiles")
      .update({ alias: chosen, alias_style: style, alias_slug: aliasSlug(chosen), old_slugs: oldSlugs, invite_short_url: null })
      .eq("id", userId)
      .eq("alias_capped", false);
    if (!error) return { ok: true, alias: chosen };
    if (!/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message };
  }
  return { ok: false, error: "No se pudo guardar el nombre. Intenta de nuevo." };
}

async function currentOldSlugs(db: Db, userId: string): Promise<string[]> {
  const { data } = await db.from("profiles").select("old_slugs").eq("id", userId).maybeSingle();
  return (data?.old_slugs as string[] | null) || [];
}

/** Liga fija de invitación: go.mysterfoodie.com/<alias> (o, si Short.io no responde, la liga directa de la app). */
export async function ensureInviteLink(db: Db, userId: string, current: MyAlias): Promise<string | null> {
  if (!current.alias || !current.slug) return null;
  if (current.inviteUrl) return current.inviteUrl;
  const target = `${appBaseUrl().replace(/\/$/, "")}/unete/${current.slug}`;
  const out = await createShortLink(target, { title: `Invitación de ${current.alias}`, path: current.slug });
  if (!out.ok) {
    console.error("invite-link", out.error);
    return target;
  }
  await db.from("profiles").update({ invite_short_url: out.shortURL }).eq("id", userId);
  return out.shortURL;
}
