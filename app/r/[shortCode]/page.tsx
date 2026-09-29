import { getSupabaseServiceClient } from "@/lib/supabase";
import { topAndBottomCategories, type Ratings } from "@/lib/scoring";
import { getVerdict } from "@/lib/verdict";
import VerdictBadge from "@/components/VerdictBadge";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadReport(shortCode: string) {
  let db;
  try {
    db = getSupabaseServiceClient();
  } catch {
    return "not_configured" as const;
  }

  const { data: form } = await db
    .from("forms")
    .select("id, overall_score, created_at, client_id")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (!form) return null;

  const { data: client } = await db
    .from("clients")
    .select("name, type, city")
    .eq("id", form.client_id)
    .maybeSingle();

  const { data: ratingRows } = await db
    .from("form_ratings")
    .select("category_key, score")
    .eq("form_id", form.id);

  const ratings: Ratings = {};
  (ratingRows || []).forEach((r) => {
    ratings[r.category_key] = r.score;
  });

  return { form, client, ratings };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  const data = await loadReport(shortCode);

  if (data === "not_configured") {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="text-sm text-stone-600">
          Este sitio aún no tiene Supabase configurado, así que no se puede mostrar el reporte.
        </p>
      </main>
    );
  }

  if (!data) return notFound();

  const { form, client } = data;
  const { strengths, opportunities } = topAndBottomCategories(data.ratings, 2);
  const verdict = getVerdict(form.overall_score);
  const contactWhatsapp = process.env.ADMIN_CONTACT_WHATSAPP;
  const purchaseLink = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp}?text=${encodeURIComponent(
        `Hola, quiero el reporte completo de la evaluación de ${client?.name ?? ""} (código ${shortCode}).`
      )}`
    : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">
        Resultado de la evaluación de {client?.name ?? "tu negocio"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Visita realizada el {new Date(form.created_at).toLocaleDateString("es-MX")}
      </p>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm text-stone-500">Promedio general</p>
        <p className="text-5xl font-bold text-brand-600">{form.overall_score}</p>
        <p className="text-sm text-stone-500">de 5</p>
        <div className="mt-3 flex justify-center">
          <VerdictBadge score={form.overall_score} />
        </div>
        <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">{verdict.summary}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium text-stone-700">Lo mejor evaluado</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            {strengths.map((s) => (
              <li key={s.key}>{s.label}: {s.score} de 5</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium text-stone-700">Oportunidad de mejora</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            {opportunities.map((o) => (
              <li key={o.key}>{o.label}: {o.score} de 5</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-brand-100 bg-brand-50 p-6">
        <p className="font-medium text-ink">
          Este es un resumen general. El reporte completo incluye el detalle de los{" "}
          {11} indicadores evaluados, comparativo con el sector y recomendaciones específicas.
        </p>
        {purchaseLink ? (
          <a
            href={purchaseLink}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-md bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Solicitar el reporte completo
          </a>
        ) : (
          <p className="mt-4 text-sm text-stone-600">
            Para solicitar el reporte completo, contacta a MysterFoodie.
          </p>
        )}
      </div>
    </main>
  );
}
