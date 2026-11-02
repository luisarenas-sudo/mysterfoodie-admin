"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Jalar hacia abajo para actualizar (solo celular, solo cuando la pantalla está hasta arriba).
 * Se usa en el Inicio: al soltar pasado el umbral vuelve a pedir los datos del servidor (router.refresh) sin
 * recargar la página. No mueve el contenido (así no rompe elementos fijos): solo baja un indicador redondo.
 */
const THRESHOLD = 70; // px de jalón (ya con resistencia) para que cuente como "actualizar"
const MAX_PULL = 110;
const MIN_SPIN_MS = 700;

export default function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [holding, setHolding] = useState(false); // dedo puesto y jalando
  const [spinning, setSpinning] = useState(false);
  const [pending, startTransition] = useTransition();
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    // Evita que Chrome (Android) haga su propia recarga de página al jalar; la nuestra es más ligera.
    const prev = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "contain";

    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
          setHolding(false);
        }
        if (dy <= 0) startY.current = null;
        return;
      }
      if (e.cancelable) e.preventDefault(); // sin esto el navegador desplaza o rebota en vez de dejar jalar
      const eased = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = eased;
      setPull(eased);
      setHolding(true);
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setHolding(false);
      const reached = pullRef.current >= THRESHOLD;
      pullRef.current = 0;
      if (!reached || busy.current) {
        setPull(0);
        return;
      }
      busy.current = true;
      setSpinning(true);
      setPull(THRESHOLD * 0.8);
      const t0 = Date.now();
      startTransition(() => {
        router.refresh();
      });
      startedAt.current = t0; // el cierre lo decide el efecto de abajo cuando termina la transición
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.documentElement.style.overscrollBehaviorY = prev;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // Cuando el servidor ya respondió, se esconde el indicador (mostrándolo al menos MIN_SPIN_MS para que se note).
  useEffect(() => {
    if (!spinning || pending) return;
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt.current));
    const id = window.setTimeout(() => {
      setSpinning(false);
      setPull(0);
      busy.current = false;
    }, wait);
    return () => window.clearTimeout(id);
  }, [spinning, pending]);

  const progress = Math.min(1, pull / THRESHOLD);
  const visible = pull > 4 || spinning;
  return (
    <>
      <div
        aria-hidden={!visible}
        role="status"
        className="pointer-events-none fixed left-0 right-0 z-50 flex justify-center md:hidden"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 8px)",
          transform: `translateY(${Math.max(0, pull - 36)}px)`,
          opacity: visible ? 1 : 0,
          transition: holding ? "none" : "transform 0.25s ease, opacity 0.2s ease",
        }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className={spinning ? "animate-spin" : ""}
            style={spinning ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          >
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(60,60,67,0.12)" strokeWidth="2.6" />
            <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={progress >= 1 || spinning ? "#F24444" : "rgba(242,68,68,0.6)"} strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {spinning ? "Actualizando" : ""}
      </span>
      {children}
    </>
  );
}
