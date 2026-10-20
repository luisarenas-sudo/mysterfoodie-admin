import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DesktopWizard from "@/components/wizard/DesktopWizard";

export const dynamic = "force-dynamic";

/**
 * Formulario de visita en blanco para escritorio (negocio nuevo, sin asignación). Antes vivía en el Inicio; ahora el
 * Inicio es el tablero (Pendientes + estadísticas) y la visita en blanco se abre desde «Nueva visita» del menú.
 */
export default async function VisitaLibrePage() {
  const profile = await requireRole("admin", "sibarita");
  return (
    <>
      <main className="mx-auto max-w-xl px-6 py-14 text-center md:hidden">
        <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
        <h1 className="heading mt-2 text-2xl text-ink">Nueva visita</h1>
        <p className="mt-2 text-sm text-stone-500">Esta pantalla es para escritorio. En el celular, elige o añade un negocio.</p>
        <Link href="/nueva-visita" className="btn-primary mt-5 text-sm">
          Elegir un negocio
        </Link>
      </main>
      <div className="hidden md:block">
        <DesktopWizard defaultShopperName={profile.fullName ?? undefined} canSendFree={true} />
      </div>
    </>
  );
}
