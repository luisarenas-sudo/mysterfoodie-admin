import Link from "next/link";
import { getVerdict } from "@/lib/verdict";
import VerdictBadge from "@/components/VerdictBadge";
import ScoreTrendChart from "@/components/charts/ScoreTrendChart";
import CategoryCompareChart from "@/components/charts/CategoryCompareChart";
import type { ClientDetail } from "@/lib/dashboard";

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

/**
 * Bloque compartido: última calificación, veredicto, evolución,
 * comparativo de indicadores e historial de visitas. Lo usan tanto
 * /negocios/[id] (vista de admin) como /mi-negocio (vista del dueño
 * del negocio) sobre el mismo ClientDetail.
 */
export default function ClientScoreboard({
  client,
  canManageEmail = false,
}: {
  client: ClientDetail;
  /** Admin y agente pueden ver el estado del correo y reenviarlo por evaluación; el dueño del negocio (/mi-negocio) no. */
  canManageEmail?: boolean;
}) {
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

  const scoreDelta = previous
    ? Math.round((latest.overallScore - previous.overallScore) * 10) / 10
    : null;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-start justify-center rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Última calificación</p>
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
            Última visita: {formatDateLong(latest.createdAt)}
            {latest.shopperName ? ` - por ${latest.shopperName}` : ""}
          </p>
        </div>
      </div>

      {visits.length > 1 && (
        <section className="mt-8">
          <h2 className="heading text-xl text-ink">Evolución del promedio</h2>
          <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
            <ScoreTrendChart data={trendData} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="heading text-xl text-ink">
          Indicadores {previous ? "(visita actual vs anterior)" : "de la última visita"}
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
                {canManageEmail && <th className="px-4 py-2 font-medium">Evaluación</th>}
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
                  {canManageEmail && (
                    <td className="px-4 py-2">
                      <Link href={`/visitas/${v.id}`} className="text-brand-500 hover:underline">
                        Detalle y correo
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
