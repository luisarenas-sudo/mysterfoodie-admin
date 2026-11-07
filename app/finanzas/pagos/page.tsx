import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/brand";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { currentMonthCdmx, isValidMonth, monthLabel, shiftMonth } from "@/lib/months";
import { formatMxn } from "@/lib/earningsMatrix";
import { getPayoutRows, getReport, monthIsClosed, previousMonthCdmx } from "@/lib/payouts";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import PagosMes from "@/components/finanzas/PagosMes";
import PagosAcciones from "@/components/finanzas/PagosAcciones";

export const dynamic = "force-dynamic";

const MUTED = "rgba(60,60,67,0.6)";

/** Reporte de ventas mensual (solo Master Chef): lo que hay que depositar a cada persona, con palomita de "ya le pagué". */
export default async function PagosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireRole("admin");
  const { mes } = await searchParams;
  const month = isValidMonth(mes) && mes < currentMonthCdmx() ? mes : previousMonthCdmx();
  const db = getSupabaseServiceClient();
  const report = await getReport(db, month);
  const rows = report ? await getPayoutRows(db, month) : [];
  if (report && !report.openedAt) await db.from("monthly_payout_reports").update({ opened_at: new Date().toISOString() }).eq("month", month);

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = next < currentMonthCdmx();

  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-2xl pb-10">
        <MobileSectionHeader backHref="/finanzas" backLabel="Finanzas" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">Pagos de {monthLabel(month)}</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: MUTED }}>
            Lo que debes depositar a cada persona por sus ventas del mes. Marca la palomita cuando le pagues: ellos lo ven en su Inicio.
          </p>

          <div className="mt-3 flex items-center justify-between rounded-[14px] bg-white px-2 py-1.5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <Link href={`/finanzas/pagos?mes=${prev}`} className="mf-tap rounded-lg px-3 py-2 text-[14px] font-semibold" style={{ color: "#F24444" }}>← {monthLabel(prev)}</Link>
            {canNext ? (
              <Link href={`/finanzas/pagos?mes=${next}`} className="mf-tap rounded-lg px-3 py-2 text-[14px] font-semibold" style={{ color: "#F24444" }}>{monthLabel(next)} →</Link>
            ) : (
              <span className="px-3 py-2 text-[14px]" style={{ color: "rgba(60,60,67,0.35)" }}>Mes en curso</span>
            )}
          </div>
        </div>

        <div className="px-5 pt-3">
          {!report ? (
            <div className="card p-5">
              <p className="text-[15px] font-bold">Todavía no hay reporte de {monthLabel(month)}</p>
              <p className="mt-1 text-[13.5px] leading-snug" style={{ color: MUTED }}>
                Se genera solo el día 1 de cada mes y te llega por correo. Si quieres verlo ya, puedes generarlo ahora{monthIsClosed(month) ? "." : " cuando termine el mes."}
              </p>
              {monthIsClosed(month) && <PagosAcciones month={month} hasReport={false} />}
            </div>
          ) : (
            <>
              <div className="card p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>A depositar</div>
                    <div className="mt-1 text-[17px] font-bold" style={{ color: "#F24444" }}>{formatMxn(report.toPay)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Plataforma</div>
                    <div className="mt-1 text-[17px] font-bold">{formatMxn(report.platform)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Ventas brutas</div>
                    <div className="mt-1 text-[17px] font-bold">{formatMxn(report.gross)}</div>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-snug" style={{ color: MUTED }}>
                  Plataforma = tu parte de reportes y planes, la parte de perfiles anónimos y el cargo por uso de la plataforma.
                </p>
              </div>
              <div className="mt-3">
                <PagosMes
                  month={month}
                  rows={rows.map((r) => ({
                    personId: r.personId,
                    name: r.name,
                    roleLabel: ROLE_LABELS[r.role] ?? r.role,
                    visits: r.visitsAmount,
                    profiles: r.profilesAmount,
                    total: r.total,
                    salesCount: r.salesCount,
                    paidAt: r.paidAt,
                  }))}
                />
              </div>
              {(report.paidAside > 0 || report.unpaidPlanAmount > 0 || report.unclassified > 0) && (
                <div className="mt-3 rounded-2xl p-4 text-[13px] leading-relaxed" style={{ background: "#FFF7E6", color: "#946200" }}>
                  {report.paidAside > 0 && <p>{formatMxn(report.paidAside)} de ganancias de perfiles ya se habían pagado por separado y no están en la lista.</p>}
                  {report.unpaidPlanAmount > 0 && <p>{formatMxn(report.unpaidPlanAmount)} en visitas de planes sin cobrar: no reparten ganancia hasta marcar el mes del plan como cobrado (luego usa Recalcular).</p>}
                  {report.unclassified > 0 && <p>{report.unclassified} {report.unclassified === 1 ? "venta sin clasificar" : "ventas sin clasificar"}: revisa quién vendió y quién visitó.</p>}
                </div>
              )}
              <PagosAcciones month={month} hasReport />
              <p className="mt-4 text-[12px] leading-snug" style={{ color: MUTED }}>
                Recalcular actualiza lo que aún no has pagado; lo que ya marcaste como pagado no cambia.
                {report.emailSentAt ? ` Correo enviado el ${new Date(report.emailSentAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" })}.` : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
