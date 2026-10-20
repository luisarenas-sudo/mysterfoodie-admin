import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isAliasStyle } from "@/lib/alias";
import { assignAlias, getMyAlias, suggestAlias } from "@/lib/aliasStore";

/**
 * Nombre anónimo de la persona que inicia sesión (cualquier miembro del equipo).
 * GET  -> { alias }
 * POST { style, preview: true }  -> propone uno libre sin guardarlo
 * POST { style, alias? }         -> lo guarda (queda fijo; si ya tenía, devuelve el que tiene)
 */
export async function GET() {
  let me;
  try {
    me = await requireRole("admin", "sibarita", "agente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const mine = await getMyAlias(getSupabaseServiceClient(), me.userId);
  return NextResponse.json({ alias: mine.alias });
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
  if (!isAliasStyle(body.style)) return NextResponse.json({ error: "Elige un estilo" }, { status: 400 });
  const db = getSupabaseServiceClient();
  const mine = await getMyAlias(db, me.userId);
  if (mine.alias) return NextResponse.json({ ok: true, alias: mine.alias, existing: true });
  if (body.preview === true) return NextResponse.json({ ok: true, alias: await suggestAlias(db, body.style) });
  const out = await assignAlias(db, me.userId, body.style, typeof body.alias === "string" ? body.alias : null);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 500 });
  return NextResponse.json({ ok: true, alias: out.alias });
}
