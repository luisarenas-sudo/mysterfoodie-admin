import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getAutomation, renderTemplate } from "@/lib/automations";
import { sendTemplatedEmail } from "@/lib/email";

/**
 * Dispara el correo de "asesoría gratuita" (automatización
 * "asesoria_gratuita") para las visitas de AYER (hora CDMX) que
 * todavía no lo reciben. Pensado para llamarse una vez al día a las
 * 8am CDMX desde un Cron Job de Supabase (Database > Cron) apuntando
 * a esta URL con el header `x-cron-secret: ${CRON_SECRET}` -- ver
 * lib/googleCalendar.ts para el resto de la automatización.
 *
 * Protegido por CRON_SECRET en vez de sesión: quien dispara esto es
 * un job programado, no un usuario con cookie de Supabase Auth.
 */

// Mexico eliminó el horario de verano en 2022; CDMX es UTC-6 todo el
// año, así que el offset fijo es seguro (evita depender de una
// librería de zonas horarias solo para esto).
function cdmxDayBoundsUTC(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00-06:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function cdmxDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const automation = await getAutomation("asesoria_gratuita");
  if (!automation) {
    return NextResponse.json({ error: "Automatización 'asesoria_gratuita' no encontrada" }, { status: 500 });
  }
  if (!automation.enabled) {
    return NextResponse.json({ ok: true, skipped: "automation_disabled", sent: 0 });
  }

  const db = getSupabaseServiceClient();

  const todayCdmx = cdmxDateString(new Date());
  const yesterdayCdmx = cdmxDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const { start, end } = cdmxDayBoundsUTC(yesterdayCdmx);
  void todayCdmx;

  // Solo negocios que compraron el reporte detallado (report_unlocked_at):
  // la asesoría gratuita es parte de ese servicio, no se ofrece a todos.
  const { data: forms, error } = await db
    .from("forms")
    .select("id, short_code, client_id, created_at")
    .is("followup_sent_at", null)
    .not("report_unlocked_at", "is", null)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!forms || forms.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const results: { formId: string; status: string }[] = [];

  for (const form of forms) {
    const { data: client } = await db
      .from("clients")
      .select("name, email")
      .eq("id", form.client_id)
      .maybeSingle();

    if (!client?.email) {
      results.push({ formId: form.id, status: "sin_correo" });
      continue;
    }

    const agendaUrl = `${baseUrl.replace(/\/$/, "")}/agendar/${form.short_code}`;
    const subject = renderTemplate(automation.subjectTemplate, { negocio: client.name });
    const body = renderTemplate(automation.bodyTemplate, { negocio: client.name, link_agenda: agendaUrl });

    const outcome = await sendTemplatedEmail({ to: client.email, subject, bodyText: body });

    await db.from("email_confirmations").insert({
      form_id: form.id,
      recipient_email: client.email,
      subject,
      status: outcome.status,
      provider_id: outcome.providerId || null,
      error: outcome.error || null,
    });

    if (outcome.status !== "failed") {
      await db.from("forms").update({ followup_sent_at: new Date().toISOString() }).eq("id", form.id);
    }

    results.push({ formId: form.id, status: outcome.status });
  }

  return NextResponse.json({ ok: true, sent: results.length, results });
}
