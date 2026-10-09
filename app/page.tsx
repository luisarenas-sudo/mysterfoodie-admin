import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getHomeSummary, getReyNegocio, getPendingAssignmentsFor } from "@/lib/dashboard";
import { getHomeAlerts, type HomeAlert } from "@/lib/alerts";
import PendientesPanel from "@/components/PendientesPanel";
import MobileHome from "@/components/mobile/MobileHome";
import DesktopWizard from "@/components/wizard/DesktopWizard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getSessionProfile();

  // El dueño de negocio (cliente) no tiene nada que hacer en el
  // inicio del Mystery Shopper -- su pantalla principal es su propio
  // negocio.
  if (profile?.role === "cliente") {
    redirect("/mi-negocio");
  }

  const scope =
    (profile?.role === "agente" || profile?.role === "sibarita") && profile.userId
      ? {
          agentId: profile.userId,
          includeNegociosRecientes: profile.role === "sibarita",
        }
      : { includeNegociosRecientes: profile?.role === "admin" };

  // Un Foodie solo puede levantar visitas que le asignaron: el Inicio le avisa
  // cuántas tiene esperando (antes tenía que entrar a "Nueva visita" para saberlo).
  const [stats, rey, pending, alerts] = await Promise.all([
    getHomeSummary(scope),
    getReyNegocio(),
    profile?.role === "agente" && profile.userId ? getPendingAssignmentsFor(profile.userId) : Promise.resolve(null),
    // Un fallo al armar los avisos nunca debe tumbar el Inicio.
    profile?.userId
      ? getHomeAlerts({ userId: profile.userId, role: profile.role }).catch((): HomeAlert[] => [])
      : Promise.resolve([] as HomeAlert[]),
  ]);
  const displayName = profile?.fullName || profile?.email || "MysterFoodie";

  return (
    <>
      <MobileHome
        displayName={displayName}
        avatarUrl={profile?.avatarUrl ?? null}
        stats={stats}
        rey={rey}
        pendingAssignments={pending ? pending.length : null}
        alerts={alerts}
      />
      <div className="hidden md:block">
        {profile?.role === "agente" ? (
          <main className="mx-auto max-w-xl px-6 py-14 text-center">
            <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
            <h1 className="heading mt-2 text-2xl text-ink">Inicio</h1>
            <p className="mt-2 text-sm text-stone-500">Esta pantalla está diseñada para móvil.</p>
          </main>
        ) : (
          <>
            <div className="mx-auto max-w-3xl px-6 pt-6">
              <PendientesPanel alerts={alerts} />
            </div>
            <DesktopWizard />
          </>
        )}
      </div>
    </>
  );
}
