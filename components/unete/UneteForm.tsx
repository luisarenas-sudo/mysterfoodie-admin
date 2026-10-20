"use client";

import { useState } from "react";
import { ALIAS_STYLES, type AliasStyle } from "@/lib/alias";
import { BLOCK_EMOJI } from "@/lib/personaUi";
import { PersonaDeck, Celebration } from "@/components/persona/PersonaFields";
import { BLOCKS, ID_BLOCKS, PASSPORT_BLOCKS, TIER_INCREMENT, earningsForBlocks, isBlockComplete, type BlockKey, type Persona } from "@/lib/personaCatalog";
import { CUISINES, DISHES, EXPERIENCE_LEVELS, MIN_CUISINES, MIN_DISHES, TIME_SLOTS, WEEK_DAYS, type FoodOption } from "@/lib/foodCatalog";

type Form = {
  fullName: string;
  whatsapp: string;
  email: string;
  city: string;
  colonia: string;
  postalCode: string;
  isAdult: boolean;
  instagram: string;
  experienceLevel: string;
  experienceText: string;
  days: string[];
  slots: string[];
  hasVehicle: boolean | null;
  aliasStyle: AliasStyle | null;
  cuisines: string[];
  dishes: string[];
  persona: Persona;
  shareBlocks: BlockKey[];
  consent: boolean;
  website: string;
};

const EMPTY: Form = {
  fullName: "", whatsapp: "", email: "", city: "Veracruz", colonia: "", postalCode: "", isAdult: false, instagram: "", experienceLevel: "", experienceText: "",
  days: [], slots: [], hasVehicle: null, aliasStyle: null, cuisines: [], dishes: [], persona: {}, shareBlocks: [...ID_BLOCKS], consent: false, website: "",
};

const STEPS = ["Tus datos", "Dónde vives", "Experiencia", "Disponibilidad", "Lo que te gusta comer", "Tu perfil anónimo"] as const;

const input = "w-full rounded-[12px] bg-white px-3.5 py-3 text-[16px] outline-none";
const inputStyle = { border: "1.5px solid rgba(60,60,67,0.14)" };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13.5px] font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>{hint}</span>}
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="mf-tap rounded-full px-3.5 py-2 text-[14px] font-semibold"
      style={{ background: on ? "#F24444" : "#fff", color: on ? "#fff" : "#1C1C1E", border: `1.5px solid ${on ? "#F24444" : "rgba(60,60,67,0.14)"}` }}
    >
      {children}
    </button>
  );
}

function FoodGrid({ options, selected, toggle }: { options: FoodOption[]; selected: string[]; toggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.key} on={selected.includes(o.key)} onClick={() => toggle(o.key)}>
          <span aria-hidden="true">{o.emoji}</span> {o.label}
        </Chip>
      ))}
    </div>
  );
}

