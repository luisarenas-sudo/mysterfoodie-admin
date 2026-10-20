import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { takeVisitRequest } from "@/lib/visitRequests";

/**
 * Un Shopper o un sibarita toma una solicitud de la bolsa: las que nadie asignó (sibaritas desde 3 h, Shoppers desde 5 h)
 * y, solo los Shoppers, las de los días 4 y 5 desde que se asignaron.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("agente", "sibarita");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como Shopper o sibarita" }, { status: 401 });
  }
  const { id } = await params;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const out = await takeVisitRequest(getSupabaseServiceClient(), { requestId: id, foodieId: session.userId, baseUrl });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true });
}
