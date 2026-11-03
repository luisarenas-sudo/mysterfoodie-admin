"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Enviar GRATIS": el reporte sale como DEMO gratis, pero el proceso se finge como
 * si el negocio fuera a pagar:
 *   1) "Enviar GRATIS" abre un mini checkout de mentiras (concepto, valor, total GRATIS).
 *   2) En vez de pagar, se escribe la palabra GRATIS (mayúsculas o minúsculas, da igual).
 *   3) PAGAR -> palomita verde que aparece y desaparece 2 veces y se queda fija.
 *   4) Entonces se manda, y el servidor sigue el mismo camino que un pago real
 *      (reporte desbloqueado, correo con PDF, comprobante tipo ticket), todo marcado GRATIS.
 */
export const FREE_CODE = "GRATIS";

/** Cada vuelta de la palomita dura esto (ms); aparece y desaparece 2 veces. */
const CHECK_CYCLE_MS = 850;
const CHECK_CYCLES = 2;

function mxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isFreeCode(v: string): boolean {
  return v.trim().toUpperCase() === FREE_CODE;
}

export default function FreeSendButton({
  onConfirm,
  disabled,
  variant = "mobile",
  price = 850,
  businessName,
}: {
  onConfirm: (code: string) => void;
  disabled?: boolean;
  variant?: "mobile" | "desktop";
  /** Valor del reporte completo (sin IVA). */
  price?: number;
  businessName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  // idle: escribiendo · anim: palomita parpadeando · done: palomita fija (ya se está enviando)
  const [phase, setPhase] = useState<"idle" | "anim" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // Si el envío falla (disabled vuelve a false) la palomita queda fija pero se puede reintentar.
  const ready = isFreeCode(code);
  const busy = phase !== "idle";

  function pay() {
    if (!ready || disabled || busy) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase("anim");
    timer.current = setTimeout(
      () => {
        setPhase("done");
        onConfirm(code.trim().toUpperCase());
      },
      reduce ? 400 : CHECK_CYCLE_MS * CHECK_CYCLES + 150
    );
  }

  function close() {
    if (busy && disabled) return;
    if (timer.current) clearTimeout(timer.current);
    setPhase("idle");
    setCode("");
    setOpen(false);
  }

  // Reintento tras un error del servidor: la palomita fija se vuelve a poder usar.
  useEffect(() => {
    if (phase === "done" && !disabled) {
      const t = setTimeout(() => setPhase("idle"), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, disabled]);

  const wrap = variant === "mobile" ? "text-center" : "max-w-xl";

  if (!open) {
    return (
      <div className={wrap}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={`w-full rounded-2xl py-3.5 text-center text-[15.5px] font-bold text-white transition-colors disabled:opacity-50 ${
            variant === "mobile" ? "mf-tap" : ""
          }`}
          style={{ background: "#7A1F1F" }}
        >
          Enviar GRATIS
        </button>
        <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "rgba(60,60,67,0.45)" }}>
          Este reporte será un DEMO GRATIS para el cliente
          <br />
          <span className="font-semibold">- SIN LINK DE PAGO -</span>
        </p>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div
        className="overflow-hidden rounded-2xl text-left"
        style={{ background: "#fff", border: "1px solid rgba(60,60,67,0.18)", boxShadow: "0 6px 22px rgba(0,0,0,0.08)" }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "#F6F6F8", borderBottom: "1px solid rgba(60,60,67,0.12)" }}>
          <span className="text-[13px] font-bold tracking-wide" style={{ color: "#111827" }}>
            PAGO DEL REPORTE
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "#FCE8E8", color: "#7A1F1F" }}>
            DEMO
          </span>
        </div>

        <div className="space-y-2 px-4 py-3.5 text-[13.5px]" style={{ color: "#374151" }}>
          <div className="flex justify-between gap-3">
            <span>
              Reporte completo
              {businessName ? <span className="block text-[12px]" style={{ color: "#6b7280" }}>{businessName}</span> : null}
            </span>
            <span className="whitespace-nowrap">{mxn(price)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Cortesía MysterFoodie</span>
            <span className="whitespace-nowrap" style={{ color: "#16a34a" }}>
              −{mxn(price)}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t pt-2 text-[15px] font-bold" style={{ borderColor: "rgba(60,60,67,0.15)", color: "#111827" }}>
            <span>Total a pagar</span>
            <span>GRATIS</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <label className="block text-[12.5px] font-semibold" style={{ color: "#374151" }} htmlFor="free-code">
            Para “pagar”, escribe la palabra GRATIS
          </label>
          <input
            id="free-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pay();
              }
            }}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="GRATIS"
            className="mt-1.5 w-full rounded-xl px-3 py-3 text-[16px] font-semibold tracking-wider outline-none"
            style={{
              border: `1.5px solid ${ready ? "#16a34a" : "rgba(60,60,67,0.25)"}`,
              background: "#fff",
              color: "#111827",
            }}
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={pay}
              disabled={!ready || busy || disabled}
              className={`flex-1 rounded-xl py-3.5 text-[15.5px] font-bold text-white transition-colors disabled:opacity-40 ${variant === "mobile" ? "mf-tap" : ""}`}
              style={{ background: "#16a34a" }}
            >
              {phase === "idle" ? "PAGAR" : "Procesando…"}
            </button>
            <span className="pay-check-slot" aria-hidden={phase === "idle"}>
              {phase !== "idle" && (
                <svg
                  viewBox="0 0 48 48"
                  width="44"
                  height="44"
                  className={phase === "anim" ? "pay-check-blink" : "pay-check-still"}
                  style={{ ["--pay-cycle" as string]: `${CHECK_CYCLE_MS}ms`, ["--pay-cycles" as string]: CHECK_CYCLES }}
                >
                  <circle cx="24" cy="24" r="22" fill="#16a34a" />
                  <path d="M14 25.5l7 7L34.5 17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </div>

          {!busy && (
            <button type="button" onClick={close} className="mt-3 w-full text-center text-[12.5px] underline" style={{ color: "rgba(60,60,67,0.6)" }}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
        Pago simulado: no se cobra nada y no se manda link de pago.
        <br />
        <span className="font-semibold">El negocio recibe su reporte y su comprobante marcados GRATIS.</span>
      </p>
    </div>
  );
}
