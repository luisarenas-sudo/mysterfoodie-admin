import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { CUISINES, DISHES, MIN_CUISINES, MIN_DISHES } from "@/lib/foodCatalog";
import { isValidPostalCode } from "@/lib/zonas";
import { BLOCK_BY_KEY, isBlockComplete, isBlockKey, sanitizePersona, type BlockKey } from "@/lib/personaCatalog";

/**
 * Datos que alimentan el perfil anónimo de quien inicia sesión y qué bloques comparte (y por lo tanto cuánto puede ganar).
 * PATCH { postalCode, cuisines, dishes, persona, shareBlocks }
 */
export async function PATCH(req: NextRequest) {
  let me;
  try {
    me = await requireRole("admin", "sibarita", "agente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as {
    postalCode?: unknown; cuisines?: unknown; dishes?: unknown; persona?: unknown; shareBlocks?: unknown;
  } | null;
  if (!b) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const postalCode = typeof b.postalCode === "string" ? b.postalCode.trim() : "";
  const pick = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];
  const cuisines = pick(b.cuisines, CUISINES.map((c) => c.key));
  const dishes = pick(b.dishes, DISHES.map((d) => d.key));
  const persona = sanitizePersona(b.persona);
  const shareBlocks: BlockKey[] = Array.isArray(b.shareBlocks) ? [...new Set((b.shareBlocks as unknown[]).filter(isBlockKey))] : [];

  // El código postal y los gustos solo son obligatorios si se comparte el bloque que los usa (Sector, Gustos y palabras).
  if (postalCode && !isValidPostalCode(postalCode)) return NextResponse.json({ error: "El código postal debe tener 5 dígitos." }, { status: 400 });
  if (shareBlocks.includes("sector") && !isValidPostalCode(postalCode)) return NextResponse.json({ error: "Escribe tu código postal (5 dígitos) para compartir el Sector." }, { status: 400 });
  if (shareBlocks.includes("gustos") && cuisines.length < MIN_CUISINES) return NextResponse.json({ error: "Elige al menos un tipo de cocina para compartir tus gustos." }, { status: 400 });
  if (shareBlocks.includes("gustos") && dishes.length < MIN_DISHES) return NextResponse.json({ error: `Elige al menos ${MIN_DISHES} platillos para compartir tus gustos.` }, { status: 400 });
  for (const k of shareBlocks) {
    if (!isBlockComplete(k, persona)) {
      return NextResponse.json({ error: `Para compartir «${BLOCK_BY_KEY[k].label}» contesta todas sus preguntas.` }, { status: 400 });
    }
  }

  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("profiles")
    .update({ postal_code: postalCode || null, food_cuisines: cuisines, food_dishes: dishes, persona, share_blocks: shareBlocks })
    .eq("id", me.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
