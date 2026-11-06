"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Enviar GRATIS": manda el reporte como DEMO gratis (sin link de pago, con marca de agua en el PDF).
 * Para que no se mande por accidente pide dos toques, sin escribir nada:
 *   1) rojo oscuro  ->  se arma (rojo normal): "Toca otra vez para guardar y enviar GRATIS"
 *   2) segundo toque -> guarda la visita y la manda gratis, en un solo paso.
 * Si no se vuelve a tocar, regresa al inicio a los 8 segundos.
 * El negocio recibe su reporte completo con el botón «Descarga GRATIS tu reporte aquí» (ver FreeReportDownload).
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
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (armed) timer.current = setTimeout(() => setArmed(false), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  function press() {
    if (disabled) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  }

  return (
    <div className={variant === "mobile" ? "text-center" : "max-w-xl"}>
      <button
        type="button"
        onClick={press}
        disabled={disabled}
        className={`w-full rounded-2xl py-3.5 text-center text-[15.5px] font-bold text-white transition-colors disabled:opacity-50 ${
          variant === "mobile" ? "mf-tap" : ""
        }`}
        style={{ background: armed ? "#F24444" : "#7A1F1F" }}
      >
        {armed ? "Toca otra vez para guardar y enviar GRATIS" : "Enviar GRATIS"}
      </button>
      <p
        className="mt-2 text-[11.5px] leading-snug transition-colors"
        style={{ color: armed ? "rgba(60,60,67,0.9)" : "rgba(60,60,67,0.45)" }}
      >
        Este reporte será un DEMO GRATIS para el cliente
        <br />
        <span className="font-semibold">- SIN LINK DE PAGO -</span>
      </p>
    </div>
  );
}
