"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/friendlyError";

/**
 * Acciones por usuario en /admin/usuarios: reenviar la invitación (si todavía
 * no activa su cuenta) y eliminar (con confirmación; se le avisa por correo).
 */
export default function UserActions({
  userId,
  email,
  name,
  pending,
  isSelf,
}: {
  userId: string;
  email: string;
  name: string | null;
  pending: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (isSelf) return null;

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, resendInvite: true }),
      });
      const data = await res.json();
      if (!res.ok) setMessage({ type: "error", text: data.error || "No se pudo reenviar" });
      else setMessage({ type: "ok", text: "Invitación enviada (vale 5 días)" });
    } catch (err) {
      setMessage({ type: "error", text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo eliminar" });
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: friendlyError(err) });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {confirming ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p>
            ¿Eliminar a <strong>{name || email}</strong>? Se le avisará por correo y ya no podrá entrar. Sus visitas pasan a ti y
            sus negocios quedan <strong>sin dueño</strong> para que tú decidas uno por uno (aparece en Pendientes).
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-600">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {pending && (
            <button type="button" disabled={busy} onClick={resend} className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-ink hover:bg-stone-50 disabled:opacity-50">
              {busy ? "Enviando..." : "Reenviar invitación"}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => { setMessage(null); setConfirming(true); }} className="rounded-md px-2.5 py-1 font-medium text-red-600 hover:bg-red-50">
            Eliminar
          </button>
        </div>
      )}
      {message && <p className={`text-xs ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}
