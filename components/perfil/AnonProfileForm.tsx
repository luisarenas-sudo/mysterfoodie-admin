"use client";

import { useState } from "react";
import { CUISINES, DISHES, MIN_CUISINES, MIN_DISHES, type FoodOption } from "@/lib/foodCatalog";

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

/** Código postal y gustos de la persona: alimentan su perfil anónimo (lo que ven los negocios que lo compran). */
export default function AnonProfileForm({ initial }: { initial: { postalCode: string; cuisines: string[]; dishes: string[] } }) {
  const [cp, setCp] = useState(initial.postalCode);
  const [cuisines, setCuisines] = useState(initial.cuisines);
  const [dishes, setDishes] = useState(initial.dishes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void) => (key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil/anonimo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: cp, cuisines, dishes }),
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

  const group = (title: string, hint: string, options: FoodOption[], sel: string[], onToggle: (k: string) => void) => (
    <div className="mb-5">
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
      <label className="mb-5 block">
        <span className="mb-1.5 block text-[13.5px] font-semibold">Código postal de tu casa</span>
        <input
          inputMode="numeric"
          maxLength={5}
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="91900"
          className="w-full rounded-[12px] bg-white px-3.5 py-3 text-[16px] outline-none"
          style={{ border: "1.5px solid rgba(60,60,67,0.14)" }}
        />
        <span className="mt-1 block text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          Solo sirve para saber de qué zona eres. Los negocios ven la zona, nunca tu código postal.
        </span>
      </label>
      {group("Tipos de cocina que te gustan", `Elige al menos ${MIN_CUISINES}.`, CUISINES, cuisines, toggle(cuisines, setCuisines))}
      {group("Platillos que te gustan", `Elige al menos ${MIN_DISHES}.`, DISHES, dishes, toggle(dishes, setDishes))}
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
