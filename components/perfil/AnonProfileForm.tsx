"use client";

import { useState } from "react";
import { CUISINES, DISHES, MIN_CUISINES, MIN_DISHES, type FoodOption } from "@/lib/foodCatalog";
import { FieldInput } from "@/components/persona/PersonaFields";
import { BLOCK_EMOJI } from "@/lib/personaUi";
import { BLOCKS, MAX_EARNINGS_PER_SALE, MYSTERFOODIE_SHARE_PCT, PLATFORM_FEE_PCT, activeFields, MIN_VISITS_PASSPORT, TIER_INCREMENT, earningsForBlocks, isBlockComplete, type BlockDef, type BlockKey, type Persona } from "@/lib/personaCatalog";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-2 text-[14px] font-semibold"
      style={on ? { background: "#F24444", color: "#fff" } : { background: "#fff", color: "#1C1C1E", border: "1.5px solid rgba(60,60,67,0.14)" }}
    >
      {children}
    </button>
  );
}

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

/** Código postal, gustos, preguntas del buyer persona y qué bloques comparte (cada uno paga un % por venta). */
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
  const [shared, setShared] = useState<BlockKey[]>(initial.shared);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggleIn = (list: string[], set: (v: string[]) => void) => (key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const setField = (block: BlockKey, field: string, kind: "one" | "many", value: string) =>
    setPersona((p) => {
      const cur = { ...(p[block] ?? {}) };
      if (kind === "one") cur[field] = value;
      else {
        const arr = Array.isArray(cur[field]) ? (cur[field] as string[]) : [];
        cur[field] = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      }
      return { ...p, [block]: cur };
    });

  const answeredCount = (k: BlockKey) =>
    activeFields(k, persona).filter((f) => {
      const v = persona[k]?.[f.key];
      return f.kind === "one" ? typeof v === "string" : Array.isArray(v) && v.length > 0;
    }).length;
  const effective = shared.filter((k) => isBlockComplete(k, persona));
  const estimate = earningsForBlocks(effective);

  function toggleShare(def: BlockDef) {
    setMsg(null);
    if (shared.includes(def.key)) return setShared(shared.filter((k) => k !== def.key));
    if (!isBlockComplete(def.key, persona)) return setMsg({ ok: false, text: `Contesta todas las preguntas de «${def.label}» para compartirlo.` });
    setShared([...shared, def.key]);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil/anonimo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: cp, cuisines, dishes, persona, shareBlocks: shared }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setMsg({ ok: true, text: "Guardado." });
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

  return (
    <div>
      <div className="mb-4 rounded-2xl p-4" style={{ background: "#fff", border: "1.5px solid rgba(60,60,67,0.1)" }}>
        <div className="text-[13px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>Con lo que compartes hoy ganarías</div>
        <div key={estimate} className="mf-pop mt-0.5 text-[26px] font-extrabold" style={{ color: "#F24444" }}>{money(estimate)} <span className="text-[13px] font-semibold text-stone-500">por perfil vendido</span></div>
        <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          Si compartes todo: hasta {money(MAX_EARNINGS_PER_SALE)} por perfil Passport. Te llevas el {MYSTERFOODIE_SHARE_PCT}% del precio que paga el negocio (${TIER_INCREMENT.id} el ID y ${TIER_INCREMENT.passport} el Passport), repartido entre los bloques que compartes. El cargo por uso de la plataforma ({PLATFORM_FEE_PCT}%) lo paga el negocio aparte y no se te descuenta. Lo ves todo, mes a mes, en Finanzas.
        </div>
      </div>

      {BLOCKS.map((def) => {
        const on = shared.includes(def.key);
        const locked = def.tier === "passport" && visits < MIN_VISITS_PASSPORT;
        return (
          <div key={def.key} className="mb-3.5 rounded-2xl bg-white p-4" style={{ border: on ? "1.5px solid #F24444" : "1.5px solid rgba(60,60,67,0.1)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: def.tier === "passport" ? "#5856D6" : "#F24444" }}>
                  Nivel {def.tier === "passport" ? "Passport" : "ID"} · ganas {money((def.pct / 100) * TIER_INCREMENT[def.tier])} por venta
                </div>
                <div className="heading text-[19px]"><span aria-hidden="true">{BLOCK_EMOJI[def.key]} </span>{def.label}</div>
                <div className="text-[13px] text-stone-500">{def.desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggleShare(def)}
                className="relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors"
                style={{ background: on ? "#34C759" : "rgba(120,120,128,0.32)" }}
              >
                <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
                <span className="sr-only">Compartir {def.label}</span>
              </button>
            </div>
            {locked && (
              <p className="mt-2 text-[12px]" style={{ color: "#9A6A00" }}>
                Los bloques Passport se entregan a partir de {MIN_VISITS_PASSPORT} visitas (llevas {visits}); puedes dejar tus respuestas listas desde ahora.
              </p>
            )}

            {def.key === "gustos" && (
              <div className="mt-3">
                {chipGroup("Tipos de cocina que te gustan", `Elige al menos ${MIN_CUISINES}.`, CUISINES, cuisines, toggleIn(cuisines, setCuisines))}
                {chipGroup("Platillos que te gustan", `Elige al menos ${MIN_DISHES}.`, DISHES, dishes, toggleIn(dishes, setDishes))}
              </div>
            )}

            {def.key === "sector" && (
              <label className="mt-3 block">
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
            )}

            {def.fields.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "#F2F2F7" }}>
                  {answeredCount(def.key)}/{activeFields(def.key, persona).length} contestadas
                </div>
                {activeFields(def.key, persona).map((f) => (
                  <div key={f.key} className="mf-slide-in mt-4">
                    <div className="mb-1 flex items-center gap-2 text-[14px] font-bold">
                      <span>{f.label}</span>
                      {f.when && <span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: "#FFF0EE", color: "#F24444" }}>🎁 extra</span>}
                    </div>
                    {f.kind === "many" && <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>Puedes elegir varias</div>}
                    <FieldInput block={def.key} field={f} value={persona[def.key]?.[f.key]} onPick={(o) => setField(def.key, f.key, f.kind, o)} />
                  </div>
                ))}
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
      <button type="button" onClick={save} disabled={busy} className="w-full rounded-2xl py-4 text-[16px] font-bold text-white disabled:opacity-50" style={{ background: "#F24444" }}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
