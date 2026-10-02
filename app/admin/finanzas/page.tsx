import { requireRole } from "@/lib/auth";
import FinanzasCalculator from "@/components/admin/FinanzasCalculator";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  await requireRole("admin");

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-6 md:py-10">
      <BackLink href="/perfil" label="Perfil" />
      <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Finanzas</h1>
      <p className="mt-1 text-sm text-stone-500">
        Reparto de ingresos por visita entre Master Chef, Sibaritas y Foodies.
      </p>

      <div className="mt-6">
        <FinanzasCalculator />
      </div>
    </main>
  );
}
