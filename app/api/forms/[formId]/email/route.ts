import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { sendResultEmailForForm } from "@/lib/resultEmailSend";
import { deliverPlanReportEmail } from "@/lib/fullReportDelivery";
import { logBusinessEvent } from "@/lib/bitacora";

/**
 * Reenvia el correo de resultado de una evaluacion ya guardada, o lo
 * manda a un correo alterno (por si el correo original cae en spam o el
 * cliente no tiene acceso a el). Usado por el boton "Reenviar" y por
 * "Enviar a otro correo" en la pantalla de confirmacion tras guardar
 * una visita.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  let session;
  try {
    session = await requireRole("admin", "agente", "sibarita");
  } catch {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión como agente o admin para reenviar el correo" },
      { status: 401 }
    );
  }

  const { formId } = await params;

  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    // cuerpo vacio (reenvio al correo original) es valido
  }

  const overrideTo = body.to?.trim();
  if (overrideTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideTo)) {
    return NextResponse.json({ error: "El correo alterno no es válido" }, { status: 400 });
  }

  let db;
  try {
    db = getSupabaseServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase no configurado" },
      { status: 500 }
    );
  }

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, overall_score, short_code, report_url, waiter_name, plan_id, created_at, free_demo")
    .eq("id", formId)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
  }

  const { data: client } = await db
    .from("clients")
    .select("name, type, email")
    .eq("id", form.client_id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const recipientEmail = overrideTo || client.email || process.env.ADMIN_EMAIL || "";
  const logResend = () =>
    logBusinessEvent(db, {
      clientId: form.client_id as string,
      kind: "correo_reenvio",
      title: overrideTo ? "Correo de resultado enviado a otro correo" : "Correo de resultado reenviado",
      actorId: session.userId,
      refId: form.id as string,
    });
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No hay correo destino: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado" },
      { status: 400 }
    );
  }

  // Visita de un plan mensual: el negocio ya pagó, así que se reenvía el reporte
  // completo con PDF (no el resumen "gancho" de venta).
  if (form.plan_id || form.free_demo) {
    const { outcome } = await deliverPlanReportEmail(
      db,
      {
        id: form.id,
        overall_score: form.overall_score,
        client_id: form.client_id,
        report_url: form.report_url,
        short_code: form.short_code,
        created_at: form.created_at,
      },
      { to: recipientEmail, demo: Boolean(form.free_demo) }
    );
    await logResend();
    return NextResponse.json({ email: outcome, recipientEmail });
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const emailOutcome = await sendResultEmailForForm(
    db,
    { id: form.id, client_id: form.client_id, overall_score: form.overall_score, short_code: form.short_code, report_url: form.report_url, waiter_name: form.waiter_name, created_at: form.created_at },
    { name: client.name, type: client.type },
    recipientEmail,
    baseUrl
  );

  await logResend();
  return NextResponse.json({
    email: emailOutcome,
    recipientEmail,
  });
}
