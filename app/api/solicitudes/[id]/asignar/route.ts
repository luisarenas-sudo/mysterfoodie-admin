import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { assignVisitRequest } from "@/lib/visitRequests";

/** El Master Chef asigna (o reasigna) una solicitud de visita gratis a un sibarita, un Foodie o a sí mismo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Necesitas iniciar sesión como admin" }, { status: 401 });
  }
  const { id } = await params;
  let body: { assignedTo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const assignedTo = body.assignedTo?.trim();
  if (!assignedTo) return NextResponse.json({ error: "Elige a quién asignarla" }, { status: 400 });

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const out = await assignVisitRequest(getSupabaseServiceClient(), {
    requestId: id,
    assigneeId: assignedTo,
    assignedBy: session.userId,
    baseUrl,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, email: out.email });
}
