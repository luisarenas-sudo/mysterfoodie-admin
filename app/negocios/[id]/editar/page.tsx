import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClientDetail } from "@/lib/dashboard";
import MobileNuevoNegocio from "@/components/mobile/MobileNuevoNegocio";

export const dynamic = "force-dynamic";

/**
 * Corregir los datos de un negocio ya dado de alta. Admin edita cualquiera;
 * un Sibarita solo los que él creó (misma regla que PATCH /api/clients/[id]).
 */
export default async function EditarNegocioPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin", "sibarita");
  const { id } = await params;

  const client = await getClientDetail(id);
  if (!client) return notFound();

  if (profile.role === "sibarita" && client.createdBy !== profile.userId) {
    redirect(`/negocios/${id}`);
  }

  return (
    <>
      <MobileNuevoNegocio
        initial={{
          id: client.id,
          name: client.name,
          type: client.type,
          city: client.city,
          contactName: client.contactName,
          phone: client.phone,
          instagramHandle: client.instagramHandle,
          email: client.email,
          autoEmailEnabled: client.autoEmailEnabled,
          hasWebsite: client.hasWebsite,
          hasGoogleBusiness: client.hasGoogleBusiness,
          hasProfessionalPhotos: client.hasProfessionalPhotos,
          hasReels: client.hasReels,
        }}
      />

      <main className="mx-auto hidden max-w-md px-6 py-10 md:block">
        <h1 className="heading text-2xl text-ink">Editar negocio</h1>
        <p className="mt-2 text-sm text-stone-500">
          Esta pantalla está disponible en la vista móvil por ahora.
        </p>
        <Link href={`/negocios/${id}`} className="btn-secondary mt-4 inline-flex text-sm">
          Volver al negocio
        </Link>
      </main>
    </>
  );
}
