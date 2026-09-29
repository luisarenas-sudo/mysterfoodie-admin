import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getVisitDetail } from "@/lib/dashboard";
import VerdictBadge from "@/components/VerdictBadge";
import EmailStatusPanel from "@/components/EmailStatusPanel";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Detalle de una evaluación puntual (admin o agente). Muestra el
 * desglose de indicadores y, sobre el mismo endpoint genérico usado
 * por la pantalla de confirmación al guardar, el estado del correo
 * automático con sus controles de reenvío - así sirve tanto para una
 * visita recién guardada como para cualquier evaluación anterior.
 */
export default async function VisitaDetailPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const profile = await requireRole("admin", "agente");
  const { formId } = await params;

  let visit;
  try {
    visit = await getVisitDetail(formId);
  } catch (err) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-stone-600">
          {err instanceof Error ? err.message : "Supabase no está configurado."}
        </p>
      </main>
    );
  }

  if (!visit) return notFound();

  const backHref = profile.role === "admin" ? `/negocios/${visit.clientId}` : "/mis-visitas";
  const backLabel = profile.role === "admin" ? visit.clientName : "Mis visitas";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={backHref} className="text-sm text-stone-500 hover:text-brand-500">
        ← {backLabel}
      </Link>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-brand-600">Evaluación</p>
          <h1 className="heading mt-1 text-3xl text-ink">
            {visit.clientName}: {visit.overallScore} de 5
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {formatDateLong(visit.createdAt)}
            {visit.shopperName ? ` · Mystery shopper: ${visit.shopperName}` : ""}
            {visit.waiterName ? ` · Mesero: ${visit.waiterName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <VerdictBadge score={visit.overallScore} />
          <Link
            href={`/r/${visit.shortCode}`}
            target="_blank"
            className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Ver reporte público
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visit.categoryScores.map((c) => (
          <div key={c.key} className="rounded-lg border border-stone-200 bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{c.average}</p>
            <p className="text-xs text-stone-400">de 5</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <EmailStatusPanel
          formId={visit.id}
          initialStatus={
            visit.lastEmail
              ? { status: visit.lastEmail.status, error: visit.lastEmail.error, to: visit.lastEmail.recipientEmail }
              : null
          }
        />
      </div>
    </main>
  );
}
