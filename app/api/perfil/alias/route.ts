import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isAliasStyle } from "@/lib/alias";
import { ALIAS_MAX_ATTEMPTS, changeAlias, confirmAlias, getMyAlias, proposeAlias, suggestAlias } from "@/lib/aliasStore";

/**
 * Nombre anónimo de la persona que inicia sesión (cualquier miembro del equipo).
 *
 * Perfil NUEVO (capped): lo elige una sola vez y con tope de 3 intentos; después queda fijo para siempre.
 *   POST { style, preview: true } -> gasta un intento y propone un nombre
 *   POST { alias }                -> se queda con uno de los propuestos (fijo)
 * Perfil que YA EXISTÍA (no capped): puede verlo y cambiarlo sin tope.
 *   POST { style, preview: true } -> propone uno libre (sin gastar nada)
 *   POST { style, alias? }        -> lo cambia (el anterior sigue funcionando en su liga de invitación)
 */
export async function GET() {
  let me;
  try {
    me = await requireRole("admin", "sibarita", "agente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const mine = await getMyAlias(getSupabaseServiceClient(), me.userId);
  return NextResponse.json({ alias: mine.alias, capped: mine.capped, rollsUsed: mine.rollsUsed, max: ALIAS_MAX_ATTEMPTS, proposals: mine.proposals });
}

export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireRole("admin", "sibarita", "agente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let body: { style?: unknown; alias?: unknown; preview?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const db = getSupabaseServiceClient();
  const mine = await getMyAlias(db, me.userId);

  if (mine.capped) {
    // Perfil nuevo: una sola vez, 3 intentos.
    if (mine.alias) return NextResponse.json({ ok: true, alias: mine.alias, existing: true });
    if (body.preview === true) {
      if (!isAliasStyle(body.style)) return NextResponse.json({ error: "Elige un estilo" }, { status: 400 });
      const out = await proposeAlias(db, me.userId, body.style);
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
      return NextResponse.json(out);
    }
    if (typeof body.alias !== "string") return NextResponse.json({ error: "Elige un nombre" }, { status: 400 });
    const out = await confirmAlias(db, me.userId, body.alias);
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json({ ok: true, alias: out.alias });
  }

  // Perfil que ya existía: sin tope.
  if (!isAliasStyle(body.style)) return NextResponse.json({ error: "Elige un estilo" }, { status: 400 });
  if (body.preview === true) return NextResponse.json({ ok: true, alias: await suggestAlias(db, body.style) });
  const out = await changeAlias(db, me.userId, body.style, typeof body.alias === "string" ? body.alias : null);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
  return NextResponse.json({ ok: true, alias: out.alias });
}
