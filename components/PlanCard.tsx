"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientPlanView, PlanBranchOption } from "@/lib/plans";
import { PLAN_ZONE_LABEL, isInPlanZone, sucursalesRangeLabel, type PlanCatalogEntry } from "@/lib/planCatalog";
import { formatMxn } from "@/lib/earningsMatrix";
import { monthLabel as monthName } from "@/lib/months";
import { friendlyError } from "@/lib/friendlyError";

const MUTED = "rgba(60,60,67,0.6)";

export type PlanFoodie = { id: string; name: string; pendingCount: number };

type Props = {
  clientId: string;
  clientName: string;
  clientCity: string | null;
  clientEmail: string | null;
  /** Otros negocios sin plan vigente, para sumarlos a un plan de varias sucursales. */
  branchOptions: PlanBranchOption[];
  view: ClientPlanView | null;
  foodies: PlanFoodie[];
  /** Mes en el que conviene arrancar (este mes si es principio de mes; si no, el siguiente). */
  suggestedStart: { month: string; label: string };
  otherStart: { month: string; label: string };
  catalogs: PlanCatalogEntry[];
};

function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span aria-hidden className="inline-flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: i < done ? "#34C759" : "rgba(60,60,67,0.18)" }}
        />
      ))}
    </span>
  );
}

/**
 * Plan mensual de visitas de un negocio (solo Master Chef): contratar uno
 * nuevo, o ver y administrar el vigente (avance del mes, cobro, asignar
 * Foodie a cada visita, reenviar ticket, pausar o cancelar).
 */
