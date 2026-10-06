"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Foodie } from "@/lib/dashboard";
import { friendlyError } from "@/lib/friendlyError";

export default function MobileAsignarVisita({
  clientId,
  clientName,
  foodies,
}: {
  clientId: string;
  clientName: string;
  foodies: Foodie[];
}) {
  const router = useRouter();
  // Sin Foodie preseleccionado a propósito: con el primero ya marcado, un
  // toque rápido en "Asignar" mandaba la visita a la persona equivocada.
  const [assignedTo, setAssignedTo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, assignedTo, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo asignar la visita");
        return;
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="md:hidden mf-push-in" style={{ background: "#F2F2F7", minHeight: "100vh" }}>
      <div
        className="flex items-center px-3 py-[14px]"
        style={{ background: "rgba(249,249,251,0.92)", borderBottom: "1px solid rgba(60,60,67,0.1)" }}
      >
        <Link
          href={`/negocios/${clientId}`}
          className="mf-tap -my-2.5 -ml-1 flex items-center gap-1 py-2.5 pl-2 pr-4"
          style={{ color: "#F24444" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M15 6l-6 6 6 6" stroke="#F24444" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[16px]">{clientName}</span>
        </Link>
      </div>

      <div className="px-5 pb-8 pt-5">
        <div className="heading text-[24px] font-bold">Asignar visita</div>
        <div className="mt-0.5 text-[13.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Elige un Foodie para {clientName}. Recibirá un correo de notificación.
        </div>

        {done ? (
          <div className="card mt-5 flex flex-col items-center gap-3 p-6 text-center">
            <svg width="44" height="44" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="#34C759" />
              <path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-[15px] font-bold">Visita asignada</div>
            <Link
              href={`/negocios/${clientId}`}
              className="mf-tap mt-1 w-full rounded-[14px] py-3 text-center text-[14.5px] font-bold text-white"
              style={{ background: "#F24444" }}
            >
              Volver al negocio
            </Link>
          </div>
        ) : foodies.length === 0 ? (
          <div className="card mt-5 p-5 text-center text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            Aún no hay Foodies invitados.
            <Link href="/perfil" className="mt-3 block font-semibold" style={{ color: "#F24444" }}>
              Invitar a un Foodie desde tu Perfil
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card mt-5 p-[18px]">
            <div className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
              Foodie
            </div>
            <div className="mt-1.5 space-y-2">
              {foodies.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAssignedTo(f.id)}
                  className="mf-tap flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left"
                  style={{
                    background: assignedTo === f.id ? "rgba(242,68,68,0.1)" : "#F2F2F7",
                    border: assignedTo === f.id ? "1.5px solid #F24444" : "1.5px solid transparent",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{f.fullName || f.email}</div>
                    {f.fullName && (
                      <div className="truncate text-[11.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                        {f.email}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex-shrink-0 rounded-lg px-2 py-[3px] text-[11px] font-bold"
                    style={
                      f.pendingCount === 0
                        ? { background: "rgba(52,199,89,0.12)", color: "#248A3D" }
                        : { background: "rgba(255,149,0,0.12)", color: "#B25E00" }
                    }
                  >
                    {f.pendingCount === 0
                      ? "Libre"
                      : `${f.pendingCount} pendiente${f.pendingCount === 1 ? "" : "s"}`}
                  </div>
                  {assignedTo === f.id && (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="#F24444" />
                      <path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
                Nota (opcional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5 w-full rounded-[14px] px-3.5 py-3"
                style={{ background: "#F2F2F7", fontSize: 16, minHeight: 72 }}
                placeholder="Ej. visitar en horario de comida"
              />
            </label>

            {error && (
              <p className="mt-3 text-[13px]" style={{ color: "#FF3B30" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !assignedTo}
              className="mf-tap mt-4 w-full rounded-[14px] py-3.5 text-center text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: "#F24444" }}
            >
              {submitting ? "Asignando..." : assignedTo ? "Asignar visita" : "Elige un Foodie"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
