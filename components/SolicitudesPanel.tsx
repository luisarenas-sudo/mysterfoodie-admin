"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Assignee, SolicitudRow } from "@/lib/visitRequests";

const MUTED = "rgba(60,60,67,0.6)";
const TYPE_LABEL: Record<string, string> = { restaurante: "Restaurante", bar: "Bar", cafeteria: "Cafetería", otro: "Negocio" };

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pendiente: { label: "Por asignar", bg: "#FFE5E3", fg: "#C0271D" },
  asignada: { label: "Asignada", bg: "#E5F0FF", fg: "#0A58C2" },
  completada: { label: "Visitada", bg: "#E8F8EC", fg: "#248A3D" },
  sin_foodie: { label: "Sin Foodie", bg: "#FFF3D6", fg: "#946200" },
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

export default function SolicitudesPanel({ rows, assignees, meId }: { rows: SolicitudRow[]; assignees: Assignee[]; meId: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function assign(id: string) {
    const assignedTo = choice[id];
    if (!assignedTo) {
      setMsg((m) => ({ ...m, [id]: "Elige a quién asignarla." }));
      return;
    }
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: "" }));
    try {
      const res = await fetch(`/api/solicitudes/${id}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo asignar");
      router.refresh();
    } catch (err) {
      setMsg((m) => ({ ...m, [id]: err instanceof Error ? err.message : "No se pudo asignar" }));
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card mt-5 p-5 text-[14px]" style={{ color: MUTED }}>
        Todavía no hay solicitudes. Cuando un negocio use el botón <strong>Solicita una visita GRATIS</strong> en mysterfoodie.com, aparecerá aquí.
      </div>
    );
  }

  const options = (role: Assignee["role"]) => assignees.filter((a) => a.role === role);

  return (
    <div className="mt-5 space-y-3">
      {rows.map((r) => {
        const st = STATUS[r.status];
        const closed = r.status === "completada";
        return (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/negocios/${r.clientId}`} className="block truncate text-[16px] font-bold hover:text-brand-500">
                  {r.clientName}
                </Link>
                <div className="text-[12.5px]" style={{ color: MUTED }}>
                  {TYPE_LABEL[r.clientType] ?? "Negocio"}
                  {r.city ? ` · ${r.city}` : ""} · pidió el {fmt(r.createdAt)}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>
                {r.status === "asignada" && r.inOpenPool ? "En bolsa de Foodies" : st.label}
              </span>
            </div>

            <div className="mt-2 space-y-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.8)" }}>
              {r.address && <div>📍 {r.address}</div>}
              {r.contactName && <div>👤 {r.contactName}</div>}
              {r.email && <div>✉️ {r.email}</div>}
              {r.phone && <div>📞 {r.phone}</div>}
              {r.instagram && <div>📷 @{r.instagram}</div>}
              {r.message && (
                <div className="mt-1 rounded-lg px-2.5 py-1.5" style={{ background: "#F2F2F7" }}>
                  {r.message}
                </div>
              )}
            </div>

            {r.status === "asignada" && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "#F2F8FF", color: "rgba(60,60,67,0.85)" }}>
                Asignada a <strong>{r.assignedToName ?? "—"}</strong> el {fmt(r.assignedAt)}.{" "}
                {r.inOpenPool
                  ? `Ya está abierta a los Foodies; vence el ${fmt(r.expiresAt)}.`
                  : `En exclusiva hasta el ${fmt(r.openAt)}; luego se abre a los Foodies hasta el ${fmt(r.expiresAt)}.`}
                {r.assignedTo === meId && r.assignmentId && (
                  <>
                    {" "}
                    <Link href={`/nueva-visita/${r.assignmentId}`} className="font-bold text-brand-500 underline">
                      Hacer la visita
                    </Link>
                  </>
                )}
              </div>
            )}
            {r.status === "sin_foodie" && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "#FFF9E5", color: "rgba(60,60,67,0.85)" }}>
                Nadie hizo la visita a tiempo: el negocio ya recibió el correo con la tabla de paquetes. Puedes asignarla de nuevo si consigues a alguien.
              </div>
            )}

            {!closed && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={choice[r.id] ?? ""}
                  onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[14px]"
                  aria-label={`Asignar ${r.clientName} a`}
                >
                  <option value="">{r.status === "asignada" ? "Reasignar a…" : "Asignar a…"}</option>
                  {options("admin").length > 0 && (
                    <optgroup label="Master Chef">
                      {options("admin").map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id === meId ? "Yo (Master Chef)" : a.name} · {a.pendingCount} pendientes
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {options("sibarita").length > 0 && (
                    <optgroup label="Sibaritas">
                      {options("sibarita").map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.pendingCount} pendientes
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {options("agente").length > 0 && (
                    <optgroup label="Foodies">
                      {options("agente").map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.pendingCount} pendientes
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => assign(r.id)}
                  disabled={busy === r.id}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60"
                >
                  {busy === r.id ? "Asignando…" : r.status === "asignada" ? "Reasignar" : "Asignar"}
                </button>
              </div>
            )}
            {msg[r.id] && <p className="mt-2 text-[12.5px] text-red-600">{msg[r.id]}</p>}
            {closed && (
              <p className="mt-3 text-[12.5px]" style={{ color: MUTED }}>
                Ya se hizo la visita a este negocio.
              </p>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-[11.5px]" style={{ color: MUTED }}>
        Quien reciba una asignación recibe un correo con el enlace directo a su visita. Fechas en horario CDMX.
      </p>
    </div>
  );
}
