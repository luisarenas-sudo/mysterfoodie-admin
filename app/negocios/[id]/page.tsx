import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/dashboard";
import { getVerdict } from "@/lib/verdict";
import VerdictBadge from "@/components/VerdictBadge";
import ScoreTrendChart from "@/components/charts/ScoreTrendChart";
import CategoryCompareChart from "@/components/charts/CategoryCompareChart";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function NegocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client;
  try {
    client = await getClientDetail(id);
  } catch (err) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-stone-600">
          {err instanceof Error ? err.message : "Supabase no esta configurado."}
        </p>
      </main>
    );
  }

  if (!client) return notFound();
  if (client.visits.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="heading text-3xl text-brand-500">{client.name}</h1>
        <p className="mt-2 text-sm text-stone-500">Este negocio aun no tiene visitas registradas.</p>
      </main>
    );
  }

  const visits = client.visits;
  const latest = visits[visits.length - 1];
  const previous = visits.length > 1 ? visits[visits.length - 2] : null;
  const verdict = getVerdict(latest.overallScore);

  const trendData = visits.map((v) => ({
    date: formatDate(v.createdAt),
    score: v.overallScore,
  }));

  const compareData = latest.ratings.map((r) => {
    const prevRating = previous?.ratings.find((pr) => pr.key === r.key);
    return {
      label: r.label,
      actual: r.score,
      anterior: prevRating?.score,
    };
  });

  const scoreDelta = previous ? Math.round((latest.overallScore - previous.overallScore) * 10) / 10 : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/negocios" className="text-sm text-stone-500 hover:text-brand-500">
        Negocios
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading text-3xl text-ink">{client.name}</h1>
          <p className="text-sm text-stone-500">
            {client.city || "Sin ciudad"}
            {client.instagramHandle ? ` - @${client.instagramHandle}` : ""}
          </p>
        </div>
        <Link
          href={`/r/${latest.shortCode}`}
          target="_blank"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          Ver reporte publico
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-start justify-center rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Ultima calificacion</p>
          <p className="text-5xl font-bold text-ink">{latest.overallScore}</p>
          {scoreDelta !== null && (
            <p
              className={
                "text-sm font-medium " +
                (scoreDelta > 0
                  ? "text-brand-500"
                  : scoreDelta < 0
                  ? "text-stone-500"
                  : "text-stone-400")
              }
            >
              {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} vs visita anterior
            </p>
          )}
          <div className="mt-3">
            <VerdictBadge score={latest.overallScore} />
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-ink">Veredicto</p>
          <p className="mt-1 text-sm text-stone-600">{verdict.summary}</p>
          <p className="mt-3 text-xs text-stone-400">
            Ultima visita: {formatDateLong(latest.createdAt)}
            {latest.shopperName ? ` - por ${latest.shopperName}` : ""}
          </p>
        </div>
      </div>

      {visits.length > 1 && (
        <section className="mt-8">
          <h2 className="heading text-xl text-ink">Evolucion del promedio</h2>
          <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
            <ScoreTrendChart data={trendData} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="heading text-xl text-ink">
          Indicadores {previous ? "(visita actual vs anterior)" : "de la ultima visita"}
        </h2>
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
          <CategoryCompareChart data={compareData} showPrevious={Boolean(previous)} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="heading text-xl text-ink">Historial de visitas</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Mystery shopper</th>
                <th className="px-4 py-2 font-medium">Promedio</th>
                <th className="px-4 py-2 font-medium">Veredicto</th>
                <th className="px-4 py-2 font-medium">Reporte</th>
              </tr>
            </thead>
            <tbody>
              {[...visits].reverse().map((v) => (
                <tr key={v.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2">{formatDateLong(v.createdAt)}</td>
                  <td className="px-4 py-2">{v.shopperName || "-"}</td>
                  <td className="px-4 py-2 font-semibold">{v.overallScore}</td>
                  <td className="px-4 py-2">
                    <VerdictBadge score={v.overallScore} size="sm" />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/r/${v.shortCode}`}
                      target="_blank"
                      className="text-brand-500 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
