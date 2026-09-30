import { getSupabaseServiceClient } from "./supabase";

/**
 * Integración con Google Calendar para la automatización "Asesoría
 * gratuita post-visita" (ver Automatizaciones en /automatizaciones).
 *
 * Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (Google Cloud
 * Console > APIs y servicios > Credenciales > ID de cliente de OAuth,
 * tipo "Aplicación web", con la Google Calendar API habilitada en el
 * mismo proyecto). El URI de redirección autorizado debe ser
 * `${APP_URL}/api/integrations/google/callback`.
 *
 * Flujo:
 * 1. El admin entra a /automatizaciones y da clic en "Conectar Google
 *    Calendar" -> GET /api/integrations/google/start lo manda al
 *    consentimiento de Google (getGoogleAuthUrl).
 * 2. Google redirige a /api/integrations/google/callback con un
 *    `code`; se intercambia por un refresh_token (exchangeCodeForTokens)
 *    que se guarda en la tabla google_calendar_tokens (una sola fila).
 * 3. Para leer disponibilidad o crear un evento, getValidAccessToken()
 *    refresca el access_token automáticamente cuando ya expiró.
 *
 * Disponibilidad ("Face2Face"): en vez de usar freebusy.query (que
 * trata cualquier evento como ocupado, incluyendo el propio bloque de
 * disponibilidad), se listan TODOS los eventos del rango y se separan
 * en bloques "Face2Face" (el título exacto que el admin usa para
 * marcarse disponible) vs. el resto (ocupado). Los espacios libres de
 * cada bloque Face2Face, restando lo ocupado que se le encime, se
 * cortan en slots de `slotMinutes` minutos.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

function redirectUri(): string {
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return `${baseUrl.replace(/\/$/, "")}/api/integrations/google/callback`;
}

export function getGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID no configurado");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // "consent" fuerza a Google a siempre regresar un refresh_token,
    // incluso si el admin ya había autorizado la app antes.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

/** Intercambia el `code` del callback de OAuth por tokens y los guarda. */
export async function exchangeCodeForTokens(code: string, connectedEmail?: string | null) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "No se pudo autorizar con Google");
  }
  if (!data.refresh_token) {
    throw new Error(
      "Google no regresó un refresh_token. Revoca el acceso en myaccount.google.com/permissions e intenta de nuevo."
    );
  }

  const db = getSupabaseServiceClient();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await db.from("google_calendar_tokens").upsert({
    id: 1,
    connected_email: connectedEmail || null,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    access_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
}

export async function isCalendarConnected(): Promise<{ connected: boolean; email: string | null }> {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from("google_calendar_tokens")
    .select("connected_email")
    .eq("id", 1)
    .maybeSingle();
  return { connected: Boolean(data), email: data?.connected_email || null };
}

export async function disconnectCalendar(): Promise<void> {
  const db = getSupabaseServiceClient();
  await db.from("google_calendar_tokens").delete().eq("id", 1);
}

/** Regresa un access_token vigente, refrescándolo si ya expiró. Lanza si no hay calendario conectado. */
async function getValidAccessToken(): Promise<{ accessToken: string; calendarId: string }> {
  const db = getSupabaseServiceClient();
  const { data: row } = await db
    .from("google_calendar_tokens")
    .select("access_token, access_token_expires_at, refresh_token, calendar_id")
    .eq("id", 1)
    .maybeSingle();

  if (!row) {
    throw new Error("No hay un Google Calendar conectado todavía (ver Automatizaciones).");
  }

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  const stillValid = row.access_token && expiresAt - Date.now() > 60_000;
  if (stillValid) {
    return { accessToken: row.access_token as string, calendarId: row.calendar_id || "primary" };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "No se pudo refrescar el acceso a Google Calendar"
    );
  }

  const expiresAtNew = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await db
    .from("google_calendar_tokens")
    .update({ access_token: data.access_token, access_token_expires_at: expiresAtNew })
    .eq("id", 1);

  return { accessToken: data.access_token, calendarId: row.calendar_id || "primary" };
}

