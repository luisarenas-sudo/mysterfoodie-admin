import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getVisitsByAgent } from "@/lib/dashboard";
import VerdictBadge from "@/components/VerdictBadge";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function MisVisitasPage() {
  const profile = await requireRole("agente", "admin");
  const visits = await getVisitsByAgent(profile.userId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="heading text-3xl text-brand-500">Mis visitas</h1>
      <p className="mt-1 text-sm text-stone-500">Evaluaciones que has registrado.</p>

      {visits.length === 0 && (
        <p className="mt-6 text-sm text-stone-500">
          Aún no has registrado ninguna evaluación. Levanta la primera desde &quot;Nueva
          evaluación&quot;.
        </p>
      )}

      {visits.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Negocio</th>
                <th className="px-4 py-2 font-medium">Promedio</th>
                <th className="px-4 py-2 font-medium">Veredicto</th>
                <th className="px-4 py-2 font-medium">Reporte</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2">{formatDateLong(v.createdAt)}</td>
                  <td className="px-4 py-2">{v.clientName}</td>
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
      )}
    </main>
  );
}
