"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALIAS_STYLES, type AliasStyle } from "@/lib/alias";

/** Elegir el estilo del nombre anónimo, ver una propuesta y quedarse con ella (queda fija). */
export default function AliasPicker({ nextHref }: { nextHref?: string }) {
  const router = useRouter();
  const [style, setStyle] = useState<AliasStyle | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/perfil/alias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar");
      return data as { alias: string; existing?: boolean };
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const propose = async (s: AliasStyle) => {
    setStyle(s);
    const out = await call({ style: s, preview: true });
    if (out) setProposal(out.alias);
  };

  const keep = async () => {
    if (!style || !proposal) return;
    const out = await call({ style, alias: proposal });
    if (out) {
      router.push(nextHref || "/perfil");
      router.refresh();
    }
  };

  return (
    <div>
      <div className="space-y-2">
        {ALIAS_STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={busy}
            onClick={() => propose(s.value)}
            className="mf-tap flex min-h-[56px] w-full items-center justify-between rounded-[14px] px-4 text-left"
            style={{ background: style === s.value ? "rgba(242,68,68,0.1)" : "#fff", border: `1.5px solid ${style === s.value ? "#F24444" : "rgba(60,60,67,0.12)"}` }}
          >
            <span className="text-[16px] font-semibold">{s.label}</span>
            <span className="text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              ej. {s.example}
            </span>
          </button>
        ))}
      </div>
      {proposal && (
        <div className="card mt-4 px-4 py-5 text-center">
          <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            Tu nombre anónimo sería
          </div>
          <div className="heading mt-1 text-[28px] font-bold" style={{ color: "#F24444" }}>
            {proposal}
          </div>
          <div className="mt-4 flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => style && propose(style)} className="mf-tap min-h-[48px] flex-1 rounded-[14px] text-[15px] font-semibold" style={{ background: "rgba(60,60,67,0.08)" }}>
              Otro
            </button>
            <button type="button" disabled={busy} onClick={keep} className="mf-tap min-h-[48px] flex-1 rounded-[14px] text-[15px] font-semibold text-white" style={{ background: "#F24444" }}>
              Quedarme con este
            </button>
          </div>
          <p className="mt-3 text-[12px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
            Queda fijo: es el que verán quienes te escaneen y la liga de tu QR.
          </p>
        </div>
      )}
      {error && (
        <p className="mt-3 text-center text-[13px]" style={{ color: "#C7301E" }}>
          {error}
        </p>
      )}
    </div>
  );
}
