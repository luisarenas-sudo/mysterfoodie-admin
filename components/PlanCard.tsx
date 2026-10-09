"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientPlanView } from "@/lib/plans";
import { formatMxn } from "@/lib/earningsMatrix";
import { friendlyError } from "@/lib/friendlyError";

const MUTED = "rgba(60,60,67,0.6)";

export type PlanFoodie = { id: string; name: string; pendingCount: number };

type Props = {
  clientId: string;
  clientEmail: string | null;
  view: ClientPlanView | null;
  foodies: PlanFoodie[];
  /** Mes en el que conviene arrancar (este mes si es principio de mes; si no, el siguiente). */
  suggestedStart: { month: string; label: string };
  otherStart: { month: string; label: string };
  catalog: { name: string; tagline: string; visitsPerMonth: number; pricePerVisit: number };
};

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
export default function PlanCard({ clientId, clientEmail, view, foodies, suggestedStart, otherStart, catalog }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulario de contratación
  const [visitsPerMonth, setVisitsPerMonth] = useState(catalog.visitsPerMonth);
  const [pricePerVisit, setPricePerVisit] = useState(String(catalog.pricePerVisit));
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
    if (t?.status === "sent") return `Ticket enviado a ${clientEmail}. Ahora te toca contactar al cliente.`;
    if (t?.status === "skipped_no_email") return "Listo. El negocio no tiene correo, así que no se envió el ticket: contáctalo por otro medio.";
    if (t?.status === "skipped_no_api_key") return "Listo, pero el correo no está configurado en el servidor (falta RESEND_API_KEY).";
    return "Listo, pero el correo del ticket no se pudo enviar. Puedes reenviarlo desde el plan.";
  };

  // ---------------------------------------------------------------- sin plan
  if (!view) {
    const total = visitsPerMonth * (Number(pricePerVisit) || 0);
    return (
      <div className="card mx-5 mt-4 p-4 md:mx-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold">Plan de visitas</div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
              Visitas mensuales con reporte incluido, por sucursal
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
            <div className="rounded-[12px] px-3 py-2.5 text-[13px]" style={{ background: "#F2F2F7" }}>
              <strong>Plan {catalog.name}</strong> · {catalog.tagline}
            </div>

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

            <label className="block text-[13px] font-semibold">
              Notas internas (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej. ir en turno de cena, no visitar en fin de semana…"
                className="mt-1 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[16px] font-normal"
              />
            </label>

            <div className="rounded-[12px] px-3 py-3 text-[13px] leading-relaxed" style={{ background: "#F2F2F7" }}>
              Total mensual: <strong>{formatMxn(total)}</strong> + reembolso del ticket de consumo. Al contratar, se generan las visitas del mes
              y {clientEmail ? <>se envía el <strong>ticket de servicio</strong> a {clientEmail}.</> : <>como el negocio no tiene correo, no se enviará el ticket.</>}
            </div>

            {error && <p className="text-[13px] font-semibold" style={{ color: "#FF3B30" }}>{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || total <= 0}
                onClick={async () => {
                  const ok = await call(
                    "/api/planes",
                    "POST",
                    { clientId, planKey: "starter", visitsPerMonth, pricePerVisit: Number(pricePerVisit), startMonth, defaultFoodieId: defaultFoodieId || null, notes },
                    ticketMessage
                  );
                  if (ok) setOpen(false);
                }}
                className="mf-tap flex-1 rounded-[14px] py-3 text-[15px] font-bold text-white disabled:opacity-50"
                style={{ background: "#F24444" }}
              >
                {busy ? "Contratando…" : "Contratar plan"}
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
          {v.overdue && <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#FFE5E3", color: "#C0271D" }}>{monthName(v.month)} · atrasada</span>}
          <div className="truncate text-[12px]" style={{ color: MUTED }}>
            {v.status === "completada"
              ? "Hecha"
              : v.status === "cancelada"
                ? "Cancelada"
                : v.assignedToName
                  ? `Foodie: ${v.assignedToName}`
                  : "Sin Foodie asignado"}
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
    <div className="card mx-5 mt-4 p-4 md:mx-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-bold">
            Plan {plan.planName} · {formatMxn(monthTotal)}/mes
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
            {plan.visitsPerMonth} × {formatMxn(plan.pricePerVisit)} + reembolso del ticket · desde {monthName(plan.startMonth)}
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: statusChip.bg, color: statusChip.color }}>
          {statusChip.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-[12px] px-3 py-2.5" style={{ background: "#F2F2F7" }}>
        <Dots done={view.done} total={view.quota} />
        <div className="text-[14px] font-semibold">
          {view.done} de {view.quota} visitas · {view.monthLabel}
        </div>
      </div>

      {view.currentPeriod && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[13px]">
            Cobro de {view.monthLabel}: <strong>{formatMxn(view.currentPeriod.amount)}</strong>
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
            {view.currentPeriod.paidAt ? "Deshacer" : "Marcar cobrado"}
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
        Foodie por default de los próximos meses
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
          <strong>Notas:</strong> {plan.notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !clientEmail}
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
