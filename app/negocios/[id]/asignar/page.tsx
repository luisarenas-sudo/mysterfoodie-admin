import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClientDetail, getFoodies } from "@/lib/dashboard";
import MobileAsignarVisita from "@/components/mobile/MobileAsignarVisita";

export const dynamic = "force-dynamic";

/** Asignar un negocio a un Foodie -- solo admin (Master Chef), ver /api/asignaciones. */
export default async function AsignarVisitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const [client, foodies] = await Promise.all([getClientDetail(id), getFoodies()]);
  if (!client) return notFound();

  return (
    <>
      <MobileAsignarVisita clientId={client.id} clientName={client.name} foodies={foodies} />
      <main className="mx-auto hidden max-w-xl px-6 py-14 text-center md:block">
        <p className="text-sm text-stone-500">Esta pantalla está diseñada para móvil.</p>
      </main>
    </>
  );
}
