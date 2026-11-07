import { rateLimit } from "@/lib/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { secureVisitRequest } from "@/lib/visitRequests";

const SLOTS = ["Desayuno", "Comida", "Cena", "Me da igual"] as const;

/**
 * «Asegura tu visita» (página /asegurar/<id>, a la que llega el negocio desde el correo de alta demanda): recibe el día y el
 * horario, pasa la solicitud a programada y devuelve la liga de pago de Mercado Pago.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "asegurar", 15, 3600000);
  if (limited) return limited;
  let id = "";
  let date = "";
  let slot = "";
  try {
    const body = (await req.json()) as { id?: unknown; date?: unknown; slot?: unknown };
    id = typeof body.id === "string" ? body.id.trim() : "";
    date = typeof body.date === "string" ? body.date.trim() : "";
    slot = typeof body.slot === "string" ? body.slot.trim() : "";
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !(SLOTS as readonly string[]).includes(slot)) return NextResponse.json({ error: "Elige un día y un horario" }, { status: 400 });
  const chosen = new Date(`${date}T12:00:00-06:00`).getTime();
  const now = Date.now();
  if (Number.isNaN(chosen) || chosen < now || chosen > now + 120 * 86400000) {
    return NextResponse.json({ error: "Elige una fecha a partir de mañana y dentro de los próximos 4 meses" }, { status: 400 });
  }

  const out = await secureVisitRequest(getSupabaseServiceClient(), id, `${m[3]}/${m[2]}/${m[1]} · ${slot}`);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, payUrl: `/api/pagar-visita?id=${id}` });
}
