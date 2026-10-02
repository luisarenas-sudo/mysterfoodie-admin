import { requireRole } from "@/lib/auth";
import { listAutomations } from "@/lib/automations";
import { isCalendarConnected } from "@/lib/googleCalendar";
import AutomatizacionesPanel from "@/components/AutomatizacionesPanel";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";

export const dynamic = "force-dynamic";

export default async function AutomatizacionesPage() {
  await requireRole("admin");

  const [automations, calendar] = await Promise.all([listAutomations(), isCalendarConnected()]);

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <main className="mx-auto max-w-3xl px-5 pb-8 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/perfil" label="Perfil" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Automatizaciones</h1>
        <p className="mt-1 text-sm text-stone-500">
          Correos automáticos y la agenda pública de asesorías gratuitas.
        </p>

        <AutomatizacionesPanel automations={automations} calendar={calendar} />
      </main>
    </>
  );
}
