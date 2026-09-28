import { requireRole } from "@/lib/auth";
import { getClientDetail } from "@/lib/dashboard";
import ClientScoreboard from "@/components/ClientScoreboard";

export const dynamic = "force-dynamic";

export default async function MiNegocioPage() {
  const profile = await requireRole("cliente");

  if (!profile.clientId) {
    return (
      <main className="mx-auto max-w-xl px-6 py-14 text-center">
        <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
        <h1 className="heading mt-2 text-2xl text-ink">
          Tu cuenta aun no esta vinculada a un negocio
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Contacta al equipo de MysterFoodie para que la enlacen al negocio correcto.
        </p>
      </main>
    );
  }

  const client = await getClientDetail(profile.clientId);

  if (!client) {
    return (
      <main className="mx-auto max-w-xl px-6 py-14 text-center">
        <p className="text-sm text-stone-600">
          No encontramos el negocio vinculado a tu cuenta. Contacta al equipo de MysterFoodie.
        </p>
      </main>
    );
  }

  if (client.visits.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="heading text-3xl text-brand-500">{client.name}</h1>
        <p className="mt-2 text-sm text-stone-500">
          Aun no hay visitas registradas para tu negocio. En cuanto se realice la primera
          evaluacion Mystery Shopper, la veras aqui.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm uppercase tracking-wide text-brand-600">Mi negocio</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading text-3xl text-ink">{client.name}</h1>
          <p className="text-sm text-stone-500">
            {client.city || "Sin ciudad"}
            {client.instagramHandle ? ` - @${client.instagramHandle}` : ""}
          </p>
        </div>
      </div>

      <ClientScoreboard client={client} />
    </main>
  );
}
