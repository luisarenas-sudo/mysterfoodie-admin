"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/friendlyError";

export type BajaOwnerOption = { id: string; label: string };
export type BajaBusiness = {
  id: string;
  name: string;
  city: string | null;
  visits: number;
  ownerId: string | null;
  ownerLabel: string | null;
};
export type BajaItem = {
  id: string;
  who: string;
  email: string;
  roleLabel: string;
  removedAt: string;
  status: "pendiente" | "revisada";
  visits: number;
  assignments: number;
  businesses: BajaBusiness[];
};

async function post(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/bajas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return res.ok ? null : data.error || "No se pudo completar";
  } catch (err) {
    return friendlyError(err);
  }
}

function BusinessRow({ b, owners }: { b: BajaBusiness; owners: BajaOwnerOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const err = await post(body);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <li className="rounded-md border border-stone-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{b.name}</p>
          <p className="text-xs text-stone-500">
            {b.city || "Sin ciudad"} · {b.visits} {b.visits === 1 ? "visita" : "visitas"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.ownerId ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {b.ownerId ? `Dueño: ${b.ownerLabel}` : "Sin dueño"}
        </span>
      </div>

      {confirmDelete ? (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
          Se eliminará <strong>{b.name}</strong> con sus {b.visits} {b.visits === 1 ? "visita" : "visitas"} y reportes. No se puede deshacer.
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => run({ action: "deleteClient", clientId: b.id })} className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
              {busy ? "Eliminando..." : "Sí, eliminar negocio"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-600">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            disabled={busy}
            value={b.ownerId ?? ""}
            onChange={(e) => run({ action: "assign", clientId: b.id, ownerId: e.target.value || null })}
            className="input min-w-0 flex-1 text-sm"
            aria-label={`Dueño de ${b.name}`}
          >
            <option value="">Sin dueño (cuenta como Master Chef)</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            Eliminar negocio
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function Removal({ item, owners }: { item: BajaItem; owners: BajaOwnerOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const withoutOwner = item.businesses.filter((b) => !b.ownerId).length;
  const date = new Date(item.removedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  async function resolve() {
    setBusy(true);
    await post({ action: "resolve", removalId: item.id });
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">{item.who}</h2>
          <p className="text-xs text-stone-500">
            {item.email} · {item.roleLabel} · baja el {date}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "pendiente" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
          {item.status === "pendiente" ? "Por revisar" : "Revisada"}
        </span>
      </div>

      <p className="mt-3 text-sm text-stone-600">
        Pasaron a ti: <strong>{item.visits}</strong> {item.visits === 1 ? "visita registrada" : "visitas registradas"} y{" "}
        <strong>{item.assignments}</strong> {item.assignments === 1 ? "asignación" : "asignaciones"}.
      </p>

      {item.businesses.length > 0 ? (
        <>
          <p className="mt-3 text-sm font-medium text-ink">
            Negocios que había dado de alta ({item.businesses.length})
            {withoutOwner > 0 && <span className="text-amber-700"> · {withoutOwner} sin dueño</span>}
          </p>
          <ul className="mt-2 space-y-2">
            {item.businesses.map((b) => (
              <BusinessRow key={b.id} b={b} owners={owners} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-stone-500">No había dado de alta negocios.</p>
      )}

      {item.status === "pendiente" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {withoutOwner > 0 ? (
            <p className="text-xs text-stone-500">Mientras no asignes dueño, estos negocios cuentan como tuyos (Master Chef).</p>
          ) : (
            <span />
          )}
          <button type="button" disabled={busy} onClick={resolve} className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? "Guardando..." : "Marcar revisión completa"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function BajaReview({ items, owners }: { items: BajaItem[]; owners: BajaOwnerOption[] }) {
  if (items.length === 0) {
    return <p className="mt-6 card p-5 text-center text-sm text-stone-400">No hay bajas registradas.</p>;
  }
  return (
    <div className="mt-6 space-y-4">
      {items.map((i) => (
        <Removal key={i.id} item={i} owners={owners} />
      ))}
    </div>
  );
}
