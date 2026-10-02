import { requireRole } from "@/lib/auth";
import { listAutomations } from "@/lib/automations";
import { isCalendarConnected } from "@/lib/googleCalendar";
import AutomatizacionesPanel from "@/components/AutomatizacionesPanel";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default async function AutomatizacionesPage() {
  await requireRole("admin");

  const [automations, calendar] = await Promise.all([listAutomations(), isCalendarConnected()]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-6 md:py-10">
      <BackLink href="/perfil" label="Perfil" />
      <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Automatizaciones</h1>
      <p className="mt-1 text-sm text-stone-500">
        Correos automáticos y la agenda pública de asesorías gratuitas.
      </p>

      <AutomatizacionesPanel automations={automations} calendar={calendar} />
    </main>
  );
}
