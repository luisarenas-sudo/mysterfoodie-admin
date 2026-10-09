import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

/** Datos básicos del perfil propio: nombre y teléfono. */
export async function PATCH(req: NextRequest) {
  let profile;
  try {
    profile = await requireRole("admin", "agente", "sibarita", "cliente");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { fullName?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  if (body.fullName !== undefined) {
    const name = String(body.fullName).trim().replace(/\s+/g, " ");
    if (name.length < 2) return NextResponse.json({ error: "Escribe tu nombre (al menos 2 letras)." }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "El nombre es muy largo (máximo 80 caracteres)." }, { status: 400 });
    patch.full_name = name;
  }
  if (body.phone !== undefined) {
    const raw = String(body.phone).trim();
    if (raw === "") {
      patch.phone = null;
    } else {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ error: "El teléfono debe tener entre 10 y 15 dígitos." }, { status: 400 });
      }
      patch.phone = raw.slice(0, 30);
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const db = getSupabaseServiceClient();
  const { error } = await db.from("profiles").update(patch).eq("id", profile.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
