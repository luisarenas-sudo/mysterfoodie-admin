import { getSupabaseServiceClient } from "./supabase";
import { aliasSlug, isAliasStyle, isValidAlias, pickAlias, type AliasStyle } from "./alias";
import { createShortLink } from "./shortio";

type Db = ReturnType<typeof getSupabaseServiceClient>;

export const appBaseUrl = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.mysterfoodie.com";

export type MyAlias = { alias: string | null; style: AliasStyle | null; slug: string | null; inviteUrl: string | null };

export async function getMyAlias(db: Db, userId: string): Promise<MyAlias> {
  const { data } = await db.from("profiles").select("alias, alias_style, alias_slug, invite_short_url").eq("id", userId).maybeSingle();
  return {
    alias: (data?.alias as string | null) ?? null,
    style: isAliasStyle(data?.alias_style) ? data?.alias_style : null,
    slug: (data?.alias_slug as string | null) ?? null,
    inviteUrl: (data?.invite_short_url as string | null) ?? null,
  };
}

async function takenSlugs(db: Db): Promise<Set<string>> {
  const { data } = await db.from("profiles").select("alias_slug").not("alias_slug", "is", null);
  return new Set((data || []).map((r) => r.alias_slug as string));
}

/** Propone un alias libre del estilo (no lo guarda). */
export async function suggestAlias(db: Db, style: AliasStyle): Promise<string> {
  return pickAlias(style, await takenSlugs(db));
}

/** Guarda el alias de una persona (una sola vez: queda fijo). `alias` opcional: si no viene se elige uno al azar. */
export async function assignAlias(
  db: Db,
  userId: string,
  style: AliasStyle,
  alias?: string | null
): Promise<{ ok: true; alias: string } | { ok: false; error: string }> {
  const current = await getMyAlias(db, userId);
  if (current.alias) return { ok: true, alias: current.alias };
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await takenSlugs(db);
    const chosen = alias && attempt === 0 && isValidAlias(style, alias) && !taken.has(aliasSlug(alias)) ? alias : pickAlias(style, taken);
    const { error } = await db
      .from("profiles")
      .update({ alias: chosen, alias_style: style, alias_slug: aliasSlug(chosen) })
      .eq("id", userId)
      .is("alias", null);
    if (!error) return { ok: true, alias: chosen };
    if (!/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message };
  }
  return { ok: false, error: "No se pudo asignar un nombre anónimo. Intenta de nuevo." };
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
