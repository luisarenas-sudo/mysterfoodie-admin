import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getClientDetail, getPendingAssignmentForClient } from "@/lib/dashboard";
import ClientScoreboard from "@/components/ClientScoreboard";
import MobileNegocioDetail from "@/components/mobile/MobileNegocioDetail";

export const dynamic = "force-dynamic";

export default async function NegocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  const canAssign = profile?.role === "admin";

  let client;
  try {
    client = await getClientDetail(id);
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

  const pendingAssignment = await getPendingAssignmentForClient(id);

  if (client.visits.length === 0) {
    return (
      <>
        <MobileNegocioDetail client={client} canAssign={canAssign} pendingAssignment={pendingAssignment} />
        <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block">
          <h1 className="heading text-3xl text-brand-500">{client.name}</h1>
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
      <MobileNegocioDetail client={client} canAssign={canAssign} pendingAssignment={pendingAssignment} />

      <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block">
        <Link href="/negocios" className="text-sm text-stone-500 hover:text-brand-500">
          Negocios
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="heading text-3xl text-ink">{client.name}</h1>
            <p className="text-sm text-stone-500">
              {client.city || "Sin ciudad"}
              {client.instagramHandle ? ` - @${client.instagramHandle}` : ""}
            </p>
          </div>
          <Link
            href={`/r/${latest.shortCode}`}
            target="_blank"
            className="btn-secondary text-sm"
          >
            Ver reporte público
          </Link>
        </div>

        <ClientScoreboard client={client} canManageEmail />
      </main>
    </>
  );
}
