"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

const TAPS_NEEDED = 3;
/** Tiempo máximo entre toques para que cuenten como una serie. */
const TAP_WINDOW_MS = 1500;

function formatDate(iso: string): string {
  // Se arma con el día/mes/año del texto para no depender de zonas horarias.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Bee() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
      {/* alas */}
      <ellipse cx="22" cy="14" rx="7" ry="10" transform="rotate(-18 22 14)" fill="#DCEBFF" stroke="#8FB4E8" strokeWidth="1.4" />
      <ellipse cx="31" cy="15" rx="6" ry="9" transform="rotate(14 31 15)" fill="#EAF3FF" stroke="#8FB4E8" strokeWidth="1.4" />
      {/* antenas */}
      <path d="M12 20c-2-3-3-5-3-7M16 18c-1-3-1-5 0-7" stroke="#1C1C1E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* cuerpo */}
      <defs>
        <clipPath id="mf-bee-body">
          <ellipse cx="27" cy="29" rx="15" ry="11" />
        </clipPath>
      </defs>
      <ellipse cx="27" cy="29" rx="15" ry="11" fill="#FFC93C" />
      <g clipPath="url(#mf-bee-body)">
        <path d="M24 17c2.6 6 2.6 16.6 0 24" stroke="#1C1C1E" strokeWidth="3.4" fill="none" />
        <path d="M32.5 17c2.4 5.8 2.4 15.6 0 24" stroke="#1C1C1E" strokeWidth="3.4" fill="none" />
      </g>
      <ellipse cx="27" cy="29" rx="15" ry="11" fill="none" stroke="#1C1C1E" strokeWidth="2" />
      {/* cabeza / ojo / aguijón */}
      <circle cx="13" cy="28" r="5.2" fill="#FFC93C" stroke="#1C1C1E" strokeWidth="2" />
      <circle cx="11.6" cy="27" r="1.3" fill="#1C1C1E" />
      <path d="M42 29.5l4 1.2-4 1.4z" fill="#1C1C1E" />
    </svg>
  );
}

/**
 * Easter egg al final de Perfil: una abejita que, al tocarla 3 veces seguidas,
 * abre la bitácora de versiones de la app (lib/changelog.ts). Los dos primeros
 * toques solo la hacen zumbar, para que el secreto siga siendo secreto.
 */
export default function EasterEggBee() {
  const [open, setOpen] = useState(false);
  const [buzz, setBuzz] = useState(0);
  const taps = useRef({ count: 0, last: 0 });
  const beeButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last > TAP_WINDOW_MS ? 1 : t.count + 1;
    t.last = now;
    setBuzz((n) => n + 1);
    if (t.count >= TAPS_NEEDED) {
      t.count = 0;
      setOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    beeButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <div className="flex justify-center pb-6 pt-2">
        <button
          ref={beeButtonRef}
          type="button"
          onClick={handleTap}
          aria-label="Abejita"
          className="mf-tap flex h-11 w-11 items-center justify-center rounded-full"
          style={{ opacity: 0.6 }}
        >
          <span key={buzz} className={buzz === 0 ? "mf-bee-idle" : "mf-bee-buzz"}>
            <Bee />
          </span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center md:items-center"
          style={{ background: "rgba(0,0,0,0.42)" }}
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mf-changelog-title"
            onClick={(e) => e.stopPropagation()}
            className="mf-sheet-up flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[24px] md:max-w-lg md:rounded-[24px]"
            style={{ background: "#F2F2F7" }}
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <div className="text-[11px] font-bold tracking-[1.1px]" style={{ color: "#F24444" }}>
                  BITÁCORA DE LA COLMENA
                </div>
                <h2 id="mf-changelog-title" className="heading mt-0.5 text-[22px] font-bold">
                  MysterFoodie v{APP_VERSION}
                </h2>
                <div className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
                  Así se fue construyendo la app, hito por hito.
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="mf-tap -mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(118,118,128,0.14)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" stroke="rgba(60,60,67,0.7)" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mf-scroll flex-1 overflow-y-auto px-5 pb-8" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))" }}>
              <ol className="space-y-3">
                {CHANGELOG.map((entry, idx) => (
                  <li key={entry.version} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px]" aria-hidden="true">
                          {entry.emoji}
                        </span>
                        <span
                          className="rounded-lg px-2 py-[3px] text-[12px] font-bold"
                          style={{ background: "rgba(242,68,68,0.1)", color: "#F24444" }}
                        >
                          v{entry.version}
                        </span>
                        {idx === 0 && (
                          <span
                            className="rounded-lg px-2 py-[3px] text-[11px] font-bold"
                            style={{ background: "rgba(52,199,89,0.14)", color: "#248A3D" }}
                          >
                            Actual
                          </span>
                        )}
                      </div>
                      <span className="text-[12px]" style={{ color: "rgba(60,60,67,0.5)" }}>
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    <div className="mt-2 text-[15.5px] font-bold">{entry.title}</div>
                    <ul className="mt-1.5 space-y-1.5">
                      {entry.highlights.map((h) => (
                        <li key={h} className="flex gap-2 text-[13.5px] leading-snug" style={{ color: "rgba(60,60,67,0.8)" }}>
                          <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full" style={{ background: "#F24444" }} />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-center text-[12px]" style={{ color: "rgba(60,60,67,0.45)" }}>
                Flanco Izquierdo® · 2026
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
