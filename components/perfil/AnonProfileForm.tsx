"use client";

import { useEffect, useRef, useState } from "react";
import { CUISINES, DISHES, MIN_CUISINES, MIN_DISHES, type FoodOption } from "@/lib/foodCatalog";
import { FieldInput } from "@/components/persona/PersonaFields";
import { BLOCK_PIX, FIELD_UI, optionIcon } from "@/lib/personaUi";
import { PixelBadge } from "@/components/ui/PixelBadge";
import { isValidPostalCode } from "@/lib/zonas";
import {
  BLOCKS, BLOCKS_OF_TIER, BLOCK_BY_KEY, MAX_EARNINGS_PER_SALE, MIN_VISITS_PASSPORT, MYSTERFOODIE_SHARE_PCT, PLATFORM_FEE_PCT, TIER_INCREMENT,
  activeFields, earningsForBlocks, isBlockComplete, type BlockKey, type FieldDef, type Persona, type TierKey,
} from "@/lib/personaCatalog";

const RED = "#F24444";
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

const TIER_UI: Record<TierKey, { pix: string; tone: "red" | "purple"; title: string; desc: string; color: string }> = {
  id: { pix: "card-id", tone: "red", title: "Perfil ID", desc: "Tus gustos y palabras, cómo consumes y de qué zona eres.", color: RED },
  passport: { pix: "luggage", tone: "purple", title: "Perfil Passport", desc: "Tu buyer persona: demografía, estilo de vida, movilidad y viajes, y medios.", color: "#5856D6" },
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full px-3.5 py-2 text-[14px] font-semibold"
      style={on ? { background: RED, color: "#fff" } : { background: "#fff", color: "#1C1C1E", border: "1.5px solid rgba(60,60,67,0.14)" }}
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
      <path d="M5 8l5 5 5-5" fill="none" stroke="rgba(60,60,67,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Preguntas de un bloque Passport: una a la vez; lo contestado se resume y cada respuesta abre sus preguntas de seguimiento justo debajo. */
function BlockSteps({
  block, persona, onPick,
}: {
  block: BlockKey;
  persona: Persona;
  onPick: (block: BlockKey, field: FieldDef, option: string) => void;
}) {
  const fields = activeFields(block, persona);
  const answered = (f: FieldDef) => {
    const v = persona[block]?.[f.key];
    return f.kind === "one" ? typeof v === "string" : Array.isArray(v) && v.length > 0;
  };
  // undefined = la primera sin contestar; una clave = la que se está contestando o editando; null = ninguna.
  const [cur, setCur] = useState<string | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const firstOpen = fields.find((f) => !answered(f))?.key ?? null;
  const editing = cur === undefined ? firstOpen : cur;
  const done = fields.filter(answered).length;

  const pick = (f: FieldDef, o: string) => {
    if (timer.current) clearTimeout(timer.current);
    setCur(f.key); // se queda abierta mientras se ve la selección
    onPick(block, f, o);
    if (f.kind === "one") timer.current = setTimeout(() => setCur(undefined), 350);
  };

  return (
    <div>
      <div className="mb-1 inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "#F2F2F7" }}>
        {done}/{fields.length} contestadas
      </div>
      {fields.map((f) => {
        const followUp = Boolean(f.when);
        const wrap = followUp ? "ml-3 border-l-2 pl-3" : "";
        const wrapStyle = followUp ? { borderColor: "rgba(242,68,68,0.28)" } : undefined;
        if (f.key === editing) {
          const meta = FIELD_UI[`${block}.${f.key}`];
          const picked = asArr(persona[block]?.[f.key]);
          return (
            <div key={f.key} className={`mf-slide-in mt-3 ${wrap}`} style={wrapStyle}>
              <div className="mb-1 flex items-center gap-2 text-[14.5px] font-bold">
                <span aria-hidden="true">{meta?.emoji}</span>
                <span>{f.label}</span>
                {followUp && <span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: "#FFF0EE", color: RED }}>🎁 extra</span>}
              </div>
              {(meta?.hint || f.kind === "many") && <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>{meta?.hint ?? "Puedes elegir varias"}</div>}
              <FieldInput block={block} field={f} value={persona[block]?.[f.key]} onPick={(o) => pick(f, o)} />
              {f.kind === "many" && (
                <button
                  type="button"
                  disabled={picked.length === 0}
                  onClick={() => setCur(undefined)}
                  className="mt-1 w-full rounded-[14px] py-3 text-[15px] font-bold text-white disabled:opacity-40"
                  style={{ background: RED }}
                >
                  {picked.length === 0 ? "Elige al menos una" : `Listo (${picked.length})`}
                </button>
              )}
            </div>
          );
        }
        if (answered(f)) {
          const vals = asArr(persona[block]?.[f.key]);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => { if (timer.current) clearTimeout(timer.current); setCur(f.key); }}
              className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${wrap}`}
              style={{ background: "#F7F7FA", ...wrapStyle }}
            >
              <span className="min-w-0">
                <span className="block text-[11.5px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>{f.label}</span>
                <span className="block truncate text-[14px] font-bold">{vals.map((v) => `${optionIcon(block, f.key, v)} ${v}`).join(" · ")}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold" style={{ color: RED }}>Cambiar</span>
            </button>
          );
        }
        return null; // todavía no toca: aparece cuando se conteste la anterior
      })}
      {editing === null && fields.length > 0 && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "#1E8E4E" }}>✓ Sección lista</p>
      )}
    </div>
  );
}

/** Perfil anónimo: dos niveles (ID y Passport), cada uno con su interruptor; al encenderlo se abre y pide lo que falta, una cosa a la vez. */
export default function AnonProfileForm({
  initial,
  visits,
}: {
  initial: { postalCode: string; cuisines: string[]; dishes: string[]; persona: Persona; shared: BlockKey[] };
  visits: number;
}) {
  const [cp, setCp] = useState(initial.postalCode);
  const [cuisines, setCuisines] = useState(initial.cuisines);
  const [dishes, setDishes] = useState(initial.dishes);
  const [persona, setPersona] = useState<Persona>(initial.persona);
  const [want, setWant] = useState<Record<TierKey, boolean>>({
    id: BLOCKS_OF_TIER("id").some((b) => initial.shared.includes(b.key)),
    passport: BLOCKS_OF_TIER("passport").some((b) => initial.shared.includes(b.key)),
  });
  const [open, setOpen] = useState<Record<TierKey, boolean>>({ id: false, passport: false });
  const [section, setSection] = useState<Record<TierKey, BlockKey | null>>({ id: null, passport: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggleIn = (list: string[], set: (v: string[]) => void) => (key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const setField = (block: BlockKey, field: FieldDef, option: string) =>
    setPersona((p) => {
      const cur = { ...(p[block] ?? {}) };
      if (field.kind === "one") cur[field.key] = option;
      else {
        const arr = Array.isArray(cur[field.key]) ? (cur[field.key] as string[]) : [];
        cur[field.key] = arr.includes(option) ? arr.filter((x) => x !== option) : [...arr, option];
      }
      return { ...p, [block]: cur };
    });

  const ready = (k: BlockKey): boolean => {
    if (k === "gustos") return cuisines.length >= MIN_CUISINES && dishes.length >= MIN_DISHES;
    if (k === "sector") return isValidPostalCode(cp);
    return isBlockComplete(k, persona); // consumo no pide nada; los de Passport, todas sus preguntas
  };
  const effective = BLOCKS.filter((b) => want[b.tier] && ready(b.key)).map((b) => b.key);
  const estimate = earningsForBlocks(effective);

  function toggleTier(t: TierKey) {
    setMsg(null);
    const next = !want[t];
    setWant((w) => ({ ...w, [t]: next }));
    setOpen((o) => ({ ...o, [t]: next }));
    if (next) setSection((s) => ({ ...s, [t]: BLOCKS_OF_TIER(t).find((b) => !ready(b.key))?.key ?? null }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil/anonimo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: cp, cuisines, dishes, persona, shareBlocks: effective }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      const falta = BLOCKS.filter((b) => want[b.tier] && !ready(b.key)).map((b) => b.label);
      setMsg(
        falta.length
          ? { ok: true, text: `Guardado. Aún no se comparte: ${falta.join(", ")}. Termínalo para sumar a tus ganancias.` }
          : { ok: true, text: "Guardado." }
      );
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setBusy(false);
    }
  }

  const chipGroup = (title: string, hint: string, options: readonly FoodOption[], sel: string[], onToggle: (k: string) => void) => (
    <div className="mb-4">
      <div className="text-[13.5px] font-semibold">{title}</div>
      <div className="mb-2 text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>{hint}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.key} on={sel.includes(o.key)} onClick={() => onToggle(o.key)}>
            {o.emoji} {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );

  function sectionBody(k: BlockKey) {
    if (k === "gustos") {
      return (
        <div>
          {chipGroup("Tipos de cocina que te gustan", `Elige al menos ${MIN_CUISINES}.`, CUISINES, cuisines, toggleIn(cuisines, setCuisines))}
          {cuisines.length >= MIN_CUISINES ? (
            <div className="mf-slide-in">
              {chipGroup("Platillos que te gustan", `Elige al menos ${MIN_DISHES} (llevas ${dishes.length}).`, DISHES, dishes, toggleIn(dishes, setDishes))}
            </div>
          ) : null}
          <p className="text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>Las palabras que más usas en tus reseñas salen solas de tus visitas.</p>
        </div>
      );
    }
    if (k === "consumo") {
      return <p className="text-[13.5px]" style={{ color: "rgba(60,60,67,0.7)" }}>No tienes que contestar nada: sale de tus visitas (con cuántas personas sales, cuenta promedio, totales, dónde consumes y cuándo sueles salir).</p>;
    }
    if (k === "sector") {
      return (
        <label className="block">
          <span className="mb-1.5 block text-[13.5px] font-semibold">Código postal de tu casa</span>
          <input
            inputMode="numeric"
            maxLength={5}
            value={cp}
            onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="91900"
            className="w-full rounded-[12px] px-3.5 py-3 text-[16px] outline-none"
            style={{ border: "1.5px solid rgba(60,60,67,0.14)" }}
          />
          <span className="mt-1 block text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            Solo sirve para saber de qué zona eres. Los negocios ven la zona, nunca tu código postal.
          </span>
        </label>
      );
    }
    return <BlockSteps block={k} persona={persona} onPick={(b, f, o) => setField(b, f, o)} />;
  }

  function statusOf(k: BlockKey): { text: string; ok: boolean } {
    if (ready(k)) return { text: "✓ Lista", ok: true };
    if (BLOCK_BY_KEY[k].fields.length > 0) {
      const n = activeFields(k, persona).filter((f) => {
        const v = persona[k]?.[f.key];
        return f.kind === "one" ? typeof v === "string" : Array.isArray(v) && v.length > 0;
      }).length;
      return { text: n > 0 ? `${n}/${activeFields(k, persona).length}` : "Pendiente", ok: false };
    }
    return { text: "Pendiente", ok: false };
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl p-4" style={{ background: "#fff", border: "1.5px solid rgba(60,60,67,0.1)" }}>
        <div className="text-[13px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>Con lo que compartes hoy ganarías</div>
        <div key={estimate} className="mf-pop mt-0.5 text-[26px] font-extrabold" style={{ color: RED }}>{money(estimate)} <span className="text-[13px] font-semibold text-stone-500">por perfil vendido</span></div>
        <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          Con los dos niveles completos: hasta {money(MAX_EARNINGS_PER_SALE)} por perfil Passport. Te llevas el {MYSTERFOODIE_SHARE_PCT}% del precio que paga el negocio (${TIER_INCREMENT.id} el ID y ${TIER_INCREMENT.passport} el Passport). El cargo por uso de la plataforma ({PLATFORM_FEE_PCT}%) lo paga el negocio aparte y no se te descuenta. Lo ves todo, mes a mes, en Finanzas.
        </div>
      </div>

      {(["id", "passport"] as TierKey[]).map((t) => {
        const ui = TIER_UI[t];
        const blocks = BLOCKS_OF_TIER(t);
        const on = want[t];
        const isOpen = open[t];
        const listos = blocks.filter((b) => ready(b.key)).length;
        const locked = t === "passport" && visits < MIN_VISITS_PASSPORT;
        const tierMax = earningsForBlocks(blocks.map((b) => b.key));
        const status = !on
          ? "No lo compartes"
          : listos === blocks.length
            ? `Compartes las ${blocks.length} secciones`
            : `Compartes ${listos} de ${blocks.length} secciones · faltan ${blocks.length - listos}`;
        return (
          <div key={t} className="mb-3.5 rounded-2xl bg-white p-4" style={{ border: on ? `1.5px solid ${ui.color}` : "1.5px solid rgba(60,60,67,0.1)" }}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [t]: !o[t] }))} className="min-w-0 flex-1 text-left">
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ui.color }}>
                  Nivel {t === "passport" ? "Passport" : "ID"} · ganas hasta {money(tierMax)} {t === "passport" ? "más " : ""}por venta
                </div>
                <div className="heading flex items-center gap-2 text-[20px]"><PixelBadge name={ui.pix} size={30} tone={ui.tone} />{ui.title}</div>
                <div className="text-[13px] text-stone-500">{ui.desc}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: on ? (listos === blocks.length ? "#1E8E4E" : "#9A6A00") : "rgba(60,60,67,0.5)" }}>
                  {status}
                  <Chevron open={isOpen} />
                </div>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Compartir ${ui.title}`}
                onClick={() => toggleTier(t)}
                className="relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors"
                style={{ background: on ? "#34C759" : "rgba(120,120,128,0.32)" }}
              >
                <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
              </button>
            </div>

            {isOpen && (
              <div className="mf-slide-in mt-3">
                {locked && (
                  <p className="mb-2 text-[12px]" style={{ color: "#9A6A00" }}>
                    Passport se entrega a partir de {MIN_VISITS_PASSPORT} visitas (llevas {visits}); puedes dejar tus respuestas listas desde ahora.
                  </p>
                )}
                {!on && (
                  <p className="mb-2 text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>
                    Enciende el interruptor para compartir este nivel. Mientras tanto puedes ir contestando.
                  </p>
                )}
                {blocks.map((b) => {
                  const st = statusOf(b.key);
                  const isSec = section[t] === b.key;
                  return (
                    <div key={b.key} className="border-t first:border-t-0" style={{ borderColor: "rgba(60,60,67,0.1)" }}>
                      <button
                        type="button"
                        aria-expanded={isSec}
                        onClick={() => setSection((s) => ({ ...s, [t]: isSec ? null : b.key }))}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        <PixelBadge name={BLOCK_PIX[b.key]} size={34} tone={t === "passport" ? "purpleSoft" : "redSoft"} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold">{b.label}</span>
                          <span className="block text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>+{money((b.pct / 100) * TIER_INCREMENT[b.tier])} por venta</span>
                        </span>
                        <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={st.ok ? { background: "#E8F7EE", color: "#1E8E4E" } : { background: "#F2F2F7", color: "rgba(60,60,67,0.7)" }}>{st.text}</span>
                        <Chevron open={isSec} />
                      </button>
                      {isSec && <div className="mf-slide-in pb-4 pl-1">{sectionBody(b.key)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {msg && (
        <p className="mb-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-medium" style={msg.ok ? { background: "#E8F7EE", color: "#1E8E4E" } : { background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>
          {msg.text}
        </p>
      )}
      <button type="button" onClick={save} disabled={busy} className="w-full rounded-2xl py-4 text-[16px] font-bold text-white disabled:opacity-50" style={{ background: RED }}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
