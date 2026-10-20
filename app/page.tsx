import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getHomeSummary, getReyNegocio, getPendingAssignmentsFor } from "@/lib/dashboard";
import { getHomeAlerts, type HomeAlert } from "@/lib/alerts";
import PendientesPanel from "@/components/PendientesPanel";
import MobileHome from "@/components/mobile/MobileHome";
import HomeInsights from "@/components/insights/HomeInsights";
import { getHomeInsights, type HomeInsights as InsightsData } from "@/lib/homeInsights";
import Link from "next/link";

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

  // Un Shopper solo puede levantar visitas que le asignaron: el Inicio le avisa
  // cuántas tiene esperando (antes tenía que entrar a "Nueva visita" para saberlo).
  const insightRole = profile?.role === "admin" || profile?.role === "sibarita" || profile?.role === "agente" ? profile.role : null;
  const [stats, rey, pending, alerts, insights] = await Promise.all([
    getHomeSummary(scope),
    getReyNegocio(),
    profile?.role === "agente" && profile.userId ? getPendingAssignmentsFor(profile.userId) : Promise.resolve(null),
    // Un fallo al armar los avisos nunca debe tumbar el Inicio.
    profile?.userId
      ? getHomeAlerts({ userId: profile.userId, role: profile.role }).catch((): HomeAlert[] => [])
      : Promise.resolve([] as HomeAlert[]),
    // Las estadísticas son un extra: si fallan, el Inicio sigue funcionando sin ellas.
    profile?.userId && insightRole
      ? getHomeInsights({ userId: profile.userId, role: insightRole }).catch((e): InsightsData | null => {
          console.error("home-insights", e instanceof Error ? e.message : e);
          return null;
        })
      : Promise.resolve(null as InsightsData | null),
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
        insights={insights && insightRole ? <HomeInsights data={insights} role={insightRole} variant="mobile" /> : null}
      />
      <div className="hidden md:block">
        {profile?.role === "agente" ? (
          <main className="mx-auto max-w-xl px-6 py-14 text-center">
            <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
            <h1 className="heading mt-2 text-2xl text-ink">Inicio</h1>
            <p className="mt-2 text-sm text-stone-500">Esta pantalla está diseñada para móvil.</p>
          </main>
        ) : (
          <main className="mx-auto max-w-5xl px-6 pb-16 pt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
                <h1 className="heading mt-1 text-3xl text-ink">Inicio</h1>
              </div>
              <Link href="/nueva-visita/libre" className="btn-primary whitespace-nowrap text-sm">
                Nueva visita
              </Link>
            </div>
            <div className="mt-5">
              <PendientesPanel alerts={alerts} />
            </div>
            {insights && insightRole && <HomeInsights data={insights} role={insightRole} />}
          </main>
        )}
      </div>
    </>
  );
}
