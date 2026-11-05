"use client";

import SelectChips from "@/components/SelectChips";
import { CONTEXT_SELECT_ITEMS, SERVICE_STAMPS, type ServiceStampKey } from "@/lib/categories";

/** Sellos de hora de los hitos del servicio: clave -> fecha ISO. */
export type Stamps = Partial<Record<ServiceStampKey, string>>;

const TZ_OPTS: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

/** "20:41" en la hora del teléfono de quien hace la visita. */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", TZ_OPTS);
}

/** "miércoles 5 de noviembre de 2026". */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combina la fecha del inicio de la visita con una hora "HH:MM" escrita a mano. */
function fromTimeInput(hhmm: string, baseIso: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(baseIso);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toISOString();
}

/**
 * Fila fija (debajo del avance) para sellar la hora de cada hito con un toque,
 * mientras se avanza por la visita: me atendieron, llegó la bebida, el platillo y la cuenta.
 * Un sello ya puesto se corrige en el primer paso («Tu visita»).
 */
export function StampsBar({ stamps, onStamp }: { stamps: Stamps; onStamp: (key: ServiceStampKey) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Marcar la hora del servicio">
      {SERVICE_STAMPS.map((s) => {
        const at = stamps[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => (at ? undefined : onStamp(s.key))}
            aria-label={at ? `${s.label}: ${fmtTime(at)}` : `Marcar: ${s.label}`}
            className="mf-tap flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 py-1.5 leading-tight"
            style={{
              background: at ? "rgba(52,199,89,0.14)" : "rgba(60,60,67,0.07)",
              color: at ? "#248A3D" : "rgba(60,60,67,0.75)",
              cursor: at ? "default" : "pointer",
            }}
          >
            <span className="text-[15px]" aria-hidden>
              {s.emoji}
            </span>
            <span className="truncate text-[10.5px] font-semibold">{at ? fmtTime(at) : s.short}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Primer paso de la visita: fecha y hora (se sellan solas), qué tan lleno estaba el lugar
 * y los sellos de hora del servicio (se pueden corregir o borrar aquí).
 */
export function ContextStep({
  startedAt,
  setStartedAt,
  stamps,
  setStamps,
  selects,
  setSelects,
}: {
  startedAt: string | null;
  setStartedAt: (iso: string) => void;
  stamps: Stamps;
  setStamps: (next: Stamps) => void;
  selects: Record<string, string>;
  setSelects: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const occupancy = CONTEXT_SELECT_ITEMS[0];
  const base = startedAt ?? new Date().toISOString();

  function setStamp(key: ServiceStampKey, iso: string | null) {
    const next = { ...stamps };
    if (iso) next[key] = iso;
    else delete next[key];
    setStamps(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="heading text-[22px] font-bold">Tu visita</div>
        <p className="mt-0.5 text-[13.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          La fecha y la hora se marcan solas. Sirven para entender las calificaciones: no es lo mismo un martes vacío que un sábado lleno.
        </p>
      </div>

      <div className="card px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14.5px]">Fecha</span>
          <span className="text-[14px] font-semibold first-letter:uppercase">{fmtDate(base)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(60,60,67,0.08)", paddingTop: 12 }}>
          <label htmlFor="visit-arrival" className="text-[14.5px]">
            Hora de llegada
          </label>
          <input
            id="visit-arrival"
            type="time"
            value={toTimeInput(base)}
            onChange={(e) => {
              const iso = fromTimeInput(e.target.value, base);
              if (iso) setStartedAt(iso);
            }}
            className="rounded-lg px-2.5 py-1.5 text-[15px] font-semibold"
            style={{ background: "rgba(60,60,67,0.07)" }}
          />
        </div>
      </div>

      <div className="card px-4 py-3.5">
        <div className="text-[14.5px] leading-tight">{occupancy.label}</div>
        <div className="mt-2.5">
          <SelectChips
            options={occupancy.options ?? []}
            value={selects[occupancy.key]}
            onChange={(v) => setSelects((prev) => ({ ...prev, [occupancy.key]: v }))}
          />
        </div>
      </div>

      <div>
        <div className="px-0.5 pb-1.5 text-[12.5px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.55)" }}>
          Sellos de hora del servicio (opcional)
        </div>
        <div className="card px-4 py-1">
          {SERVICE_STAMPS.map((s, i) => {
            const at = stamps[s.key];
            return (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 py-2.5"
                style={i < SERVICE_STAMPS.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
              >
                <span className="text-[14.5px]">
                  <span aria-hidden>{s.emoji} </span>
                  {s.label}
                </span>
                {at ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={toTimeInput(at)}
                      onChange={(e) => {
                        const iso = fromTimeInput(e.target.value, base);
                        if (iso) setStamp(s.key, iso);
                      }}
                      aria-label={`Hora: ${s.label}`}
                      className="rounded-lg px-2 py-1 text-[14px] font-semibold"
                      style={{ background: "rgba(52,199,89,0.14)", color: "#248A3D" }}
                    />
                    <button
                      type="button"
                      onClick={() => setStamp(s.key, null)}
                      aria-label={`Quitar el sello: ${s.label}`}
                      className="mf-tap rounded-full px-2 py-1 text-[13px]"
                      style={{ color: "rgba(60,60,67,0.5)" }}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStamp(s.key, new Date().toISOString())}
                    className="mf-tap rounded-full px-3 py-1.5 text-[13px] font-semibold"
                    style={{ background: "rgba(60,60,67,0.08)" }}
                  >
                    Marcar ahora
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Mientras avanzas por la visita verás estos cuatro botones arriba: toca cada uno en el momento en que pase.
        </p>
      </div>
    </div>
  );
}

/** «¿Volverías?» de 1 a 10, de un toque: cada número mide ~56 px de ancho en el celular. */
export function WouldReturnScale({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <div>
      <div className="text-[14.5px] font-semibold leading-tight">¿Volverías a este negocio?</div>
      <p className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
        Del 1 (jamás) al 10 (sin duda). Es lo primero que quiere saber el dueño.
      </p>
      <div className="mt-2.5 grid grid-cols-5 gap-2" role="radiogroup" aria-label="¿Volverías? del 1 al 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = value === n;
          const tone = n <= 4 ? "#F24444" : n <= 7 ? "#FF9500" : "#34C759";
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : n)}
              className="mf-tap rounded-xl py-3 text-center text-[17px] font-bold"
              style={{
                background: on ? tone : "#fff",
                color: on ? "#fff" : "rgba(60,60,67,0.8)",
                boxShadow: on ? "none" : "inset 0 0 0 1px rgba(60,60,67,0.15)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