export default function UneteForm({ inviterSlug, inviterAlias }: { inviterSlug: string; inviterAlias: string }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [phase, setPhase] = useState<"q" | "share">("q");

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: "days" | "slots" | "cuisines" | "dishes", v: string) =>
    setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const setField = (block: BlockKey, field: string, kind: "one" | "many", value: string) =>
    setF((p) => {
      const cur = { ...(p.persona[block] ?? {}) };
      if (kind === "one") cur[field] = value;
      else {
        const arr = Array.isArray(cur[field]) ? (cur[field] as string[]) : [];
        cur[field] = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      }
      return { ...p, persona: { ...p.persona, [block]: cur } };
    });
  const toggleShare = (k: BlockKey) => setF((p) => ({ ...p, shareBlocks: p.shareBlocks.includes(k) ? p.shareBlocks.filter((x) => x !== k) : [...p.shareBlocks, k] }));

  /** Mensaje de lo que falta en el paso actual (null = completo). TODO es obligatorio. */
  const missing = (s: number): string | null => {
    if (s === 0) {
      if (f.fullName.trim().split(/\s+/).length < 2) return "Escribe tu nombre completo (nombre y apellido).";
      if (f.whatsapp.replace(/\D/g, "").length < 10) return "Escribe tu WhatsApp (10 dígitos).";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return "Escribe un correo válido.";
    }
    if (s === 1) {
      if (f.city.trim().length < 2) return "Escribe tu ciudad.";
      if (f.colonia.trim().length < 2) return "Escribe tu colonia.";
      if (!/^\d{5}$/.test(f.postalCode.trim())) return "Escribe tu código postal (5 dígitos).";
      if (!f.isAdult) return "Confirma que eres mayor de 18 años.";
    }
    if (s === 2) {
      if (f.instagram.trim().replace(/^@/, "").length < 2) return "Escribe tu Instagram.";
      if (!f.experienceLevel) return "Elige tu experiencia en restaurantes.";
      if (f.experienceText.trim().length < 5) return "Cuéntanos en una línea tu experiencia (si no tienes, escribe «ninguna»).";
    }
    if (s === 3) {
      if (f.days.length < 1) return "Elige al menos un día.";
      if (f.slots.length < 1) return "Elige al menos un horario.";
      if (f.hasVehicle === null) return "Dinos si cuentas con vehículo.";
    }
    if (s === 4) {
      if (f.cuisines.length < MIN_CUISINES) return "Elige al menos un tipo de cocina.";
      if (f.dishes.length < MIN_DISHES) return `Elige al menos ${MIN_DISHES} platillos (llevas ${f.dishes.length}).`;
      if (!f.aliasStyle) return "Elige el estilo de tu nombre anónimo.";
    }
    if (s === 5) {
      for (const k of PASSPORT_BLOCKS) if (!isBlockComplete(k, f.persona)) return `Contesta todas las preguntas de «${BLOCKS.find((b) => b.key === k)!.label}».`;
      if (!f.consent) return "Acepta el aviso de privacidad para enviar.";
    }
    return null;
  };

  const next = async () => {
    const m = missing(step);
    if (m) return setError(m);
    setError(null);
    if (step < STEPS.length - 1) {
      if (step + 1 === 5) setPhase(PASSPORT_BLOCKS.every((k) => isBlockComplete(k, f.persona)) ? "share" : "q");
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/unete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, inviterSlug }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No pudimos enviar tu solicitud. Intenta de nuevo.");
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tu solicitud.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card px-6 py-8 text-center">
        <div className="text-[44px]" aria-hidden="true">🎉</div>
        <div className="heading mt-2 text-[24px] font-bold">¡Gracias, {f.fullName.split(" ")[0]}!</div>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "rgba(60,60,67,0.8)" }}>
          Recibimos tu solicitud para ser MysterFoodie Shopper. Un Master Chef la va a revisar con calma y, si todo va bien, te llegará un correo a {f.email.trim()} para crear tu acceso.
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "rgba(60,60,67,0.55)" }}>
          Si no lo ves, revisa tu carpeta de spam. Dudas: hola@mysterfoodie.com
        </p>
      </div>
    );
  }

  return (
    <div>
      {step === 0 && (
        <div className="mb-5 text-center">
          <div className="heading text-[26px] font-bold leading-tight">
            <span style={{ color: "#F24444" }}>{inviterAlias}</span> te invita a ser MysterFoodie Shopper
          </div>
          <p className="mt-2 text-[14.5px] leading-snug" style={{ color: "rgba(60,60,67,0.75)" }}>
            Visitas restaurantes como cliente misterioso, los evalúas desde tu celular y te pagan por cada visita. Llena tu solicitud (todo es obligatorio, toma ~3 minutos).
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between text-[12.5px] font-semibold" style={{ color: "rgba(60,60,67,0.6)" }}>
        <span>Paso {step + 1} de {STEPS.length} · {STEPS[step]}</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(60,60,67,0.1)" }}>
        <div className="h-full rounded-full" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "#F24444", transition: "width 300ms ease" }} />
      </div>

      <div className="card px-4 pb-2 pt-5">
        {/* Honeypot */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden="true" />

        {step === 0 && (
          <>
            <Field label="Nombre completo"><input className={input} style={inputStyle} autoComplete="name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
            <Field label="WhatsApp"><input className={input} style={inputStyle} inputMode="tel" autoComplete="tel" placeholder="229 123 4567" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
            <Field label="Correo" hint="Aquí te llegará tu acceso."><input className={input} style={inputStyle} type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Ciudad"><input className={input} style={inputStyle} value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Colonia"><input className={input} style={inputStyle} value={f.colonia} onChange={(e) => set("colonia", e.target.value)} /></Field>
            <Field label="Código postal" hint="Solo lo usamos para saber de qué zona eres; nunca se comparte."><input className={input} style={inputStyle} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="91900" value={f.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))} /></Field>
            <label className="mb-4 flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={f.isAdult} onChange={(e) => set("isAdult", e.target.checked)} />
              <span className="text-[14.5px] font-medium">Soy mayor de 18 años</span>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Instagram" hint="Tu usuario, por ejemplo @tuusuario."><input className={input} style={inputStyle} autoCapitalize="none" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} /></Field>
            <div className="mb-4">
              <span className="mb-1.5 block text-[13.5px] font-semibold">Experiencia en restaurantes</span>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_LEVELS.map((l) => (
                  <Chip key={l} on={f.experienceLevel === l} onClick={() => set("experienceLevel", l)}>{l}</Chip>
                ))}
              </div>
            </div>
            <Field label="Cuéntanos en una línea" hint="Dónde has trabajado o qué te gusta de los restaurantes. Si no tienes, escribe «ninguna».">
              <textarea className={input} style={inputStyle} rows={3} maxLength={400} value={f.experienceText} onChange={(e) => set("experienceText", e.target.value)} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div className="mb-4">
              <span className="mb-1.5 block text-[13.5px] font-semibold">Días disponibles</span>
              <div className="flex flex-wrap gap-2">{WEEK_DAYS.map((d) => <Chip key={d} on={f.days.includes(d)} onClick={() => toggle("days", d)}>{d}</Chip>)}</div>
            </div>
            <div className="mb-4">
              <span className="mb-1.5 block text-[13.5px] font-semibold">Horarios disponibles</span>
              <div className="flex flex-wrap gap-2">{TIME_SLOTS.map((d) => <Chip key={d} on={f.slots.includes(d)} onClick={() => toggle("slots", d)}>{d}</Chip>)}</div>
            </div>
            <div className="mb-4">
              <span className="mb-1.5 block text-[13.5px] font-semibold">¿Cuentas con vehículo?</span>
              <div className="flex gap-2">
                <Chip on={f.hasVehicle === true} onClick={() => set("hasVehicle", true)}>Sí</Chip>
                <Chip on={f.hasVehicle === false} onClick={() => set("hasVehicle", false)}>No</Chip>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="mb-3 text-[13px] leading-snug" style={{ color: "rgba(60,60,67,0.65)" }}>
              Lo más típico que se pide en Veracruz y Boca del Río en Uber Eats. Elige lo que te gusta para asignarte visitas que disfrutes.
            </p>
            <div className="mb-1 text-[13.5px] font-semibold">Tipos de cocina que te gustan</div>
            <div className="mb-5"><FoodGrid options={CUISINES} selected={f.cuisines} toggle={(k) => toggle("cuisines", k)} /></div>
            <div className="mb-1 text-[13.5px] font-semibold">Platillos que te gustan <span style={{ color: "rgba(60,60,67,0.5)" }}>(mínimo {MIN_DISHES})</span></div>
            <div className="mb-5"><FoodGrid options={DISHES} selected={f.dishes} toggle={(k) => toggle("dishes", k)} /></div>
            <div className="mb-1 text-[13.5px] font-semibold">Tu nombre anónimo</div>
            <p className="mb-2 text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              Cada MysterFoodie tiene uno (una especia, o una fruta o verdura en «e» si eres no binarie, con el apellido de una figura famosa). Elige el estilo; cuando te aprueben y entres, descubres tu nombre (tienes 3 intentos y, una vez elegido, ya no se cambia).
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              {ALIAS_STYLES.map((s) => (
                <Chip key={s.value} on={f.aliasStyle === s.value} onClick={() => set("aliasStyle", s.value)}>{s.label} · {s.example}</Chip>
              ))}
            </div>
          </>
        )}
        {step === 5 && (
          <>
            {phase === "q" ? (
              <>
                <p className="mb-4 text-[13.5px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
                  🕶️ Los negocios que visites conocerán a su MysterFoodie de forma anónima: con tu nombre anónimo, rangos y categorías, nunca tu nombre, foto, contacto ni documentos.
                  Juega con estas preguntas: toca, elige y avanza. Algunas respuestas abren una pregunta extra.
                </p>
                <PersonaDeck
                  blocks={PASSPORT_BLOCKS}
                  persona={f.persona}
                  onPick={(b, fl, o) => setField(b, fl.key, fl.kind, o)}
                  onDone={() => { setPhase("share"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onExit={() => { setError(null); setStep(4); }}
                />
              </>
            ) : (
              <>
                <div className="mb-3 text-center">
                  <Celebration />
                  <div className="text-[40px]" aria-hidden="true">🎉</div>
                  <div className="heading text-[22px]">¡Listo, ya casi eres un MysterFoodie!</div>
                  <button type="button" onClick={() => setPhase("q")} className="mf-tap mt-1 text-[13px] font-semibold" style={{ color: "#F24444" }}>Revisar mis respuestas</button>
                </div>
            <div className="heading mb-1 text-[18px]">¿Qué compartes y cuánto ganas?</div>
            <p className="mb-2 text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              Puedes cambiarlo cuando quieras en Perfil → Mi perfil anónimo. Cada bloque paga su porcentaje del escalón de precio (${TIER_INCREMENT.id} el nivel ID y ${TIER_INCREMENT.passport} el nivel Passport).
            </p>
            <div className="mb-3 flex flex-col gap-2">
              {BLOCKS.map((b) => {
                const on = f.shareBlocks.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleShare(b.key)}
                    className="mf-tap flex items-center justify-between gap-3 rounded-[14px] bg-white px-3.5 py-3 text-left"
                    style={{ border: `1.5px solid ${on ? "#F24444" : "rgba(60,60,67,0.14)"}` }}
                  >
                    <span>
                      <span className="block text-[14.5px] font-semibold"><span aria-hidden="true">{BLOCK_EMOJI[b.key]} </span>{b.label}</span>
                      <span className="block text-[12px]" style={{ color: "rgba(60,60,67,0.6)" }}>Nivel {b.tier === "passport" ? "Passport" : "ID"} · ganas ${Math.round((b.pct / 100) * TIER_INCREMENT[b.tier] * 100) / 100} por venta</span>
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: on ? "#34C759" : "rgba(60,60,67,0.45)" }}>{on ? "Comparto" : "No comparto"}</span>
                  </button>
                );
              })}
            </div>
            <p className="mb-4 rounded-2xl px-4 py-3 text-center text-[13px] font-semibold" style={{ background: "#FFF0EE" }}>
              💰 Compartiendo lo que tienes activado ganarías
              <span key={f.shareBlocks.join()} className="mf-pop mt-0.5 block text-[26px] font-extrabold" style={{ color: "#F24444" }}>${earningsForBlocks(f.shareBlocks.filter((k) => isBlockComplete(k, f.persona))).toFixed(2)}</span>
              por cada perfil vendido
            </p>
            <label className="mb-4 flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span className="text-[13px] leading-snug">
                Acepto que MysterFoodie use mis datos para evaluar mi solicitud y contactarme (hola@mysterfoodie.com), y que, si me aprueban, los bloques que decidí compartir (sin mi nombre, foto, contacto ni documentos; solo rangos y categorías) puedan mostrarse a los negocios como un perfil anónimo con mi nombre anónimo. Entiendo que puedo cambiarlo cuando quiera.
              </span>
            </label>
          </>
            )}
          </>
        )}
      </div>

      {error && <p className="mt-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-medium" style={{ background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>{error}</p>}

      <div className="mt-4 flex gap-2.5" style={{ display: step === 5 && phase === "q" ? "none" : undefined }}>
        {step > 0 && (
          <button type="button" onClick={() => { setError(null); if (step === 5 && phase === "share") setPhase("q"); else setStep(step - 1); }} className="mf-tap min-h-[52px] rounded-[14px] px-5 text-[15px] font-semibold" style={{ background: "rgba(60,60,67,0.08)" }}>
            Atrás
          </button>
        )}
        <button type="button" disabled={busy} onClick={next} className="mf-tap min-h-[52px] flex-1 rounded-[14px] text-[16px] font-bold text-white" style={{ background: "#F24444", opacity: busy ? 0.7 : 1 }}>
          {step === STEPS.length - 1 ? (busy ? "Enviando…" : "Enviar mi solicitud") : "Continuar"}
        </button>
      </div>
    </div>
  );
}
