"use client";

import { useState } from "react";

const SLOTS = ["Desayuno", "Comida", "Cena", "Me da igual"];

/** Día + horario y «Pagar y asegurar mi visita»: guarda la elección y lleva a Mercado Pago. */
export default function AsegurarVisitaForm({ id, minDate, maxDate }: { id: string; minDate: string; maxDate: string }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/asegurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, date, slot }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; payUrl?: string };
      if (res.ok && data.payUrl) {
        window.location.href = data.payUrl;
        return;
      }
      setMessage(data.error || "No pudimos continuar. Intenta de nuevo.");
    } catch {
      setMessage("No pudimos continuar. Revisa tu conexión e intenta de nuevo.");
    }
    setState("error");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 text-left">
      <label className="block text-sm font-semibold text-ink">
        Día que prefieres
        <input type="date" required min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1 w-full" />
      </label>
      <label className="block text-sm font-semibold text-ink">
        Horario
        <select required value={slot} onChange={(e) => setSlot(e.target.value)} className="input mt-1 w-full">
          <option value="">Elige un horario</option>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-stone-500">Lo confirmamos contigo según disponibilidad; el Master Chef te escribe por WhatsApp o correo.</p>
      {state === "error" && <p className="text-sm font-medium" style={{ color: "#C7301E" }}>{message}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="mf-tap block w-full rounded-[14px] py-[15px] text-center text-[16px] font-bold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}
      >
        {state === "sending" ? "Un momento…" : "Pagar y asegurar mi visita"}
      </button>
    </form>
  );
}
