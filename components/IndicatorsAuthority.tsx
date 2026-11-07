import { HIGIENE_DISCLAIMER_SHORT } from "@/lib/brand";
import { TOTAL_ITEM_COUNT } from "@/lib/categories";

const POINTS = [
  { emoji: "🏅", title: "Distintivos y certificaciones", text: "Basados en distintivos y certificaciones actuales, como el Distintivo H de Sectur." },
  { emoji: "🍽️", title: "Líderes del sector restaurantero", text: "Calificados por líderes del sector restaurantero, con la metodología de Flanco Izquierdo®." },
  { emoji: "🙋", title: "Atención a cliente y consumo", text: "Con experiencia en atención a cliente y en centros de consumo de alimentos y bebidas." },
];

/**
 * Por qué confiar en los indicadores. Se muestra en el reporte público DESPUÉS de la oferta y el botón de pago
 * (variante "mobile" = app del celular; "desktop" = página web).
 */
export default function IndicatorsAuthority({ variant }: { variant: "mobile" | "desktop" }) {
  if (variant === "mobile") {
    return (
      <div className="card mx-5 mt-4 p-[18px]">
        <div className="text-center">
          <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
            {TOTAL_ITEM_COUNT} indicadores líderes en el mercado
          </div>
        </div>
        <div className="mt-3.5 space-y-2.5">
          {POINTS.map((p) => (
            <div key={p.title} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: "#F2F2F7" }}>
              <div className="text-[20px] leading-none" aria-hidden="true">{p.emoji}</div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold leading-tight">{p.title}</div>
                <div className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-[11.5px] leading-snug" style={{ color: "rgba(60,60,67,0.45)" }}>{HIGIENE_DISCLAIMER_SHORT}</div>
      </div>
    );
  }
  return (
    <section className="mt-8 rounded-lg border border-stone-200 bg-white p-6">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-brand-600">{TOTAL_ITEM_COUNT} indicadores líderes en el mercado</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-md bg-stone-50 p-4 text-center">
            <div className="text-2xl" aria-hidden="true">{p.emoji}</div>
            <p className="mt-1 text-sm font-semibold text-ink">{p.title}</p>
            <p className="mt-1 text-xs leading-snug text-stone-500">{p.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-stone-400">{HIGIENE_DISCLAIMER_SHORT}</p>
    </section>
  );
}
