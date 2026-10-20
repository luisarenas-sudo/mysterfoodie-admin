"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/imageCompress";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });
}

/**
 * Tarjeta "Ticket de consumo" del detalle de una visita: subir, ver, cambiar o
 * quitar la foto del ticket (para visitas ya terminadas y enviadas). Botones
 * grandes pensados para el dedo; "Tomar foto" abre la cámara en el celular.
 */
export default function TicketCard({
  formId,
  hasTicket,
  uploadedAt,
  emailSentAt,
  reportUnlocked,
  consumptionTotal = null,
  partySize = null,
  variant = "mobile",
}: {
  formId: string;
  hasTicket: boolean;
  uploadedAt: string | null;
  emailSentAt: string | null;
  reportUnlocked: boolean;
  consumptionTotal?: number | null;
  partySize?: number | null;
  variant?: "mobile" | "desktop";
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const [total, setTotal] = useState(consumptionTotal != null ? String(consumptionTotal) : "");
  const [people, setPeople] = useState(partySize != null ? String(partySize) : "");
  const [saved, setSaved] = useState<"idle" | "saving" | "ok">("idle");

  const dirty =
    total.trim() !== (consumptionTotal != null ? String(consumptionTotal) : "") ||
    people.trim() !== (partySize != null ? String(partySize) : "");

  async function saveConsumo() {
    setSaved("saving");
    setError(null);
    try {
      const res = await fetch(`/api/visits/${formId}/consumo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumptionTotal: total.trim() === "" ? null : Number(total.replace(/,/g, "")),
          partySize: people.trim() === "" ? null : Number(people),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setSaved("ok");
      router.refresh();
    } catch (e) {
      setSaved("idle");
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file, { maxSide: 1600, quality: 0.82 });
      const fd = new FormData();
      fd.append("file", blob, "ticket.jpg");
      const res = await fetch(`/api/visits/${formId}/ticket`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo subir el ticket.");
      setCacheBust(Date.now());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el ticket.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("¿Quitar la foto del ticket? Si aún no se avisa al negocio, el aviso se cancela.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${formId}/ticket`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo quitar el ticket.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar el ticket.");
    } finally {
      setBusy(false);
    }
  }

  const status = !hasTicket
    ? "Sube la foto del ticket de consumo. 3 días después, el negocio recibe un correo avisándole."
    : emailSentAt
    ? `Aviso enviado al negocio el ${fmt(emailSentAt)}.`
    : uploadedAt
    ? `El aviso al negocio sale a partir del ${fmt(new Date(new Date(uploadedAt).getTime() + 3 * 86400000).toISOString())}${
        reportUnlocked ? " (solo para avisarle: ya tiene su reporte)." : " (con la oferta del reporte completo)."
      }`
    : "";

  const btn =
    "flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50";
  const muted = { color: "rgba(60,60,67,0.6)" } as const;
  const isMobile = variant === "mobile";

  return (
    <div className="card p-4">
      <p className={isMobile ? "text-[13px] font-bold uppercase tracking-wide" : "text-sm font-medium text-stone-700"} style={isMobile ? muted : undefined}>
        Ticket de consumo
      </p>

      {hasTicket && (
        <a
          href={`/api/visits/${formId}/ticket?v=${cacheBust}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-xl"
          style={{ background: "#F2F2F7", border: "1px solid rgba(60,60,67,0.1)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/visits/${formId}/ticket?v=${cacheBust}`}
            alt="Ticket de consumo"
            className="mx-auto max-h-72 w-auto object-contain"
          />
        </a>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[12px] font-semibold" style={muted}>Total del consumo (MXN)</span>
          <input
            inputMode="decimal"
            value={total}
            onChange={(e) => { setTotal(e.target.value.replace(/[^0-9.,]/g, "")); setSaved("idle"); }}
            placeholder="Ej. 850"
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-[16px]"
            style={{ background: "#F2F2F7", border: "1px solid rgba(60,60,67,0.1)" }}
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold" style={muted}>¿Cuántas personas fueron?</span>
          <input
            inputMode="numeric"
            value={people}
            onChange={(e) => { setPeople(e.target.value.replace(/[^0-9]/g, "").slice(0, 2)); setSaved("idle"); }}
            placeholder="Ej. 2"
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-[16px]"
            style={{ background: "#F2F2F7", border: "1px solid rgba(60,60,67,0.1)" }}
          />
        </label>
      </div>
      {(dirty || saved === "ok") && (
        <button
          type="button"
          disabled={saved === "saving" || !dirty}
          onClick={saveConsumo}
          className="mt-2 w-full rounded-2xl py-3 text-[14px] font-bold disabled:opacity-60"
          style={{ background: saved === "ok" && !dirty ? "#E8F7EE" : "#1C1C1E", color: saved === "ok" && !dirty ? "#1E8E4E" : "#fff" }}
        >
          {saved === "saving" ? "Guardando…" : saved === "ok" && !dirty ? "Guardado" : "Guardar total y personas"}
        </button>
      )}

      <p className="mt-3 text-[13px] leading-snug" style={muted}>
        {status}
      </p>

      <div className="mt-3 flex gap-2.5">
        <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className={btn} style={{ background: "#F24444", color: "#fff" }}>
          {busy ? "Subiendo…" : hasTicket ? "Tomar otra foto" : "Tomar foto"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className={btn}
          style={{ background: "#fff", color: "#F24444", border: "1.5px solid #F24444" }}
        >
          Elegir de galería
        </button>
      </div>
      {hasTicket && (
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="mt-2 w-full rounded-2xl py-3 text-[14px] font-semibold disabled:opacity-50"
          style={{ color: "#FF3B30" }}
        >
          Quitar foto del ticket
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-xl px-3 py-2 text-[13px] font-medium" style={{ background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>
          {error}
        </p>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}
