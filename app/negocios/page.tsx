import { requireRole } from "@/lib/auth";
import { getClientsSummary, reyFromClients } from "@/lib/dashboard";
import MobileNegociosList from "@/components/mobile/MobileNegociosList";
import NegociosListDesktop from "@/components/NegociosListDesktop";

export const dynamic = "force-dynamic";

export default async function NegociosPage() {
  await requireRole("admin", "sibarita");

  let clients: Awaited<ReturnType<typeof getClientsSummary>> = [];
  let configError: string | null = null;

  try {
    clients = await getClientsSummary();
  } catch (err) {
    configError = err instanceof Error ? err.message : "Error desconocido";
  }

  const rey = configError ? null : reyFromClients(clients);

  return (
    <>
      {configError && (
        <p className="md:hidden mx-5 mt-5 rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
          {configError}
        </p>
      )}
      {!configError && <MobileNegociosList clients={clients} reyId={rey?.id ?? null} />}

      <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block">
        <h1 className="heading text-3xl text-brand-500">Negocios evaluados</h1>
        <p className="mt-1 text-sm text-stone-500">
          Historial de visitas Mystery Shopper por negocio.
        </p>

        {configError && (
          <p className="mt-6 rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
            {configError}
          </p>
        )}

        {!configError && clients.length === 0 && (
          <p className="mt-6 text-sm text-stone-500">
            Aún no hay visitas registradas. Levanta la primera evaluación desde
            &quot;Nueva evaluación&quot;.
          </p>
        )}

        {!configError && clients.length > 0 && <NegociosListDesktop clients={clients} />}
      </main>
    </>
  );
}
