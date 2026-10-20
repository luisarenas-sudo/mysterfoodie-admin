import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { approveApplication, rejectApplication } from "@/lib/aspirantes";

/** El Master Chef aprueba o rechaza a un aspirante a Shopper. */
export async function PATCH(req: NextRequest) {
  let me;
  try {
    me = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let body: { id?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (typeof body.id !== "string" || (body.action !== "aprobar" && body.action !== "rechazar")) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const db = getSupabaseServiceClient();
  if (body.action === "rechazar") {
    const ok = await rejectApplication(db, body.id, me.userId);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se pudo rechazar" }, { status: 500 });
  }
  const out = await approveApplication(db, body.id, me.userId);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({
    ok: true,
    emailStatus: out.emailStatus,
    warning: out.emailStatus === "sent" ? null : "La cuenta quedó creada, pero el correo de acceso no salió. Reenvía la invitación desde Usuarios.",
  });
}
