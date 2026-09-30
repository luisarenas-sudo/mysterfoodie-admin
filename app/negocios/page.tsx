import Link from "next/link";
import { getClientsSummary, getReyNegocio } from "@/lib/dashboard";
import VerdictBadge from "@/components/VerdictBadge";
import MobileNegociosList from "@/components/mobile/MobileNegociosList";

export const dynamic = "force-dynamic";

export default async function NegociosPage() {
  let clients: Awaited<ReturnType<typeof getClientsSummary>> = [];
  let configError: string | null = null;

  try {
    clients = await getClientsSummary();
  } catch (err) {
    configError = err instanceof Error ? err.message : "Error desconocido";
  }

  const rey = configError ? null : await getReyNegocio();

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

        <div className="mt-6 grid gap-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/negocios/${client.id}`}
              className="flex items-center justify-between card p-4 transition-colors hover:border-brand-300"
            >
              <div>
                <p className="font-semibold text-ink">{client.name}</p>
                <p className="text-sm text-stone-500">
                  {client.city || "Sin ciudad"} - {client.visitCount}{" "}
                  {client.visitCount === 1 ? "visita" : "visitas"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {client.lastScore !== null && (
                  <>
                    <span className="text-2xl font-bold text-ink">{client.lastScore}</span>
                    <VerdictBadge score={client.lastScore} size="sm" />
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
