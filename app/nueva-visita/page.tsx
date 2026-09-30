import Link from "next/link";
import MobileWizard from "@/components/wizard/MobileWizard";

export const dynamic = "force-dynamic";

export default function NuevaVisitaPage() {
  return (
    <>
      <MobileWizard />
      <main className="mx-auto hidden max-w-xl px-6 py-14 text-center md:block">
        <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
        <h1 className="heading mt-2 text-2xl text-ink">Registra tu visita desde el inicio</h1>
        <p className="mt-2 text-sm text-stone-500">
          En escritorio, la evaluación Mystery Shopper se levanta desde la pantalla principal.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex text-sm">
          Ir a Nueva evaluación
        </Link>
      </main>
    </>
  );
}
