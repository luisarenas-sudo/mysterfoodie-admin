import Link from "next/link";
import FlancoCredit from "@/components/FlancoCredit";

export type LegalSection = { title: string; body: (string | string[])[] };

/**
 * Plantilla de las páginas legales públicas (/privacidad y /terminos).
 * Mismo lenguaje visual que la app: fondo gris claro, tarjeta blanca,
 * títulos en Fredoka y acento rojo/naranja de la marca.
 */
export default function LegalPage({
  title,
  updated,
  intro,
  sections,
  other,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <div className="mb-6">
        <span className="inline-block rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          MysterFoodie
        </span>
        <h1 className="heading mt-3 text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-1 text-sm text-stone-500">Última actualización: {updated}</p>
      </div>

      <article className="card space-y-7 p-6 sm:p-9">
        <p className="text-[15px] leading-relaxed text-stone-700">{intro}</p>
        {sections.map((s, i) => (
          <section key={s.title}>
            <h2 className="heading text-xl font-semibold text-ink">
              <span className="mr-2 text-brand-500">{i + 1}.</span>
              {s.title}
            </h2>
            <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-stone-700">
              {s.body.map((b, j) =>
                Array.isArray(b) ? (
                  <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-brand-500">
                    {b.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={j}>{b}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </article>

      <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={other.href} className="font-semibold text-brand-600 hover:underline">
          {other.label} →
        </Link>
        <Link href="/login" className="text-stone-500 hover:underline">
          Ir a iniciar sesión
        </Link>
      </nav>
      <div className="mt-8">
        <FlancoCredit />
      </div>
    </main>
  );
}
