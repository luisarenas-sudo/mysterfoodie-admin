"use client";

import { useState } from "react";

/**
 * Botón "Copiar" para las tarjetas de "Oportunidades detectadas": copia
 * al portapapeles un mensaje de contacto sugerido (texto fijo, nunca
 * generado por IA) para que el agente lo use al platicar con el negocio.
 */
export default function OpportunityCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard no disponible; no bloquea la UI
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mf-tap -my-2 flex-shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
      style={{
        background: copied ? "rgba(52,199,89,0.14)" : "rgba(242,68,68,0.1)",
        color: copied ? "#248A3D" : "#F24444",
      }}
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
