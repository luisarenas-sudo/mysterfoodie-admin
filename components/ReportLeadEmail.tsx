"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * «Recibe tu resumen por correo» en el reporte público, antes del pago: una acción de poco compromiso que nos da un correo
 * para mandarle el resumen y, después, dos recordatorios. Variante `mobile` con el estilo de la app.
 */
export default function ReportLeadEmail({ shortCode, mobile = false, gate = false }: { shortCode: string; mobile?: boolean; gate?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/reportes/correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortCode, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setState("done");
        // En modo candado, al dejar el correo se abre el resumen por categoría.
        if (gate) window.setTimeout(() => router.refresh(), 900);
      } else {
        setMessage(data.error || "No pudimos enviarlo. Intenta de nuevo.");
        setState("error");
      }
    } catch {
      setMessage("No pudimos enviarlo. Revisa tu conexión e intenta de nuevo.");
      setState("error");
    }
  }

  const wrap = mobile ? "card mx-5 mt-4 p-[18px]" : "mt-4 rounded-lg border border-stone-200 bg-white p-5";

  if (state === "done") {
    return (
      <div className={wrap + " text-center"}>
        <p className={mobile ? "text-[15px] font-bold" : "font-semibold text-ink"}>Listo, te lo enviamos ✅</p>
        <p className={mobile ? "mt-1 text-[13px]" : "mt-1 text-sm text-stone-500"} style={mobile ? { color: "rgba(60,60,67,0.6)" } : undefined}>
          Revisa tu bandeja y, por si acaso, la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={wrap}>
      <p className={mobile ? "text-center text-[15px] font-bold" : "text-center font-semibold text-ink"}>{gate ? "📩 Ve tu resumen por categoría" : "📩 Recibe tu resumen por correo"}</p>
      <p className={mobile ? "mt-0.5 text-center text-[13px]" : "mt-0.5 text-center text-sm text-stone-500"} style={mobile ? { color: "rgba(60,60,67,0.6)" } : undefined}>
        {gate ? "Déjanos tu correo: abrimos tu resumen al instante y te lo enviamos para verlo con calma." : "Para verlo con calma o compartirlo con tu equipo."}
      </p>
      <div className={mobile ? "mt-3 rounded-xl px-3.5" : "mt-3"} style={mobile ? { background: "#F2F2F7" } : undefined}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu correo"
          type="email"
          required
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          className={mobile ? "w-full bg-transparent py-3 text-[16px] outline-none" : "input w-full text-sm"}
        />
      </div>
      {state === "error" && (
        <p className="mt-2 text-center text-[13px]" style={{ color: "#C7301E" }}>
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className={mobile ? "mf-tap mt-3 block w-full rounded-[14px] py-3 text-center text-[15px] font-bold disabled:opacity-60" : "mt-3 w-full rounded-md border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"}
        style={mobile ? { background: "rgba(242,68,68,0.1)", color: "#F24444" } : undefined}
      >
        {state === "sending" ? "Enviando…" : gate ? "Ver mi resumen" : "Enviármelo"}
      </button>
    </form>
  );
}
