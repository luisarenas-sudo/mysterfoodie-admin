import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { isCalendarConnected, disconnectCalendar } from "@/lib/googleCalendar";

/** Estado de la conexión con Google Calendar (ver Automatizaciones). */
export async function GET() {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const status = await isCalendarConnected();
  return NextResponse.json(status);
}

/** Desconecta Google Calendar (borra el token guardado). */
export async function DELETE() {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await disconnectCalendar();
  return NextResponse.json({ ok: true });
}
