"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALIAS_STYLES, type AliasStyle } from "@/lib/alias";

const RED = "#F24444";
const MUTED = "rgba(60,60,67,0.6)";

type Props = {
  nextHref?: string;
  /** Perfil nuevo: 3 intentos y queda fijo. false = perfil que ya existía (puede cambiarlo sin tope). */
  capped: boolean;
  maxAttempts: number;
  /** Intentos ya gastados y nombres que le salieron (para no perderlos si recarga). */
  rollsUsed: number;
  proposals: string[];
  /** Estilo que eligió al llenar su solicitud, si lo hay. */
  initialStyle: AliasStyle | null;
  /** Solo perfiles existentes: el nombre actual. */
  currentAlias?: string | null;
};

/**
 * Elegir el nombre anónimo.
 * - Perfil nuevo: barra de 3 intentos; después de quedarse con uno ya no se puede cambiar.
 * - Perfil existente: puede ver propuestas sin tope y cambiar su nombre (las ligas viejas siguen funcionando).
 */
export default function AliasPicker({ nextHref, capped, maxAttempts, rollsUsed, proposals, initialStyle, currentAlias }: Props) {
  const router = useRouter();
  const [style, setStyle] = useState<AliasStyle | null>(initialStyle);
  const [used, setUsed] = useState(rollsUsed);
  const [list, setList] = useState<string[]>(proposals);
  const [picked, setPicked] = useState<string | null>(proposals.length ? proposals[proposals.length - 1] : null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, maxAttempts - used);

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/perfil/alias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar");
      return data as { alias: string; existing?: boolean; rollsUsed?: number; proposals?: string[] };
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const roll = async () => {
    if (!style) return setError("Primero elige un estilo.");
    setConfirming(false);
    const out = await call({ style, preview: true });
    if (!out) return;
    if (capped) {
      setUsed(out.rollsUsed ?? used + 1);
      setList(out.proposals ?? [...list, out.alias]);
    }
    setPicked(out.alias);
  };

  const keep = async () => {
    if (!picked) return;
    const out = await call(capped ? { alias: picked } : { style, alias: picked });
    if (out) {
      router.push(nextHref || "/perfil");
      router.refresh();
    }
  };

  const styleButtons = (
    <div className="space-y-2">
      {ALIAS_STYLES.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={busy}
          onClick={() => setStyle(s.value)}
          className="mf-tap flex min-h-[52px] w-full items-center justify-between rounded-[14px] px-4 text-left"
          style={{ background: style === s.value ? "rgba(242,68,68,0.1)" : "#fff", border: `1.5px solid ${style === s.value ? RED : "rgba(60,60,67,0.12)"}` }}
        >
          <span className="text-[16px] font-semibold">{s.label}</span>
          <span className="text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            ej. {s.example}
          </span>
        </button>
      ))}
    </div>
  );

  // ───────── Perfil que ya existía: cambiar sin tope ─────────
  if (!capped) {
    return (
      <div>
        {currentAlias && (
          <div className="card mb-4 px-4 py-3 text-[13.5px] leading-snug" style={{ color: MUTED }}>
            Tu nombre actual es <b style={{ color: "#1C1C1E" }}>{currentAlias}</b>. Si lo cambias, tu liga y tu QR de invitación usarán el nuevo; las ligas que ya compartiste con el nombre anterior siguen funcionando.
          </div>
        )}
        {styleButtons}
        <button
          type="button"
          disabled={busy || !style}
          onClick={roll}
          className="mf-tap mt-3 min-h-[48px] w-full rounded-[14px] text-[15px] font-semibold disabled:opacity-50"
          style={{ background: "rgba(60,60,67,0.08)" }}
        >
          {picked ? "Otro" : "Proponerme un nombre"}
        </button>
        {picked && (
          <div className="card mt-4 px-4 py-5 text-center">
            <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Tu nombre anónimo sería
            </div>
            <div className="heading mt-1 text-[28px] font-bold" style={{ color: RED }}>
              {picked}
            </div>
            <button type="button" disabled={busy} onClick={keep} className="mf-tap mt-4 min-h-[48px] w-full rounded-[14px] text-[15px] font-semibold text-white" style={{ background: RED }}>
              {currentAlias ? "Cambiar mi nombre" : "Quedarme con este"}
            </button>
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

  // ───────── Perfil nuevo: 3 intentos y queda fijo ─────────
  return (
    <div>
      {/* Barra de intentos + explicación */}
      <div className="card px-4 py-4">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span>{used === 0 ? "Tienes 3 intentos" : remaining > 0 ? `Intento ${used} de ${maxAttempts}` : "Usaste tus 3 intentos"}</span>
          <span style={{ color: remaining === 0 ? "#C7301E" : MUTED }}>{remaining === 1 ? "Te queda 1" : remaining === 0 ? "Elige uno" : `Te quedan ${remaining}`}</span>
        </div>
        <div className="mt-2.5 flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={maxAttempts} aria-valuenow={used} aria-label="Intentos usados">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i < used ? RED : "rgba(60,60,67,0.12)", transition: "background 350ms ease" }} />
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-snug" style={{ color: MUTED }}>
          Puedes pedir hasta {maxAttempts} nombres. Cuando te quedes con uno, <b>queda fijo para siempre</b>: no se puede cambiar. Es el que verán los negocios y el de tu liga de invitación.
        </p>
      </div>

      <div className="mt-4">{styleButtons}</div>

      {remaining > 0 && (
        <button
          type="button"
          disabled={busy || !style}
          onClick={roll}
          className="mf-tap mt-3 min-h-[50px] w-full rounded-[14px] text-[15px] font-semibold text-white disabled:opacity-50"
          style={{ background: used === 0 ? RED : "rgba(60,60,67,0.85)" }}
        >
          {used === 0 ? "Descubrir mi nombre" : `Probar otro (${remaining} ${remaining === 1 ? "intento" : "intentos"})`}
        </button>
      )}

      {list.length > 0 && (
        <div className="card mt-4 px-4 py-5 text-center">
          <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            {picked ? "Tu nombre anónimo sería" : "Elige uno de los que te salieron"}
          </div>
          <div className="heading mt-1 text-[28px] font-bold" style={{ color: RED }}>
            {picked ?? "—"}
          </div>
          {list.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {list.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPicked(n);
                    setConfirming(false);
                  }}
                  className="mf-tap min-h-[36px] rounded-full px-3.5 text-[13.5px] font-semibold"
                  style={{ background: picked === n ? RED : "rgba(60,60,67,0.08)", color: picked === n ? "#fff" : "#1C1C1E" }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {!confirming ? (
            <button type="button" disabled={busy || !picked} onClick={() => setConfirming(true)} className="mf-tap mt-4 min-h-[48px] w-full rounded-[14px] text-[15px] font-semibold text-white disabled:opacity-50" style={{ background: RED }}>
              Quedarme con este
            </button>
          ) : (
            <div className="mt-4 rounded-[14px] p-3.5 text-left" style={{ background: "rgba(242,68,68,0.08)" }}>
              <div className="text-[13.5px] font-semibold">¿Seguro que quieres a {picked}?</div>
              <p className="mt-1 text-[12.5px] leading-snug" style={{ color: MUTED }}>
                Después de esto ya no se puede cambiar.
              </p>
              <div className="mt-3 flex gap-2.5">
                <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="mf-tap min-h-[46px] flex-1 rounded-[12px] text-[14.5px] font-semibold" style={{ background: "rgba(60,60,67,0.08)" }}>
                  Volver
                </button>
                <button type="button" disabled={busy} onClick={keep} className="mf-tap min-h-[46px] flex-1 rounded-[12px] text-[14.5px] font-semibold text-white" style={{ background: RED }}>
                  Sí, es el mío
                </button>
              </div>
            </div>
          )}
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