export default function PlanCard({
  clientId,
  clientName,
  clientCity,
  clientEmail,
  branchOptions,
  view,
  foodies,
  suggestedStart,
  otherStart,
  catalogs,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulario de contratación
  const [planKey, setPlanKey] = useState(catalogs[0].key);
  const catalog = catalogs.find((c) => c.key === planKey) ?? catalogs[0];
  const [extraBranches, setExtraBranches] = useState<PlanBranchOption[]>([]);
  const [ticketEmail, setTicketEmail] = useState("");
  const [outOfZoneOk, setOutOfZoneOk] = useState(false);
  const [visitsPerMonth, setVisitsPerMonth] = useState(catalogs[0].visitsPerMonth);
  const [pricePerVisit, setPricePerVisit] = useState(String(catalogs[0].pricePerVisit));
  const [startMonth, setStartMonth] = useState(suggestedStart.month);
  const [defaultFoodieId, setDefaultFoodieId] = useState("");
  const [notes, setNotes] = useState("");

  // Asignación por visita
  const [assignFor, setAssignFor] = useState<Record<string, string>>({});

  async function call(url: string, method: string, body: unknown, success?: (data: Record<string, unknown>) => string | null) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "No se pudo completar la acción");
        return false;
      }
      if (success) setNotice(success(data as Record<string, unknown>));
      router.refresh();
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const ticketMessage = (data: Record<string, unknown>): string => {
    const t = data.ticket as { status?: string } | undefined;
    if (t?.status === "sent") return "Ticket enviado. Ahora te toca contactar al cliente.";
    if (t?.status === "skipped_no_email") return "Listo. El negocio no tiene correo, así que no se envió el ticket: contáctalo por otro medio.";
    if (t?.status === "skipped_no_api_key") return "Listo, pero el correo no está configurado en el servidor (falta RESEND_API_KEY).";
    return "Listo, pero el correo del ticket no se pudo enviar. Puedes reenviarlo desde el plan.";
  };

  // ---------------------------------------------------------------- sin plan
  if (!view) {
    const isChain = catalog.sucursalesMax > 1;
    const branches: PlanBranchOption[] = [
      { id: clientId, name: clientName, city: clientCity, email: clientEmail },
      ...(isChain ? extraBranches : []),
    ];
    const countOk = branches.length >= catalog.sucursalesMin && branches.length <= catalog.sucursalesMax;
    const visits = catalog.key === "starter" ? visitsPerMonth : catalog.visitsPerMonth;
    const price = Number(pricePerVisit) || 0;
    const total = branches.length * visits * price;
    const outOfZone = catalog.zoneRestricted ? branches.filter((b) => !isInPlanZone(b.city)) : [];
    const blockedByZone = outOfZone.length > 0 && !outOfZoneOk;
    const availableToAdd = branchOptions.filter((o) => o.id !== clientId && !extraBranches.some((e) => e.id === o.id));
    const defaultTicketEmail = branches.find((b) => b.email)?.email ?? "";

    const pickPlan = (key: string) => {
      const c = catalogs.find((x) => x.key === key);
      if (!c) return;
      setPlanKey(key);
      setVisitsPerMonth(c.visitsPerMonth);
      setPricePerVisit(String(c.pricePerVisit));
      setExtraBranches([]);
      setOutOfZoneOk(false);
    };

    return (
      <div id="plan" className="card mx-5 mt-4 scroll-mt-20 p-4 md:mx-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold">Plan de visitas</div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
              Visitas mensuales con reporte incluido
            </div>
          </div>
          {!open && (
            <button type="button" onClick={() => setOpen(true)} className="mf-tap rounded-[12px] px-3.5 py-2 text-[14px] font-bold text-white" style={{ background: "#F24444" }}>
              Contratar
            </button>
          )}
        </div>

        {open && (
          <div className="mt-4 space-y-3.5">
            <div>
              <div className="text-[13px] font-semibold">Plan</div>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {catalogs.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => pickPlan(c.key)}
                    className="mf-tap rounded-[12px] px-2 py-2.5 text-center"
                    style={
                      planKey === c.key
                        ? { background: "#F24444", color: "#fff" }
                        : { background: "#fff", color: "#111", border: "1px solid rgba(60,60,67,0.18)" }
                    }
                  >
                    <div className="text-[14px] font-bold leading-tight">{c.name}</div>
                    <div className="mt-0.5 text-[11px] leading-tight" style={{ opacity: 0.85 }}>
                      {sucursalesRangeLabel(c)} suc. · {formatMxn(c.pricePerVisit)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px]" style={{ color: MUTED }}>
                {catalog.tagline}.{" "}
                <Link href="/planes#comparativa" className="font-semibold text-brand-500">
                  Ver comparativa
                </Link>
              </p>
            </div>

            {isChain && (
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-[13px] font-semibold">
                    Sucursales ({branches.length} de {sucursalesRangeLabel(catalog)})
                  </div>
                </div>
                <div className="mt-1 overflow-hidden rounded-[12px] border border-stone-200 bg-white">
                  {branches.map((b, idx) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[14px]" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{b.name}</div>
                        <div className="text-[12px]" style={{ color: catalog.zoneRestricted && !isInPlanZone(b.city) ? "#C77700" : MUTED }}>
                          {b.city || "Sin ciudad"}
                          {idx === 0 ? " · este negocio" : ""}
                        </div>
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setExtraBranches((prev) => prev.filter((e) => e.id !== b.id))}
                          className="mf-tap flex-shrink-0 px-2 py-1 text-[13px] font-semibold"
                          style={{ color: "#FF3B30" }}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {branches.length < catalog.sucursalesMax && (
                  <select
                    value=""
                    onChange={(e) => {
                      const opt = branchOptions.find((o) => o.id === e.target.value);
                      if (opt) setExtraBranches((prev) => [...prev, opt]);
                    }}
                    className="mt-2 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px]"
                    aria-label="Añadir sucursal"
                  >
                    <option value="">{availableToAdd.length === 0 ? "No hay más negocios sin plan" : "Añadir otra sucursal…"}</option>
                    {availableToAdd.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.city ? ` · ${o.city}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {outOfZone.length > 0 && (
                  <div className="mt-2 rounded-[12px] px-3 py-2.5 text-[13px] leading-relaxed" style={{ background: "#FFF3D6" }}>
                    Este plan es para {PLAN_ZONE_LABEL}. Fuera de zona o sin ciudad: <strong>{outOfZone.map((o) => o.name).join(", ")}</strong>.
                    <label className="mt-1.5 flex items-center gap-2 font-semibold">
                      <input type="checkbox" checked={outOfZoneOk} onChange={(e) => setOutOfZoneOk(e.target.checked)} className="h-4 w-4" />
                      Contratar de todos modos
                    </label>
                  </div>
                )}
              </div>
            )}

            {catalog.key === "starter" ? (
              <label className="block text-[13px] font-semibold">
                Visitas al mes
                <select
                  value={visitsPerMonth}
                  onChange={(e) => setVisitsPerMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "visita" : "visitas"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-[12px] px-3 py-2.5 text-[13px]" style={{ background: "#F2F2F7" }}>
                <strong>{catalog.visitsPerMonth} visitas al mes por sucursal</strong> (una por semana)
              </div>
            )}

            <label className="block text-[13px] font-semibold">
              Tarifa por visita (MXN)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={pricePerVisit}
                onChange={(e) => setPricePerVisit(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
              />
            </label>

            <div>
              <div className="text-[13px] font-semibold">Arranca en</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[suggestedStart, otherStart].map((opt) => (
                  <button
                    key={opt.month}
                    type="button"
                    onClick={() => setStartMonth(opt.month)}
                    className="mf-tap rounded-[12px] px-3 py-2.5 text-[14px] font-semibold"
                    style={
                      startMonth === opt.month
                        ? { background: "#F24444", color: "#fff" }
                        : { background: "#fff", color: "#111", border: "1px solid rgba(60,60,67,0.18)" }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-[13px] font-semibold">
              Foodie por default (opcional)
              <select
                value={defaultFoodieId}
                onChange={(e) => setDefaultFoodieId(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
              >
                <option value="">Lo asigno después, visita por visita</option>
                {foodies.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.pendingCount === 0 ? "libre" : `${f.pendingCount} pendientes`}
                  </option>
                ))}
              </select>
            </label>
            <p className="-mt-2 text-[12px]" style={{ color: MUTED }}>
              Para cuidar el anonimato conviene rotar de Foodie y no repetir al mismo en la misma sucursal.
            </p>

            {isChain && (
              <label className="block text-[13px] font-semibold">
                Correo para el ticket
                <input
                  type="email"
                  inputMode="email"
                  value={ticketEmail}
                  onChange={(e) => setTicketEmail(e.target.value)}
                  placeholder={defaultTicketEmail || "correo del responsable de la marca"}
                  className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
                />
              </label>
            )}

            <label className="block text-[13px] font-semibold">
              Indicaciones para el Foodie (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej. ir en turno de cena, no visitar en fin de semana…"
                className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
              />
            </label>

            {(() => {
              const to = (isChain && ticketEmail.trim()) || defaultTicketEmail;
              return (
                <div className="rounded-[12px] px-3 py-3 text-[13px] leading-relaxed" style={{ background: "#F2F2F7" }}>
                  {branches.length > 1 ? `${branches.length} sucursales × ${visits} visitas × ${formatMxn(price)} = ` : `${visits} × ${formatMxn(price)} = `}
                  <strong>{formatMxn(total)}/mes</strong> + reembolso del ticket de consumo. Al contratar, se generan las visitas del mes y{" "}
                  {to ? (
                    <>
                      se envía <strong>un ticket de servicio</strong> a {to}.
                    </>
                  ) : (
                    <>no hay correo, así que no se enviará el ticket.</>
                  )}
                </div>
              );
            })()}

            {error && <p className="text-[13px] font-semibold" style={{ color: "#FF3B30" }}>{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || total <= 0 || !countOk || blockedByZone}
                onClick={async () => {
                  const ok = await call(
                    "/api/planes",
                    "POST",
                    {
                      planKey,
                      clientId,
                      clientIds: isChain ? branches.map((b) => b.id) : undefined,
                      visitsPerMonth: visits,
                      pricePerVisit: price,
                      startMonth,
                      defaultFoodieId: defaultFoodieId || null,
                      notes,
                      ticketEmail: isChain && ticketEmail.trim() ? ticketEmail.trim() : undefined,
                      confirmOutOfZone: outOfZoneOk,
                    },
                    ticketMessage
                  );
                  if (ok) setOpen(false);
                }}
                className="mf-tap flex-1 rounded-[14px] py-3 text-[15px] font-bold text-white disabled:opacity-50"
                style={{ background: "#F24444" }}
              >
                {busy ? "Contratando…" : `Contratar ${catalog.name}`}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="mf-tap rounded-[14px] px-4 py-3 text-[15px] font-semibold" style={{ background: "#fff", border: "1px solid rgba(60,60,67,0.18)" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {notice && <p className="mt-3 text-[13px] font-semibold" style={{ color: "#248A3D" }}>{notice}</p>}
      </div>
    );
  }

  // ----------------------------------------------------------------- con plan
  const { plan } = view;
  const currentVisits = view.visits.filter((v) => v.month === view.month);
  const overdue = view.visits.filter((v) => v.overdue);
  const monthTotal = plan.visitsPerMonth * plan.pricePerVisit;
  const statusChip =
    plan.status === "activo"
      ? { label: "Activo", bg: "#E8F8EC", color: "#248A3D" }
      : { label: "En pausa", bg: "#FFF3D6", color: "#946200" };

  const visitRow = (v: (typeof view.visits)[number]) => (
    <div key={v.id} className="py-2.5" style={{ borderTop: "1px solid rgba(60,60,67,0.08)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-[14px]">
          <span className="font-semibold">Visita {v.seq ?? ""}</span>
          {v.overdue && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#FFE5E3", color: "#C0271D" }}>
              {v.month < view.month ? `${monthName(v.month)} · ` : ""}atrasada
            </span>
          )}
          <div className="truncate text-[12px]" style={{ color: MUTED }}>
            {v.status === "completada"
              ? "Hecha"
              : v.status === "cancelada"
                ? "Cancelada"
                : `${v.assignedToName ? `Foodie: ${v.assignedToName}` : "Sin Foodie asignado"}${v.windowLabel ? ` · ${v.windowLabel}` : ""}`}
          </div>
        </div>
        {v.status === "completada" && v.shortCode && (
          <Link href={`/r/${v.shortCode}`} className="flex-shrink-0 text-[13px] font-semibold text-brand-500">
            Ver reporte
          </Link>
        )}
      </div>

      {v.status === "pendiente" && (
        <div className="mt-2 flex gap-2">
          <select
            value={assignFor[v.id] ?? ""}
            onChange={(e) => setAssignFor((prev) => ({ ...prev, [v.id]: e.target.value }))}
            className="min-w-0 flex-1 rounded-[12px] border border-stone-200 bg-white px-3 py-2 text-[16px]"
            aria-label="Foodie para esta visita"
          >
            <option value="">{v.assignedToName ? "Reasignar a…" : "Elige un Foodie…"}</option>
            {foodies.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.pendingCount === 0 ? "libre" : `${f.pendingCount} pend.`}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !assignFor[v.id]}
            onClick={() => call(`/api/asignaciones/${v.id}`, "PATCH", { assignedTo: assignFor[v.id] }, () => "Visita asignada y Foodie avisado.")}
            className="mf-tap flex-shrink-0 rounded-[12px] px-3.5 py-2 text-[14px] font-bold text-white disabled:opacity-40"
            style={{ background: "#F24444" }}
          >
            Asignar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div id="plan" className="card mx-5 mt-4 scroll-mt-20 p-4 md:mx-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-bold">
            Plan {plan.planName} · {formatMxn(monthTotal)}/mes{view.group ? " por sucursal" : ""}
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
            {plan.visitsPerMonth} × {formatMxn(plan.pricePerVisit)} + reembolso del ticket · desde {monthName(plan.startMonth)}
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: statusChip.bg, color: statusChip.color }}>
          {statusChip.label}
        </span>
      </div>

      {view.group && (
        <p className="mt-3 rounded-[12px] px-3 py-2 text-[13px] leading-relaxed" style={{ background: "#F2F2F7" }}>
          Contratación de <strong>{view.group.size} sucursales</strong> ({formatMxn(view.group.monthlyTotal)}/mes en total): {view.group.names.join(", ")}.
          El cobro y el ticket son uno solo para todas.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 rounded-[12px] px-3 py-2.5" style={{ background: "#F2F2F7" }}>
        <Dots done={view.done} total={view.quota} />
        <div className="text-[14px] font-semibold">
          {view.done} de {view.quota} visitas · {view.monthLabel}
        </div>
      </div>

      {view.currentPeriod && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[13px]">
            Cobro de {view.monthLabel}: <strong>{formatMxn(view.group ? view.group.monthlyTotal : view.currentPeriod.amount)}</strong>
            <span className="ml-2 font-semibold" style={{ color: view.currentPeriod.paidAt ? "#248A3D" : "#C77700" }}>
              {view.currentPeriod.paidAt ? "Cobrado" : "Pendiente"}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              call(`/api/planes/${plan.id}`, "PATCH", { markPaid: { month: view.month, paid: !view.currentPeriod?.paidAt } }, () => null)
            }
            className="mf-tap flex-shrink-0 rounded-[12px] px-3 py-2 text-[13px] font-bold disabled:opacity-50"
            style={view.currentPeriod.paidAt ? { background: "#fff", border: "1px solid rgba(60,60,67,0.18)" } : { background: "#34C759", color: "#fff" }}
          >
            {view.currentPeriod.paidAt ? "Deshacer" : view.group ? "Marcar cobrado (todas)" : "Marcar cobrado"}
          </button>
        </div>
      )}

      <div className="mt-3">
        {[...overdue, ...currentVisits.filter((v) => !v.overdue)].map(visitRow)}
        {view.visits.length === 0 && (
          <p className="py-2 text-[13px]" style={{ color: MUTED }}>
            Aún no hay visitas generadas para este mes{plan.status === "activo" && plan.startMonth > view.month ? ` (el plan arranca en ${monthName(plan.startMonth)})` : ""}.
          </p>
        )}
      </div>

      <label className="mt-3 block text-[12px] font-semibold" style={{ color: MUTED }}>
        Foodie por default (también para las visitas que sigan sin Foodie)
        <select
          value={plan.defaultFoodieId ?? ""}
          disabled={busy}
          onChange={(e) => call(`/api/planes/${plan.id}`, "PATCH", { defaultFoodieId: e.target.value || null }, () => "Foodie por default actualizado.")}
          className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2 text-[16px] font-normal text-black"
        >
          <option value="">Ninguno (lo asigno visita por visita)</option>
          {foodies.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      {plan.notes && (
        <p className="mt-3 rounded-[12px] px-3 py-2 text-[13px]" style={{ background: "#FFF9E5" }}>
          <strong>Indicaciones para el Foodie:</strong> {plan.notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!clientEmail && !view.group)}
          onClick={() => call(`/api/planes/${plan.id}`, "PATCH", { resendTicket: true }, ticketMessage)}
          className="mf-tap rounded-[12px] px-3 py-2 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: "#fff", border: "1px solid rgba(60,60,67,0.18)" }}
        >
          {plan.ticketSentAt ? "Reenviar ticket" : "Enviar ticket"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(`/api/planes/${plan.id}`, "PATCH", { status: plan.status === "activo" ? "pausado" : "activo" }, () =>
              plan.status === "activo" ? "Plan en pausa: no se generarán visitas nuevas." : "Plan reactivado."
            )
          }
          className="mf-tap rounded-[12px] px-3 py-2 text-[13px] font-semibold"
          style={{ background: "#fff", border: "1px solid rgba(60,60,67,0.18)" }}
        >
          {plan.status === "activo" ? "Pausar" : "Reanudar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("¿Cancelar este plan? Las visitas pendientes se cancelan y ya no se generan más. Las visitas hechas se conservan.")) {
              call(`/api/planes/${plan.id}`, "PATCH", { status: "cancelado" }, () => "Plan cancelado.");
            }
          }}
          className="mf-tap rounded-[12px] px-3 py-2 text-[13px] font-semibold"
          style={{ background: "#fff", color: "#FF3B30", border: "1px solid rgba(255,59,48,0.3)" }}
        >
          Cancelar plan
        </button>
      </div>

      {plan.ticketSentAt && !notice && (
        <p className="mt-2 text-[12px]" style={{ color: MUTED }}>
          Ticket enviado el {new Date(plan.ticketSentAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" })}.
        </p>
      )}
      {notice && <p className="mt-3 text-[13px] font-semibold" style={{ color: "#248A3D" }}>{notice}</p>}
      {error && <p className="mt-3 text-[13px] font-semibold" style={{ color: "#FF3B30" }}>{error}</p>}
    </div>
  );
}
