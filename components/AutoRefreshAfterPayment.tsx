"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Después de pagar, MercadoPago regresa a la persona al reporte antes de que
 * el aviso (webhook) desbloquee el detalle. Antes se le pedía "espera unos
 * segundos y recarga"; ahora la página se refresca sola cada pocos segundos
 * (hasta ~1 minuto) y el detalle completo aparece en cuanto el pago se confirma.
 */
export default function AutoRefreshAfterPayment({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 15) window.clearInterval(timer);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}
