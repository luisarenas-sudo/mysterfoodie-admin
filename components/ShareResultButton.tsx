"use client";

import { useState } from "react";

/**
 * «Compartir mi resultado» (solo con calificación Bueno o Excelente): abre el menú de compartir del celular con el enlace
 * del reporte (la vista previa muestra el nombre y la calificación) y, si el navegador no lo tiene, copia el enlace.
 */
export default function ShareResultButton({ shortCode, clientName, score, className = "", style }: { shortCode: string; clientName: string; score: number; className?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/r/${shortCode}`;
    const text = `Así nos calificó un MysterFoodie en ${clientName}: ${score} de 5 ⭐`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Resultado MysterFoodie", text, url });
        return;
      }
    } catch {
      return; // la persona cerró el menú de compartir
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia este enlace:", url);
    }
  }

  return (
    <button type="button" onClick={share} className={className} style={style}>
      {copied ? "Enlace copiado ✅" : "📣 Compartir mi resultado"}
    </button>
  );
}
