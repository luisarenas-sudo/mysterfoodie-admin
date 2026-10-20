import { glosarioEntries, type GlosarioKey } from "@/lib/glosario";

/**
 * "Nuestro mundo": desplegable con lo que significa cada palabra de la marca
 * (MysterFoodie, rangos, Uni, planes). Se usa donde alguien nos conoce por primera vez:
 * el reporte público, Mi negocio y Perfil. Definiciones en lib/glosario.ts.
 */
export default function GlosarioCard({
  keys,
  title = "Nuestro mundo",
  subtitle = "Qué significa cada palabra que usamos",
  defaultOpen = false,
  className = "",
}: {
  keys: GlosarioKey[];
  title?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const items = glosarioEntries(keys);
  if (items.length === 0) return null;
  return (
    <details className={`card group ${className}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[15px] font-bold text-ink">{title}</span>
          <span className="block text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            {subtitle}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 flex-shrink-0 rotate-45 border-b-2 border-r-2 border-brand-500 transition-transform group-open:-rotate-[135deg]"
        />
      </summary>
      <dl className="px-4 pb-3" style={{ borderTop: "1px solid rgba(60,60,67,0.08)" }}>
        {items.map((g, idx) => (
          <div
            key={g.key}
            className="flex gap-3 py-3"
            style={{ borderBottom: idx < items.length - 1 ? "1px solid rgba(60,60,67,0.08)" : undefined }}
          >
            <span className="flex-shrink-0 text-xl leading-tight" aria-hidden="true">
              {g.emoji}
            </span>
            <div>
              <dt className="text-[14px] font-bold text-ink">{g.term}</dt>
              <dd className="mt-0.5 text-[13px] leading-snug" style={{ color: "rgba(60,60,67,0.75)" }}>
                {g.def}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </details>
  );
}
