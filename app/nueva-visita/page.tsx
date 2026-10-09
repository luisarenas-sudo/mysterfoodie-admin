import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getPendingAssignmentsFor, getClientsForVisitPicker } from "@/lib/dashboard";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getOpenPoolFor } from "@/lib/visitRequests";
import MobileVisitasAsignadas from "@/components/mobile/MobileVisitasAsignadas";
import MobileNuevaVisitaPicker from "@/components/mobile/MobileNuevaVisitaPicker";

export const dynamic = "force-dynamic";

/**
 * Admin y Sibarita eligen un negocio ya guardado (el más reciente
 * hasta arriba) para visitarlo, o agregan uno nuevo -- ambos casos
 * terminan en /negocios/[id], el mismo lugar donde se decide "Nueva
 * visita a este negocio" o "Asignar a un Foodie", sin importar si el
 * negocio ya existía o se acaba de crear.
 *
 * Un Foodie (agente) ya no puede elegir libremente: solo ve sus
 * negocios asignados y abre el wizard pre-cargado desde ahí (ver
 * /nueva-visita/[assignmentId] y /api/visits).
 */
export default async function NuevaVisitaPage() {
  const profile = await getSessionProfile();

  // El dueño de negocio (cliente) no da de alta visitas libremente.
  if (profile?.role === "cliente") {
    redirect("/mi-negocio");
  }

  if (profile?.role === "agente") {
    const assignments = await getPendingAssignmentsFor(profile.userId);
    const pool = await getOpenPoolFor(getSupabaseServiceClient(), profile.userId).catch(() => []);
    return (
      <>
        <MobileVisitasAsignadas assignments={assignments} pool={pool} />
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

  const clients = await getClientsForVisitPicker();

  return (
    <>
      <MobileNuevaVisitaPicker clients={clients} />
      <main className="mx-auto hidden max-w-xl px-6 py-14 text-center md:block">
        <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
        <h1 className="heading mt-2 text-2xl text-ink">Nueva visita</h1>
        <p className="mt-2 text-sm text-stone-500">
          Esta pantalla está diseñada para móvil. En escritorio, entra a un negocio desde
          &quot;Negocios&quot;.
        </p>
      </main>
    </>
  );
}
