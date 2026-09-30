import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { getPendingAssignmentsFor } from "@/lib/dashboard";
import MobileWizard from "@/components/wizard/MobileWizard";
import MobileVisitasAsignadas from "@/components/mobile/MobileVisitasAsignadas";

export const dynamic = "force-dynamic";

/**
 * Admin y Sibarita dan de alta negocios y levantan visitas libremente
 * (wizard de siempre). Un Foodie (agente) ya no puede: solo ve sus
 * negocios asignados y abre el wizard pre-cargado desde ahí (ver
 * /nueva-visita/[assignmentId] y /api/visits).
 */
export default async function NuevaVisitaPage() {
  const profile = await getSessionProfile();

  if (profile?.role === "agente") {
    const assignments = await getPendingAssignmentsFor(profile.userId);
    return (
      <>
        <MobileVisitasAsignadas assignments={assignments} />
        <main className="mx-auto hidden max-w-xl px-6 py-14 text-center md:block">
          <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
          <h1 className="heading mt-2 text-2xl text-ink">Tus visitas asignadas</h1>
          <p className="mt-2 text-sm text-stone-500">
            Esta pantalla está diseñada para móvil.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <MobileWizard />
      <main className="mx-auto hidden max-w-xl px-6 py-14 text-center md:block">
        <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
        <h1 className="heading mt-2 text-2xl text-ink">Registra tu visita desde el inicio</h1>
        <p className="mt-2 text-sm text-stone-500">
          En escritorio, la evaluación Mystery Shopper se levanta desde la pantalla principal.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex text-sm">
          Ir a Nueva evaluación
        </Link>
      </main>
    </>
  );
}
