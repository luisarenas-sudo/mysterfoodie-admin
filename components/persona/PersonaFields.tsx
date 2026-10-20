"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BLOCK_BY_KEY, activeFields, type BlockKey, type FieldDef, type Persona } from "@/lib/personaCatalog";
import { FIELD_UI, optionIcon, type FieldUi } from "@/lib/personaUi";

const RED = "#F24444";
const INK = "#1C1C1E";
const LINE = "rgba(60,60,67,0.14)";
const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Selector de una pregunta del perfil, con la forma que le toca (burbujas, tarjetas, escala, sí/no o cuadrícula). */
export function FieldInput({ block, field, value, onPick }: { block: BlockKey; field: FieldDef; value: string | string[] | undefined; onPick: (option: string) => void }) {
  const meta = FIELD_UI[`${block}.${field.key}`];
  const ui: FieldUi = meta?.ui ?? (field.kind === "many" ? "bubbles" : "cards");
  const picked = asArr(value);
  const isOn = (o: string) => picked.includes(o);
  const emoji = (o: string) => optionIcon(block, field.key, o);

  if (ui === "circles") {
    // Burbujas que crecen: de la más chica a la más grande.
    const n = field.options.length;
    return (
      <div className="flex flex-wrap items-end justify-center gap-3 py-2">
        {field.options.map((o, i) => {
          const size = 84 + i * 12;
          const on = isOn(o);
          return (
            <button
              key={`${o}-${on}`}
              type="button"
              onClick={() => onPick(o)}
              aria-pressed={on}
              className={`mf-tap flex items-center justify-center rounded-full text-center font-bold leading-tight ${on ? "mf-pop" : "mf-float"}`}
              style={{
                width: size, height: size, fontSize: 13 + Math.round((i / Math.max(1, n - 1)) * 3), animationDelay: on ? "0s" : `${i * 0.25}s`,
                background: on ? `linear-gradient(135deg, ${RED}, #ff7a6b)` : "#fff", color: on ? "#fff" : INK,
                border: `2px solid ${on ? RED : LINE}`, boxShadow: on ? "0 6px 16px rgba(242,68,68,0.35)" : "none",
              }}
            >
              <span className="flex flex-col items-center gap-0.5"><span className="text-[22px] leading-none" aria-hidden="true">{emoji(o)}</span>{o}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (ui === "steps") {
    // Escala: se llena una barra con puntos; el elegido crece.
    const n = field.options.length;
    const idx = field.options.findIndex(isOn);
    const pct = idx < 0 ? 0 : n === 1 ? 100 : (idx / (n - 1)) * 100;
    return (
      <div className="px-1 py-3">
        <div className="relative mx-4 h-9">
          <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ background: "rgba(60,60,67,0.12)" }} />
          <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #ffb199, ${RED})`, transition: "width .35s cubic-bezier(.3,1.4,.5,1)" }} />
          {field.options.map((o, i) => {
            const on = idx === i;
            const passed = idx >= i;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onPick(o)}
                aria-label={o}
                aria-pressed={on}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${n === 1 ? 0 : (i / (n - 1)) * 100}%`, width: on ? 34 : 24, height: on ? 34 : 24, background: passed ? RED : "#fff", border: `3px solid ${passed ? RED : "rgba(60,60,67,0.25)"}`, boxShadow: on ? "0 4px 12px rgba(242,68,68,0.45)" : "none", transition: "all .25s" }}
              >
                {on && <span className="mf-pop absolute inset-0 flex items-center justify-center text-[15px]">{emoji(o) || "✓"}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between gap-1">
          {field.options.map((o) => (
            <button key={o} type="button" onClick={() => onPick(o)} className="flex-1 text-center text-[12px] font-semibold leading-tight" style={{ color: isOn(o) ? RED : "rgba(60,60,67,0.6)" }}>
              <span className="block text-[18px] leading-none" aria-hidden="true">{emoji(o)}</span>
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (ui === "yesno") {
    return (
      <div className="grid grid-cols-2 gap-3 py-1">
        {field.options.map((o) => {
          const on = isOn(o);
          return (
            <button
              key={`${o}-${on}`}
              type="button"
              onClick={() => onPick(o)}
              aria-pressed={on}
              className={`mf-tap flex flex-col items-center justify-center gap-1 rounded-3xl py-7 text-[17px] font-extrabold ${on ? "mf-pop" : ""}`}
              style={{ background: on ? (o === "No" || o === "Flexible" ? "#EEF0F4" : "#E8F7EE") : "#fff", color: INK, border: `2.5px solid ${on ? RED : LINE}` }}
            >
              <span className="text-[34px]" aria-hidden="true">{emoji(o)}</span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  if (ui === "grid") {
    return (
      <div className="grid grid-cols-3 gap-2.5 py-1">
        {field.options.map((o, i) => {
          const on = isOn(o);
          return (
            <button
              key={`${o}-${on}`}
              type="button"
              onClick={() => onPick(o)}
              aria-pressed={on}
              className={`mf-tap mf-rise flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3.5 text-center text-[12px] font-bold leading-tight ${on ? "mf-pop" : ""}`}
              style={{ animationDelay: `${i * 0.03}s`, background: on ? "#FFF0EE" : "#fff", border: `2px solid ${on ? RED : LINE}`, color: INK }}
            >
              <span className="text-[28px]" aria-hidden="true">{emoji(o)}</span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  if (ui === "bubbles") {
    return (
      <div className="flex flex-wrap justify-center gap-2.5 py-2">
        {field.options.map((o, i) => {
          const on = isOn(o);
          return (
            <button
              key={`${o}-${on}`}
              type="button"
              onClick={() => onPick(o)}
              aria-pressed={on}
              className={`mf-tap inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14.5px] font-bold ${on ? "mf-pop" : "mf-float"}`}
              style={{ animationDelay: on ? "0s" : `${(i % 6) * 0.3}s`, background: on ? `linear-gradient(135deg, ${RED}, #ff7a6b)` : "#fff", color: on ? "#fff" : INK, border: `2px solid ${on ? RED : LINE}`, boxShadow: on ? "0 5px 14px rgba(242,68,68,0.32)" : "none" }}
            >
              <span aria-hidden="true">{emoji(o)}</span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  // cards (por defecto para una sola opción): tarjetas con emoji grande
  return (
    <div className="grid grid-cols-2 gap-2.5 py-1">
      {field.options.map((o, i) => {
        const on = isOn(o);
        return (
          <button
            key={`${o}-${on}`}
            type="button"
            onClick={() => onPick(o)}
            aria-pressed={on}
            className={`mf-tap mf-rise flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-4 text-center text-[13.5px] font-bold leading-tight ${on ? "mf-pop" : ""}`}
            style={{ animationDelay: `${i * 0.04}s`, background: on ? "#FFF0EE" : "#fff", border: `2px solid ${on ? RED : LINE}`, color: INK }}
          >
            <span className="text-[26px]" aria-hidden="true">{emoji(o)}</span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Lluvia de emojis al terminar. */
export function Celebration() {
  const bits = useMemo(
    () => ["🎉", "✨", "🌮", "🍕", "🛂", "🧳", "⭐", "🍹", "🎊", "🍜"].map((e, i) => ({ e, dx: `${(i - 4.5) * 34}px`, dy: `${-60 - ((i * 37) % 70)}px`, rot: `${(i % 2 ? 1 : -1) * (40 + i * 18)}deg`, d: `${(i % 4) * 0.06}s` })),
    []
  );
  return (
    <div className="relative mx-auto h-0 w-0" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} className="mf-confetti text-[22px]" style={{ ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--rot" as string]: b.rot, animationDelay: b.d }}>
          {b.e}
        </span>
      ))}
    </div>
  );
}

type Q = { block: BlockKey; field: FieldDef };

/**
 * Una pregunta a la vez, con barra de avance, animación al cambiar y avance automático al elegir (una sola opción).
 * Las respuestas abren preguntas de seguimiento ("pregunta extra") que se intercalan solas.
 */
export function PersonaDeck({
  blocks,
  persona,
  onPick,
  onDone,
  onExit,
}: {
  blocks: BlockKey[];
  persona: Persona;
  onPick: (block: BlockKey, field: FieldDef, option: string) => void;
  onDone: () => void;
  onExit: () => void;
}) {
  const questions: Q[] = blocks.flatMap((b) => activeFields(b, persona).map((field) => ({ block: b, field })));
  const answered = (q: Q) => {
    const v = persona[q.block]?.[q.field.key];
    return q.field.kind === "one" ? typeof v === "string" : Array.isArray(v) && v.length > 0;
  };
  const firstOpen = questions.findIndex((q) => !answered(q));
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const safeIdx = Math.min(idx, Math.max(0, questions.length - 1));
  const q = questions[safeIdx];
  if (!q) return null;
  const meta = FIELD_UI[`${q.block}.${q.field.key}`];
  const isFollowUp = Boolean(q.field.when);
  const total = questions.length;

  const advance = (from: number) => {
    // Recalcula con lo respondido: una respuesta puede haber abierto preguntas nuevas.
    if (from >= questions.length - 1 && questions.every(answered)) return onDone();
    setIdx(from + 1);
  };

  const pick = (option: string) => {
    onPick(q.block, q.field, option);
    if (q.field.kind === "one") {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdx((i) => i + 1), 380);
    }
  };

  // Tras elegir una opción única, "idx + 1" puede apuntar al final: si todo está respondido, se termina.
  useEffect(() => {
    if (idx >= questions.length && questions.length > 0) {
      if (questions.every(answered)) onDone();
      else setIdx(Math.max(0, questions.findIndex((x) => !answered(x))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, questions.length]);

  const canNext = answered(q);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(60,60,67,0.12)" }}>
          <div className="h-full rounded-full" style={{ width: `${((safeIdx + (canNext ? 1 : 0)) / total) * 100}%`, background: `linear-gradient(90deg, #ffb199, ${RED})`, transition: "width .4s cubic-bezier(.3,1.3,.5,1)" }} />
        </div>
        <span className="text-[12px] font-bold" style={{ color: "rgba(60,60,67,0.6)" }}>{safeIdx + 1}/{total}</span>
      </div>

      <div key={`${q.block}.${q.field.key}`} className="mf-slide-in rounded-3xl bg-white p-4" style={{ border: `1.5px solid rgba(60,60,67,0.1)` }}>
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: RED }}>
          <span>{BLOCK_BY_KEY[q.block].label}</span>
          {isFollowUp && <span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: "#FFF0EE" }}>🎁 Pregunta extra</span>}
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-[30px] leading-none" aria-hidden="true">{meta?.emoji ?? "💬"}</span>
          <h3 className="heading text-[20px] leading-snug">{q.field.label}</h3>
        </div>
        {(meta?.hint || q.field.kind === "many") && (
          <p className="mt-1 text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            {meta?.hint ?? "Puedes elegir varias"}
          </p>
        )}
        <div className="mt-2">
          <FieldInput block={q.block} field={q.field} value={persona[q.block]?.[q.field.key]} onPick={pick} />
        </div>
        {q.field.kind === "many" && (
          <p className="mt-1 text-center text-[12.5px] font-semibold" style={{ color: RED }}>
            {asArr(persona[q.block]?.[q.field.key]).length > 0 ? `${asArr(persona[q.block]?.[q.field.key]).length} elegidas` : "Elige al menos una"}
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={() => (safeIdx === 0 ? onExit() : setIdx(safeIdx - 1))}
          className="mf-tap min-h-[52px] rounded-[14px] px-5 text-[15px] font-semibold"
          style={{ background: "rgba(60,60,67,0.08)" }}
        >
          Atrás
        </button>
        {q.field.kind === "many" || canNext ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => advance(safeIdx)}
            className="mf-tap min-h-[52px] flex-1 rounded-[14px] text-[16px] font-bold text-white disabled:opacity-40"
            style={{ background: RED }}
          >
            {safeIdx >= total - 1 && questions.every(answered) ? "¡Listo! 🎉" : "Siguiente"}
          </button>
        ) : (
          <div className="flex min-h-[52px] flex-1 items-center justify-center text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            Toca una opción para continuar
          </div>
        )}
      </div>
    </div>
  );
}
