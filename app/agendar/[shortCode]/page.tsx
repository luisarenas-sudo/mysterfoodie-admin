import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { isCalendarConnected, getAvailableSlots } from "@/lib/googleCalendar";
import AgendarPicker, { type SlotOption } from "@/components/AgendarPicker";
import FlancoCredit from "@/components/FlancoCredit";

export const dynamic = "force-dynamic";

async function loadClientByShortCode(shortCode: string) {
  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return "not_configured" as const;
  }

  const { data: form } = await db
    .from("forms")
    .select("id, client_id, report_unlocked_at")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (!form) return null;

  const { data: client } = await db
    .from("clients")
    .select("id, name, email, phone")
    .eq("id", form.client_id)
    .maybeSingle();

  return { client, unlocked: Boolean(form.report_unlocked_at) };
}

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // No dependen entre sí -- se lanzan juntas en vez de esperar el negocio
  // y luego, por separado, si el calendario está conectado.
  const [data, { connected }] = await Promise.all([
    loadClientByShortCode(shortCode),
    isCalendarConnected(),
  ]);

  if (data === "not_configured") {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="text-sm text-stone-600">
          Este sitio aún no tiene Supabase configurado, así que no se puede mostrar la agenda.
        </p>
      </main>
    );
  }
  if (!data) return notFound();

  // La asesoría gratuita se incluye con el reporte completo: sin él no se agenda.
  if (!data.unlocked) {
    return (
      <main className="min-h-screen pb-16 pt-8" style={{ background: "#F2F2F7" }}>
        <div className="mx-auto max-w-sm px-5 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
            MysterFoodie
          </p>
          <h1 className="heading mt-1 text-[22px] font-bold">Asesoría gratuita</h1>
        </div>
        <div className="card mx-auto mt-6 max-w-sm p-6 text-center">
          <p className="text-[14.5px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            La asesoría gratuita de 20 minutos se incluye al obtener el reporte completo de tu visita.
          </p>
          <a
            href={`/r/${shortCode}`}
            className="mf-tap mt-4 block rounded-[14px] py-3.5 text-center text-[15px] font-bold text-white"
            style={{ background: "#F24444" }}
          >
            Ver mi reporte
          </a>
        </div>
      </main>
    );
  }

  let slots: SlotOption[] = [];
  let loadError: string | null = null;
  if (connected) {
    try {
      const available = await getAvailableSlots();
      slots = available.map((s) => ({ startISO: s.start.toISOString(), endISO: s.end.toISOString() }));
    } catch (err) {
      loadError = err instanceof Error ? err.message : "No se pudo leer la agenda";
    }
  }

  return (
    <main className="min-h-screen pb-16 pt-8" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-sm px-5 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
          MysterFoodie
        </p>
        <h1 className="heading mt-1 text-[22px] font-bold">Agenda tu asesoría</h1>
      </div>

      {!connected || loadError ? (
        <div className="card mx-auto mt-6 max-w-sm p-6 text-center">
          <p className="text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            La agenda no está disponible en este momento. Escríbenos directamente y coordinamos un horario.
          </p>
        </div>
      ) : (
        <AgendarPicker
          shortCode={shortCode}
          businessName={data.client?.name ?? "tu negocio"}
          defaultEmail={data.client?.email ?? ""}
          needsPhone={!data.client?.phone?.trim()}
          slots={slots}
        />
      )}

      <div className="mx-auto mt-8 max-w-sm px-5 text-center">
        <FlancoCredit />
      </div>
    </main>
  );
}
