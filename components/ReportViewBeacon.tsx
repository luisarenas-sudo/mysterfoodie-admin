"use client";

import { useEffect } from "react";

/**
 * Avisa a la app que alguien abrió el reporte público (una vez por pestaña y
 * reporte; no cuenta si ya está pagado ni cuando se regresa de Mercado Pago).
 * No usa cookies; si falla, no pasa nada.
 */
export default function ReportViewBeacon({ shortCode, skip = false }: { shortCode: string; skip?: boolean }) {
  useEffect(() => {
    if (skip) return;
    const key = `mf-visto-${shortCode}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sin almacenamiento: se cuenta igual
    }
    fetch("/api/reportes/visto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortCode }),
      keepalive: true,
    }).catch(() => {});
  }, [shortCode, skip]);
  return null;
}
