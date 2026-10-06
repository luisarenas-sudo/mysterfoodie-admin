"use client";

import { ROLE_LABELS as BRAND_ROLE_LABELS } from "@/lib/brand";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/friendlyError";

type RoleOption = "admin" | "agente" | "cliente" | "sibarita";

// Nombres visibles de los rangos (ver "Tu rango" en /perfil): el valor
// interno del rol (admin/agente/cliente) no cambia -- sigue siendo lo
// que usan middleware.ts, requireRole() y la base de datos -- solo se
// renombra la etiqueta que ve la persona.
const ROLE_LABELS = BRAND_ROLE_LABELS;

export default function UserRoleEditor({
  userId,
  initialRole,
  isSelf,
}: {
  userId: string;
  initialRole: RoleOption;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<RoleOption>(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return (
      <span className="inline-flex items-center gap-1.5 capitalize text-ink">
        {ROLE_LABELS[initialRole]}
        <span className="text-xs font-normal normal-case text-stone-400">(tú)</span>
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setRole(initialRole);
          setError(null);
          setEditing(true);
        }}
        className="group inline-flex items-center gap-2 capitalize text-ink"
      >
        {ROLE_LABELS[initialRole]}
        <span className="text-xs font-normal normal-case text-brand-500 underline-offset-2 group-hover:underline">
          editar
        </span>
      </button>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el rol");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as RoleOption)}
        className="input w-auto py-1 text-xs"
        disabled={saving}
        autoFocus
      >
        <option value="admin">{ROLE_LABELS.admin}</option>
        <option value="sibarita">{ROLE_LABELS.sibarita}</option>
        <option value="agente">{ROLE_LABELS.agente}</option>
        <option value="cliente">{ROLE_LABELS.cliente}</option>
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || role === initialRole}
        className="rounded-md bg-brand-gradient px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setRole(initialRole);
          setError(null);
        }}
        disabled={saving}
        className="text-xs text-stone-400 hover:underline"
      >
        Cancelar
      </button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
