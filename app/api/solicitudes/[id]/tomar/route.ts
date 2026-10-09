import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { takeVisitRequest } from "@/lib/visitRequests";

/** Un Foodie toma una solicitud de la bolsa abierta (días 4 y 5 desde que se asignó). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("agente");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como Foodie" }, { status: 401 });
  }
  const { id } = await params;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const out = await takeVisitRequest(getSupabaseServiceClient(), { requestId: id, foodieId: session.userId, baseUrl });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true });
}
