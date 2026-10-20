import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClientDetail } from "@/lib/dashboard";
import MobileWizard from "@/components/wizard/MobileWizard";
import DesktopWizard from "@/components/wizard/DesktopWizard";

export const dynamic = "force-dynamic";

/**
 * Abre el wizard pre-cargado con un negocio ya existente -- lo que usa
 * el botón "Nueva visita a este negocio" en /negocios/[id]. Solo
 * admin/sibarita: pueden visitar libremente cualquier negocio, a
 * diferencia de un Shopper, que solo entra por una asignación (ver
 * /nueva-visita/[assignmentId]).
 */
export default async function VisitarNegocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole("admin", "sibarita");
  const { id } = await params;

  const client = await getClientDetail(id);
  if (!client) return notFound();

  const boundAssignment = {
    client: {
      id: client.id,
      name: client.name,
      type: client.type,
      instagramHandle: client.instagramHandle,
      email: client.email,
      city: client.city,
    },
  };

  // Solo Master Chef y Sibarita deciden regalar un demo; el Shopper no.
  const canSendFree = profile.role === "admin" || profile.role === "sibarita";

  return (
    <>
      <MobileWizard boundAssignment={boundAssignment} canSendFree={canSendFree} />
      <div className="hidden md:block">
        <DesktopWizard boundAssignment={boundAssignment} canSendFree={canSendFree} />
      </div>
    </>
  );
}
