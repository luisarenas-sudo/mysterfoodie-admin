import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { FULL_REPORT_PRICE_MXN, FULL_REPORT_PRICE_WITH_IVA_MXN } from "@/lib/mercadopago";
import { TOTAL_ITEM_COUNT } from "@/lib/categories";
import AsegurarVisitaForm from "@/components/AsegurarVisitaForm";
import FlancoCredit from "@/components/FlancoCredit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Asegura tu visita · MysterFoodie", robots: { index: false, follow: false } };

const ymd = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Enlace personal (llega en el correo de «alta demanda»): el negocio elige día y horario y paga para asegurar su visita. */
export default async function AsegurarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const db = getSupabaseServiceClient();
  const { data: request } = await db.from("visit_requests").select("id, client_id, status, paid_at").eq("id", id).maybeSingle();
  if (!request) return notFound();
  const { data: client } = await db.from("clients").select("name").eq("id", request.client_id as string).maybeSingle();
  const name = (client?.name as string | null) ?? "tu negocio";

  const paid = Boolean(request.paid_at);
  const done = request.status === "completada";
  const now = Date.now();

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-center text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <div className="card mt-4 p-6 text-center">
        <h1 className="heading text-2xl leading-tight text-ink">Asegura tu visita a {name}</h1>
        {paid ? (
          <p className="mt-4 text-sm text-stone-600">¡Tu visita ya está asegurada! ✅ El Master Chef te escribirá para confirmar el día y el consumo.</p>
        ) : done ? (
          <p className="mt-4 text-sm text-stone-600">Esta solicitud ya tiene su visita realizada. Revisa tu correo: ahí te llegó el resultado.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-stone-600">
              Eliges el día y el horario, y un MysterFoodie hace la visita en exclusiva para tu negocio, de forma anónima.
            </p>
            <ul className="mt-4 space-y-1.5 text-left text-sm text-stone-700">
              <li>✅ Reporte completo de {TOTAL_ITEM_COUNT} indicadores, en PDF y en línea</li>
              <li>💬 Comentarios y sugerencias del MysterFoodie, y el ticket de consumo</li>
              <li>🕒 Asesoría gratuita de 20 minutos para platicar qué mover primero</li>
              <li>🙋 Atención directa del Master Chef</li>
            </ul>
            <div className="mt-5 flex items-baseline justify-center gap-1">
              <span className="text-stone-500">$</span>
              <span className="text-[34px] font-bold leading-none">{FULL_REPORT_PRICE_MXN}</span>
              <span className="text-sm text-stone-500">MXN, pago único</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-stone-600">+ el consumo de la visita (lo acordamos contigo)</p>
            <p className="mt-1 text-xs text-stone-500">Si necesitas factura, el total con IVA es ${FULL_REPORT_PRICE_WITH_IVA_MXN} MXN.</p>
            <AsegurarVisitaForm id={id} minDate={ymd(now + 86400000)} maxDate={ymd(now + 120 * 86400000)} />
          </>
        )}
      </div>
      <p className="mt-6 text-center">
        <FlancoCredit className="text-xs" color="#a8a29e" />
      </p>
    </main>
  );
}
