import Link from "next/link";
import { requireRole } from "@/lib/auth";
import MobileNuevoNegocio from "@/components/mobile/MobileNuevoNegocio";

export default async function NuevoNegocioPage() {
  await requireRole("admin", "sibarita");

  return (
    <>
      <MobileNuevoNegocio />

      <main className="mx-auto hidden max-w-md px-6 py-10 md:block">
        <h1 className="heading text-2xl text-ink">Nuevo negocio</h1>
        <p className="mt-2 text-sm text-stone-500">
          Esta pantalla está disponible en la vista móvil por ahora.
        </p>
        <Link href="/negocios" className="btn-secondary mt-4 inline-flex text-sm">
          Volver a Negocios
        </Link>
      </main>
    </>
  );
}
