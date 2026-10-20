import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { CUISINES, DISHES, MIN_CUISINES, MIN_DISHES } from "@/lib/foodCatalog";
import { isValidPostalCode } from "@/lib/zonas";

/** Datos que alimentan el perfil anónimo de quien inicia sesión: código postal y gustos. PATCH { postalCode, cuisines, dishes } */
export async function PATCH(req: NextRequest) {
  let me;
  try {
    me = await requireRole("admin", "sibarita", "agente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as { postalCode?: unknown; cuisines?: unknown; dishes?: unknown } | null;
  if (!b) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const postalCode = typeof b.postalCode === "string" ? b.postalCode.trim() : "";
  const pick = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];
  const cuisines = pick(b.cuisines, CUISINES.map((c) => c.key));
  const dishes = pick(b.dishes, DISHES.map((d) => d.key));

  if (!isValidPostalCode(postalCode)) return NextResponse.json({ error: "Escribe tu código postal (5 dígitos)." }, { status: 400 });
  if (cuisines.length < MIN_CUISINES) return NextResponse.json({ error: "Elige al menos un tipo de cocina." }, { status: 400 });
  if (dishes.length < MIN_DISHES) return NextResponse.json({ error: `Elige al menos ${MIN_DISHES} platillos.` }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { error } = await db.from("profiles").update({ postal_code: postalCode, food_cuisines: cuisines, food_dishes: dishes }).eq("id", me.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
