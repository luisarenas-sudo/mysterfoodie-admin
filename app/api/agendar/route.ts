import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isSlotStillFree, createCalendarEvent } from "@/lib/googleCalendar";
import { sendTemplatedEmail, formatSlot } from "@/lib/email";
import { getAutomation, renderTemplate } from "@/lib/automations";

type Body = {
  shortCode?: string;
  slotStartISO?: string;
  slotEndISO?: string;
  contactName?: string | null;
  contactEmail?: string;
  contactPhone?: string | null;
};

export async function POST(req: NextRequest) {
  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase no está configurado" }, { status: 500 });
  }

  const body: Body = await req.json();
  const { shortCode, slotStartISO, slotEndISO, contactName, contactEmail, contactPhone } = body;

  if (!shortCode || !slotStartISO || !slotEndISO || !contactEmail) {
    return NextResponse.json({ error: "Faltan datos para agendar" }, { status: 400 });
  }

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, report_unlocked_at")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form) {
    return NextResponse.json({ error: "No se encontró el enlace" }, { status: 404 });
  }
  if (!form.report_unlocked_at) {
    return NextResponse.json(
      { error: "La asesoría gratuita se incluye al obtener el reporte completo." },
      { status: 403 }
    );
  }

  const { data: client } = await db
    .from("clients")
    .select("id, name, phone")
    .eq("id", form.client_id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "No se encontró el negocio" }, { status: 404 });
  }

  // Si no hay teléfono/WhatsApp guardado en el negocio, es obligatorio en este paso.
  const needsPhone = !client.phone?.trim();
  if (needsPhone && !contactPhone?.trim()) {
    return NextResponse.json(
      { error: "Necesitamos un teléfono o WhatsApp para confirmar la cita" },
      { status: 400 }
    );
  }

  const start = new Date(slotStartISO);
  const end = new Date(slotEndISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Horario inválido" }, { status: 400 });
  }

  let stillFree = true;
  try {
    stillFree = await isSlotStillFree(start, end);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo verificar la agenda" },
      { status: 500 }
    );
  }
  if (!stillFree) {
    return NextResponse.json(
      { error: "Ese horario ya no está disponible, elige otro" },
      { status: 409 }
    );
  }

  let calendarEventId: string | null = null;
  try {
    calendarEventId = await createCalendarEvent({
      summary: `Asesoría MysterFoodie - ${client.name}`,
      description: `Asesoría gratuita de 20 min agendada desde el reporte de ${client.name}.`,
      start,
      end,
      attendeeEmail: contactEmail,
      attendeeName: contactName || client.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo crear el evento" },
      { status: 500 }
    );
  }

  await db.from("consultation_bookings").insert({
    form_id: form.id,
    client_id: client.id,
    business_name: client.name,
    contact_email: contactEmail,
    contact_name: contactName || null,
    contact_phone: contactPhone?.trim() || null,
    slot_start: start.toISOString(),
    slot_end: end.toISOString(),
    calendar_event_id: calendarEventId,
  });

  // Termina de alimentar la ficha del negocio con el teléfono/WhatsApp si no lo teníamos.
  if (needsPhone && contactPhone?.trim()) {
    await db.from("clients").update({ phone: contactPhone.trim() }).eq("id", client.id);
  }

  const fechaHora = formatSlot(start, end);
  const templateVars = { negocio: client.name, fecha_hora: fechaHora };

  const [negocioAutomation, adminAutomation] = await Promise.all([
    getAutomation("confirmacion_cita_negocio"),
    getAutomation("confirmacion_cita_admin"),
  ]);

  const defaultSubject = `Asesoría confirmada: ${client.name}`;
  const defaultNegocioBody =
    `Hola equipo de ${client.name},

Tu asesoría gratuita con MysterFoodie quedó agendada para:

${fechaHora}

` +
    `Te llega una invitación de Google Calendar por separado con el enlace de la videollamada.

Saludos,
MysterFoodie`;
  const defaultAdminBody =
    `${client.name} agendó una asesoría gratuita contigo para:

${fechaHora}

` +
    `Te llega una invitación de Google Calendar por separado con el enlace de la videollamada.

Saludos,
MysterFoodie`;

  const negocioSubject =
    negocioAutomation?.enabled && negocioAutomation.subjectTemplate
      ? renderTemplate(negocioAutomation.subjectTemplate, templateVars)
      : defaultSubject;
  const negocioBody =
    negocioAutomation?.enabled && negocioAutomation.bodyTemplate
      ? renderTemplate(negocioAutomation.bodyTemplate, templateVars)
      : defaultNegocioBody;
  const adminSubject =
    adminAutomation?.enabled && adminAutomation.subjectTemplate
      ? renderTemplate(adminAutomation.subjectTemplate, templateVars)
      : defaultSubject;
  const adminBody =
    adminAutomation?.enabled && adminAutomation.bodyTemplate
      ? renderTemplate(adminAutomation.bodyTemplate, templateVars)
      : defaultAdminBody;

  const adminEmail = process.env.ADMIN_EMAIL;
  await Promise.all([
    sendTemplatedEmail({ to: contactEmail, subject: negocioSubject, bodyText: negocioBody }),
    adminEmail
      ? sendTemplatedEmail({ to: adminEmail, subject: adminSubject, bodyText: adminBody })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
