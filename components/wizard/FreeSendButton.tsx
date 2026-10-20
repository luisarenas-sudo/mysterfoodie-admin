"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Enviar GRATIS": manda el reporte como DEMO gratis (sin link de pago, con marca
 * de agua en el PDF). Para que no se mande por accidente, pide tres toques:
 *   1) rojo oscuro con texto gris claro  ->  se activa (rojo normal, gris oscuro)
 *   2) "Toca otra vez para confirmar"
 *   3) "Sí, enviar GRATIS" -> manda.
 * Si no se sigue tocando, vuelve al inicio a los 8 segundos.
 */
export default function FreeSendButton({
  onConfirm,
  disabled,
  variant = "mobile",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "mobile" | "desktop";
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (stage > 0) timer.current = setTimeout(() => setStage(0), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [stage]);

  function press() {
    if (disabled) return;
    if (stage < 2) {
      setStage((s) => (s + 1) as 1 | 2);
      return;
    }
    setStage(0);
    onConfirm();
  }

  const label = stage === 0 ? "Enviar GRATIS" : stage === 1 ? "Toca otra vez para confirmar" : "Sí, enviar GRATIS";
  const active = stage > 0;

  return (
    <div className={variant === "mobile" ? "text-center" : "max-w-xl"}>
      <button
        type="button"
        onClick={press}
        disabled={disabled}
        className={`w-full rounded-2xl py-3.5 text-center text-[15.5px] font-bold text-white transition-colors disabled:opacity-50 ${
          variant === "mobile" ? "mf-tap" : ""
        }`}
        style={{ background: active ? "#F24444" : "#7A1F1F" }}
      >
        {label}
      </button>
      <p
        className="mt-2 text-[11.5px] leading-snug transition-colors"
        style={{ color: active ? "rgba(60,60,67,0.9)" : "rgba(60,60,67,0.45)" }}
      >
        Este reporte será un DEMO GRATIS para el cliente
        <br />
        <span className="font-semibold">- SIN LINK DE PAGO -</span>
      </p>
    </div>
  );
}
