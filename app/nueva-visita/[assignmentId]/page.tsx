import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getAssignmentDetail } from "@/lib/dashboard";
import MobileWizard from "@/components/wizard/MobileWizard";

export const dynamic = "force-dynamic";

/** Abre el wizard pre-cargado con el negocio de una visita asignada (ver /nueva-visita). */
export default async function VisitaAsignadaPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const profile = await requireRole("admin", "agente", "sibarita");
  const { assignmentId } = await params;

  const assignment = await getAssignmentDetail(assignmentId);
  if (!assignment) return notFound();

  if (assignment.assignedTo !== profile.userId) {
    redirect("/nueva-visita");
  }
  if (assignment.status !== "pendiente") {
    redirect("/nueva-visita");
  }

  return (
    <MobileWizard
      boundAssignment={{
        assignmentId: assignment.id,
        client: assignment.client,
      }}
    />
  );
}