type GCalEvent = {
  id: string;
  summary?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<GCalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "No se pudo leer el calendario de Google");
  }
  return (data.items || []) as GCalEvent[];
}

export type FreeSlot = { start: Date; end: Date };

/** true si el evento está marcado como el bloque de disponibilidad "Face2Face". */
function isFace2FaceEvent(ev: GCalEvent): boolean {
  return (ev.summary || "").trim().toLowerCase() === "face2face";
}

function toDate(part: { dateTime?: string; date?: string }): Date | null {
  if (part.dateTime) return new Date(part.dateTime);
  if (part.date) return new Date(`${part.date}T00:00:00`);
  return null;
}

/**
 * Calcula los espacios libres de `slotMinutes` minutos dentro de los
 * bloques "Face2Face" de los próximos `daysAhead` días, excluyendo lo
 * que se le encime de otros eventos y lo que empiece antes de
 * `noticeHours` horas a partir de ahora.
 */
export async function getAvailableSlots(opts?: {
  slotMinutes?: number;
  daysAhead?: number;
  noticeHours?: number;
}): Promise<FreeSlot[]> {
  const slotMinutes = opts?.slotMinutes ?? 20;
  const daysAhead = opts?.daysAhead ?? 14;
  const noticeHours = opts?.noticeHours ?? 2;

  const { accessToken, calendarId } = await getValidAccessToken();

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const events = await listEvents(accessToken, calendarId, timeMin, timeMax);
  const live = events.filter((e) => e.status !== "cancelled");

  const face2face = live.filter(isFace2FaceEvent);
  const busy = live
    .filter((e) => !isFace2FaceEvent(e))
    .map((e) => ({ start: toDate(e.start), end: toDate(e.end) }))
    .filter((b): b is { start: Date; end: Date } => Boolean(b.start && b.end));

  const earliestStart = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);
  const slots: FreeSlot[] = [];

  for (const block of face2face) {
    const blockStart = toDate(block.start);
    const blockEnd = toDate(block.end);
    if (!blockStart || !blockEnd) continue;

    // Restar del bloque lo que se le encime de otros eventos: se arma
    // la lista de sub-rangos libres dentro del bloque.
    const overlapping = busy
      .filter((b) => b.start < blockEnd && b.end > blockStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = blockStart;
    const freeRanges: FreeSlot[] = [];
    for (const b of overlapping) {
      if (b.start > cursor) freeRanges.push({ start: cursor, end: new Date(Math.min(b.start.getTime(), blockEnd.getTime())) });
      if (b.end > cursor) cursor = b.end > blockEnd ? blockEnd : b.end;
      if (cursor >= blockEnd) break;
    }
    if (cursor < blockEnd) freeRanges.push({ start: cursor, end: blockEnd });

    for (const range of freeRanges) {
      let slotStart = range.start;
      while (slotStart.getTime() + slotMinutes * 60 * 1000 <= range.end.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);
        if (slotStart >= earliestStart) {
          slots.push({ start: slotStart, end: slotEnd });
        }
        slotStart = slotEnd;
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Vuelve a checar que el slot elegido siga libre (nadie más lo tomó) antes de crear el evento. */
export async function isSlotStillFree(start: Date, end: Date): Promise<boolean> {
  const available = await getAvailableSlots();
  return available.some((s) => s.start.getTime() === start.getTime() && s.end.getTime() === end.getTime());
}

export async function createCalendarEvent(params: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
  attendeeName?: string | null;
}): Promise<string> {
  const { accessToken, calendarId } = await getValidAccessToken();

  const body = {
    summary: params.summary,
    description: params.description || "",
    start: { dateTime: params.start.toISOString() },
    end: { dateTime: params.end.toISOString() },
    attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName || undefined }],
    reminders: { useDefault: true },
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "No se pudo crear el evento en Google Calendar");
  }
  return data.id as string;
}
