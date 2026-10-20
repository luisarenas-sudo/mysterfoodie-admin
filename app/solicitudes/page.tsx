import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getAssignees, getSolicitudes, syncVisitRequests } from "@/lib/visitRequests";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import SolicitudesPanel from "@/components/SolicitudesPanel";

export const dynamic = "force-dynamic";

/**
 * Solicitudes de "Solicita una visita GRATIS" (mysterfoodie.com), solo Master Chef: aquí se asigna
 * cada negocio nuevo a un sibarita, a un Shopper o a ti. Al abrirla también se actualiza el estado
 * (visitas hechas y solicitudes vencidas), como respaldo del cron.
 */
export default async function SolicitudesPage() {
  const profile = await requireRole("admin");
  const db = getSupabaseServiceClient();
  await syncVisitRequests(db).catch(() => null);
  const [rows, assignees] = await Promise.all([getSolicitudes(db), getAssignees(db)]);

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/perfil" label="Perfil" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Solicitudes de visita</h1>
        <p className="mt-1 text-sm text-stone-500">
          Negocios que pidieron una visita en la web. Las <strong>programadas</strong> ($850 + consumo) son prioridad: el negocio las paga en línea al pedirlas; cuando aparecen como pagadas, confirma fecha y consumo y asígnalas. Las <strong>gratis</strong> las asignas tú (o avisas alta demanda): si en 2 horas nadie las asigna te llega un correo; a las 3 horas se ofrecen a los sibaritas y a las 5 a los Shoppers. Avisos y asignaciones automáticas solo de 8 am a 8 pm: lo que llega de noche te avisa de inmediato, pero el reloj empieza a correr a las 8 am. Ya asignada, tiene 3 días en exclusiva; los días 4 y 5 también la ven los Shoppers, y al día 5 sin visita se le avisa al negocio.
        </p>
        <SolicitudesPanel rows={rows} assignees={assignees} meId={profile.userId} />
      </main>
    </>
  );
}
