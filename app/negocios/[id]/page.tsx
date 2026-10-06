import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getClientDetail, getPendingAssignmentForClient } from "@/lib/dashboard";
import ClientScoreboard from "@/components/ClientScoreboard";
import MobileNegocioDetail from "@/components/mobile/MobileNegocioDetail";
import DeleteButton from "@/components/DeleteButton";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default async function NegocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();

  // El dueño de negocio (cliente) ve su negocio en /mi-negocio, no en
  // este listado general de negocios evaluados.
  if (profile?.role === "cliente") {
    redirect("/mi-negocio");
  }

  const canAssign = profile?.role === "admin";
  const canCreateVisit = profile?.role === "admin" || profile?.role === "sibarita";
  // Admin edita cualquier negocio; un Sibarita solo los que dio de alta
  // (se decide más abajo, cuando ya se cargó el negocio).

  // Se lanzan ambas peticiones a la vez (en vez de esperar una y luego la
  // otra) -- no dependen entre sí, así que no hay razón para encadenarlas.
  const clientPromise = getClientDetail(id);
  const pendingAssignmentPromise = getPendingAssignmentForClient(id);

  let client;
  try {
    client = await clientPromise;
  } catch (err) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-stone-600">
          {err instanceof Error ? err.message : "Supabase no está configurado."}
        </p>
      </main>
    );
  }

  if (!client) return notFound();

  const canEdit =
    profile?.role === "admin" || (profile?.role === "sibarita" && client.createdBy === profile.userId);

  const pendingAssignment = await pendingAssignmentPromise;

  if (client.visits.length === 0) {
    return (
      <>
        <MobileNegocioDetail
          client={client}
          canAssign={canAssign}
          canDelete={canAssign}
          canEdit={canEdit}
          canCreateVisit={canCreateVisit}
          pendingAssignment={pendingAssignment}
        />
        <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block">
          <BackLink href="/negocios" label="Negocios" />
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="heading text-3xl text-brand-500">{client.name}</h1>
            {canAssign && (
              <DeleteButton
                endpoint={`/api/clients/${client.id}`}
                confirmText={`¿Eliminar "${client.name}"? No tiene visitas, así que solo se borra el negocio. Esto no se puede deshacer.`}
                redirectTo="/negocios"
                triggerLabel="Eliminar negocio"
              />
            )}
          </div>
          <p className="mt-2 text-sm text-stone-500">Este negocio aún no tiene visitas registradas.</p>
          {canAssign && (
            <Link href={`/negocios/${client.id}/asignar`} className="btn-secondary mt-4 inline-flex text-sm">
              {pendingAssignment ? "Reasignar a otro Foodie" : "Asignar visita a un Foodie"}
            </Link>
          )}
        </main>
      </>
    );
  }

  const latest = client.visits[client.visits.length - 1];

  return (
    <>
      <MobileNegocioDetail
        client={client}
        canAssign={canAssign}
        canDelete={canAssign}
        canEdit={canEdit}
        canCreateVisit={canCreateVisit}
        pendingAssignment={pendingAssignment}
      />

      <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block">
        <BackLink href="/negocios" label="Negocios" />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="heading text-3xl text-ink">{client.name}</h1>
            <p className="text-sm text-stone-500">
              {client.city || "Sin ciudad"}
              {client.instagramHandle ? ` - @${client.instagramHandle}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/r/${latest.shortCode}`}
              target="_blank"
              className="btn-secondary text-sm"
            >
              Ver reporte público
            </Link>
            {canAssign && (
              <DeleteButton
                endpoint={`/api/clients/${client.id}`}
                confirmText={`¿Eliminar "${client.name}" y sus ${client.visits.length} visita${client.visits.length === 1 ? "" : "s"}? Esto no se puede deshacer.`}
                redirectTo="/negocios"
                triggerLabel="Eliminar negocio"
              />
            )}
          </div>
        </div>

        <ClientScoreboard client={client} canManageEmail />
      </main>
    </>
  );
}
