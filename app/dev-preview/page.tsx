import VerdictBadge from "@/components/VerdictBadge";
import ScoreTrendChart from "@/components/charts/ScoreTrendChart";
import CategoryCompareChart from "@/components/charts/CategoryCompareChart";
import { RATING_CATEGORIES } from "@/lib/categories";

export default function DevPreview() {
  const trendData = [
    { date: "02 ene", score: 3.1 },
    { date: "14 feb", score: 3.6 },
    { date: "20 mar", score: 3.4 },
    { date: "05 may", score: 4.2 },
  ];

  const compareData = RATING_CATEGORIES.map((c, i) => ({
    label: c.label,
    actual: [4, 5, 3, 4, 5, 2, 4, 3, 4, 5, 4][i],
    anterior: [3, 4, 3, 3, 4, 2, 3, 3, 3, 4, 3][i],
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading text-3xl text-ink">Cocina de Mar</h1>
      <p className="text-sm text-stone-500">CDMX - @cocinademar</p>

      <div className="mt-4 flex gap-3">
        <VerdictBadge score={4.7} />
        <VerdictBadge score={4.0} />
        <VerdictBadge score={3.0} />
        <VerdictBadge score={2.0} />
      </div>

      <section className="mt-8">
        <h2 className="heading text-xl text-ink">Evolución del promedio</h2>
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
          <ScoreTrendChart data={trendData} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="heading text-xl text-ink">Indicadores (visita actual vs anterior)</h2>
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
          <CategoryCompareChart data={compareData} showPrevious />
        </div>
      </section>
    </main>
  );
}
