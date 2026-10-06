"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EmailStatusPanel from "@/components/EmailStatusPanel";
import SelectChips from "@/components/SelectChips";
import {
  CATEGORIES,
  BUSINESS_TYPES,
  groupCategoryItems,
  type Category,
  type CategoryItem,
} from "@/lib/categories";
import { getVerdict } from "@/lib/verdict";
import { CATEGORY_EMOJI } from "@/lib/ring";
import ActivityRing from "@/components/mobile/ActivityRing";
import { loadWizardDraft, saveWizardDraft, clearWizardDraft } from "@/lib/wizardDraft";
import { friendlyError } from "@/lib/friendlyError";

type Business = {
  name: string;
  type: string;
  contactName: string;
  phone: string;
  instagramHandle: string;
  email: string;
  address: string;
  city: string;
};

const EMPTY_BUSINESS: Business = {
  name: "",
  type: "restaurante",
  contactName: "",
  phone: "",
  instagramHandle: "",
  email: "",
  address: "",
  city: "",
};

export type BoundAssignment = {
  /** Presente cuando la visita viene de una asignación de Foodie; ausente cuando admin/sibarita visitan un negocio directamente. */
  assignmentId?: string;
  client: {
    id: string;
    name: string;
    type: string;
    instagramHandle: string | null;
    email: string | null;
    city: string | null;
  };
};

function businessFromAssignment(a: BoundAssignment): Business {
  return {
    name: a.client.name,
    type: a.client.type,
    contactName: "",
    phone: "",
    instagramHandle: a.client.instagramHandle || "",
    email: a.client.email || "",
    address: "",
    city: a.client.city || "",
  };
}

type WizardDraft = {
  business: Business;
  shopperName: string;
  waiterName: string;
  ratings: Record<string, number>;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  comments: string;
  step: number;
  savedAt: number;
};

function draftHasContent(d: Pick<WizardDraft, "business" | "shopperName" | "ratings" | "flags" | "selects" | "comments" | "waiterName">) {
  return (
    Boolean(d.business.name.trim()) ||
    Boolean(d.shopperName.trim()) ||
    Boolean(d.waiterName.trim()) ||
    Boolean(d.comments.trim()) ||
    Object.keys(d.ratings).length > 0 ||
    Object.keys(d.flags).length > 0 ||
    Object.keys(d.selects).length > 0
  );
}

type CategoryScoreResult = { key: string; label: string; average: number; count: number };
type EmailOutcome = { status: string; error?: string };
type SubmitResult = {
  formId: string;
  shortCode: string;
  reportUrl: string;
  overallScore: number;
  categoryScores: CategoryScoreResult[];
  email: EmailOutcome | null;
  dmMessage: string;
  dmLink: string | null;
  profileLink: string | null;
};

type StepDef = { kind: "business" } | { kind: "category"; category: Category } | { kind: "comments" };

const STEPS: StepDef[] = [
  { kind: "business" },
  ...CATEGORIES.map((category) => ({ kind: "category" as const, category })),
  { kind: "comments" },
];

const ACCENT = "#F24444";

function Star({ filled, onClick }: { filled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Calificar"
      className="mf-tap flex items-center justify-center p-1.5"
      style={{ cursor: "pointer" }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24">
        <path
          d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"
          fill={filled ? ACCENT : "rgba(60,60,67,0.15)"}
        />
      </svg>
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="mf-tap"
      style={{
        width: 51,
        height: 31,
        borderRadius: 16,
        background: value ? "#34C759" : "rgba(120,120,128,0.32)",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          background: "#fff",
          position: "absolute",
          top: 2,
          left: value ? 22 : 2,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          transition: "left 0.15s ease",
        }}
      />
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 16, // >=16px evita el zoom automático de iOS Safari al enfocar
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

export default function MobileWizard({ boundAssignment }: { boundAssignment?: BoundAssignment } = {}) {
  const router = useRouter();
  const steps = boundAssignment ? STEPS.filter((s) => s.kind !== "business") : STEPS;
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cada "Continuar"/"Atrás" cambia de paso: regresamos el scroll hasta
  // arriba para que el siguiente paso siempre se vea completo desde el
  // inicio (si no, se quedaba en la posición del paso anterior y podía
  // parecer que faltaban campos o que el botón estaba "pegado" abajo).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const [business, setBusiness] = useState<Business>(
    boundAssignment ? businessFromAssignment(boundAssignment) : EMPTY_BUSINESS
  );
  const [shopperName, setShopperName] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Autoguardado: un borrador por visita (assignmentId, o el id del
  // negocio si se visita directo, o "new" para el wizard en blanco).
  const draftId = boundAssignment?.assignmentId ?? boundAssignment?.client.id ?? "new";
  const [draftRestored, setDraftRestored] = useState(false);
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    const draft = loadWizardDraft<WizardDraft>(draftId);
    if (draft) {
      setBusiness(draft.business);
      setShopperName(draft.shopperName);
      setWaiterName(draft.waiterName);
      setRatings(draft.ratings);
      setFlags(draft.flags);
      setSelects(draft.selects);
      setComments(draft.comments);
      setStep(Math.min(draft.step, steps.length - 1));
      setDraftRestored(true);
    }
    draftLoadedRef.current = true;
    // Solo al montar: cada ruta es una visita distinta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || result) return;
    const draft: WizardDraft = { business, shopperName, waiterName, ratings, flags, selects, comments, step, savedAt: Date.now() };
    if (draftHasContent(draft)) {
      saveWizardDraft(draftId, draft);
    } else {
      clearWizardDraft(draftId);
    }
  }, [draftId, business, shopperName, waiterName, ratings, flags, selects, comments, step, result]);

  function discardDraft() {
    clearWizardDraft(draftId);
    setDraftRestored(false);
    setBusiness(boundAssignment ? businessFromAssignment(boundAssignment) : EMPTY_BUSINESS);
    setShopperName("");
    setWaiterName("");
    setRatings({});
    setFlags({});
    setSelects({});
    setComments("");
    setStep(0);
  }

  const current = steps[step];
  const progressPct = Math.round(((step + 1) / steps.length) * 100);

  function updateBusiness<K extends keyof Business>(key: K, value: Business[K]) {
    setBusiness((prev) => ({ ...prev, [key]: value }));
  }

  // Los indicadores tipo estrella son opcionales: se puede avanzar sin
  // "picar" todas las estrellas de la categoría -- el indicador que no se
  // califica simplemente no entra en el promedio (ver lib/scoring.ts). Los
  // selects (ej. tipo de menú) sí siguen siendo obligatorios.
  function categoryComplete(category: Category) {
    return category.items.every((item) => {
      if (item.type === "select") return Boolean(selects[item.key]);
      return true;
    });
  }

  function canAdvance() {
    if (current.kind === "business") return Boolean(business.name.trim());
    if (current.kind === "category") return categoryComplete(current.category);
    return true;
  }

  function goBack() {
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
    if (boundAssignment?.assignmentId) {
      router.push("/nueva-visita");
    } else if (boundAssignment) {
      router.push(`/negocios/${boundAssignment.client.id}`);
    } else {
      router.push("/");
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = boundAssignment
        ? boundAssignment.assignmentId
          ? { assignmentId: boundAssignment.assignmentId, shopperName, ratings, flags, selects, comments, waiterName }
          : { clientId: boundAssignment.client.id, shopperName, ratings, flags, selects, comments, waiterName }
        : { business, shopperName, ratings, flags, selects, comments, waiterName };
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "No se pudo guardar la evaluación");
        return;
      }
      clearWizardDraft(draftId);
      setResult(data);
    } catch (err) {
      setSubmitError(friendlyError(err, { offline: "Sin conexión. Tu avance está guardado en este teléfono: vuelve a intentar cuando tengas internet." }));
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function stepTitle(): string {
    if (current.kind === "business") return "Negocio";
    if (current.kind === "category") return current.category.label;
    return "Comentarios";
  }

  // ---------------- resultado ----------------
  if (result) {
    const verdict = getVerdict(result.overallScore);
    const catScores = result.categoryScores.filter((c) => c.count > 0);

    return (
      <div className="md:hidden fixed inset-0 z-40 flex flex-col mf-push-in" style={{ background: "#F2F2F7" }}>
        <div className="mf-scroll flex-1 overflow-y-auto px-5 pb-8 pt-6">
          <div className="flex flex-col items-center text-center">
            <svg width="52" height="52" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="#34C759" />
              <path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="heading mt-2.5 text-xl font-bold">¡Visita completada!</div>
            <div className="heading mt-1 text-[19px] font-bold" style={{ color: ACCENT }}>
              {business.name}
            </div>
          </div>

          <div className="flex flex-col items-center py-3.5">
            <ActivityRing value={result.overallScore} max={5} size={110} strokeWidth={10} color={verdict.color}>
              <div className="text-2xl font-bold">{result.overallScore}</div>
            </ActivityRing>
          </div>

          <div className="card p-3.5">
            <div className="grid grid-cols-2 gap-x-2 gap-y-3.5">
              {catScores.map((cs) => (
                <div key={cs.key} className="flex items-center gap-2">
                  <ActivityRing value={cs.average} max={5} size={42} strokeWidth={6} color={verdict.color}>
                    <div className="text-[16px]">{CATEGORY_EMOJI[cs.key] ?? "⭐"}</div>
                  </ActivityRing>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{cs.label}</div>
                    <div className="text-[11.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {cs.average}/5
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <EmailStatusPanel formId={result.formId} initialStatus={result.email} />
          </div>

          <div className="card mt-3.5 p-4">
            <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
              Mensaje para Instagram DM
            </p>
            <div className="mt-2 rounded-xl p-3 text-[13.5px] leading-relaxed" style={{ background: "#F2F2F7" }}>
              {result.dmMessage}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(result.dmMessage, "dm")}
              className="mf-tap mt-2.5 w-full rounded-xl py-2.5 text-center text-[14.5px] font-semibold"
              style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
            >
              {copied === "dm" ? "Copiado" : "Copiar texto"}
            </button>
            {result.dmLink && (
              <a
                href={result.dmLink}
                target="_blank"
                rel="noreferrer"
                className="mf-tap mt-2 block w-full rounded-xl py-2.5 text-center text-[14.5px] font-semibold"
                style={{ border: "1px solid rgba(60,60,67,0.15)" }}
              >
                Abrir DM en Instagram
              </a>
            )}
          </div>

          <div className="card mt-3 flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
                Link del reporte
              </p>
              <p className="mt-0.5 truncate text-[14.5px]" style={{ color: ACCENT }}>
                {result.reportUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(result.reportUrl, "link")}
              className="mf-tap flex-shrink-0 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold"
              style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
            >
              {copied === "link" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div
          className="flex-shrink-0 px-5 pt-3"
          style={{
            background: "rgba(249,249,251,0.95)",
            borderTop: "1px solid rgba(60,60,67,0.1)",
            paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (boundAssignment?.assignmentId) {
                router.push("/nueva-visita");
              } else if (boundAssignment) {
                router.push(`/negocios/${boundAssignment.client.id}`);
              } else {
                router.push("/");
              }
            }}
            className="mf-tap w-full rounded-2xl py-[15px] text-center text-[16px] font-bold text-white"
            style={{ background: ACCENT }}
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  // ---------------- wizard steps ----------------
  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col mf-push-in" style={{ background: "#F2F2F7" }}>
      <div style={{ background: "rgba(249,249,251,0.95)", borderBottom: "1px solid rgba(60,60,67,0.1)", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
          {/* La flecha de arriba solo sirve para SALIR del cuestionario (primer
              paso); de ahí en adelante "Atrás" vive abajo, al alcance del pulgar,
              para no tener dos botones que hacen lo mismo. */}
          {step === 0 ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Salir"
              className="mf-tap -my-3 flex w-[46px] flex-shrink-0 items-center py-3"
              style={{ cursor: "pointer" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" stroke={ACCENT} strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="w-[46px] flex-shrink-0" />
          )}
          <div className="flex-1 truncate text-center">
            <div className="truncate text-[16px] font-bold">{stepTitle()}</div>
            {boundAssignment && (
              <div className="truncate text-[11.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
                {boundAssignment.client.name}
              </div>
            )}
          </div>
          <div className="w-[46px] flex-shrink-0 text-right text-[12.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
            {step + 1}/{steps.length}
          </div>
        </div>
        <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full" style={{ background: "rgba(60,60,67,0.1)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ background: ACCENT, width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="mf-scroll flex-1 overflow-y-auto px-5 pb-6 pt-[18px]">
        {draftRestored && (
          <div
            className="mb-3.5 flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px]"
            style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
          >
            <span>Recuperamos tu progreso de esta visita.</span>
            <button type="button" onClick={discardDraft} className="mf-tap flex-shrink-0 font-semibold underline">
              Empezar de nuevo
            </button>
          </div>
        )}
        {current.kind === "business" && (
          <div className="space-y-3.5">
            <MobileField label="Nombre del negocio">
              <input
                value={business.name}
                onChange={(e) => updateBusiness("name", e.target.value)}
                style={inputStyle}
                placeholder="Ej. Cocina de Mar"
                type="text"
                autoComplete="organization"
                enterKeyHint="next"
              />
            </MobileField>
            <MobileField label="Tipo de negocio">
              <select
                value={business.type}
                onChange={(e) => updateBusiness("type", e.target.value)}
                style={inputStyle}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </MobileField>
            <MobileField label="Usuario de Instagram del negocio (sin @)">
              <input
                value={business.instagramHandle}
                onChange={(e) => updateBusiness("instagramHandle", e.target.value)}
                style={inputStyle}
                placeholder="Ej. cocinademar"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                enterKeyHint="next"
              />
            </MobileField>
            <MobileField label="Correo del negocio (opcional)">
              <input
                value={business.email}
                onChange={(e) => updateBusiness("email", e.target.value)}
                style={inputStyle}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                placeholder="contacto@negocio.com"
                enterKeyHint="next"
              />
            </MobileField>
            <MobileField label="Ciudad">
              <input
                value={business.city}
                onChange={(e) => updateBusiness("city", e.target.value)}
                style={inputStyle}
                type="text"
                autoComplete="address-level2"
                enterKeyHint="next"
              />
            </MobileField>
            <MobileField label="Tu nombre (mystery shopper)">
              <input
                value={shopperName}
                onChange={(e) => setShopperName(e.target.value)}
                style={inputStyle}
                type="text"
                autoComplete="name"
                enterKeyHint="done"
              />
            </MobileField>
          </div>
        )}

        {current.kind === "category" && (
          <>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="text-[30px] leading-none">{CATEGORY_EMOJI[current.category.key] ?? "⭐"}</div>
              <div className="heading text-[22px] font-bold">{current.category.label}</div>
            </div>
            <div className="mb-2.5 text-[13.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              Califica cada aspecto de 1 a 5 estrellas
            </div>

            <div className="space-y-3.5">
              {groupCategoryItems(current.category.items).map((block, blockIdx) =>
                block.kind === "standalone" ? (
                  <div key={`standalone-${blockIdx}`} className="card px-4 py-0.5">
                    {block.items.map((item, i) => (
                      <CategoryRow
                        key={item.key}
                        item={item}
                        ratings={ratings}
                        flags={flags}
                        selects={selects}
                        setRatings={setRatings}
                        setFlags={setFlags}
                        setSelects={setSelects}
                        last={i === block.items.length - 1}
                      />
                    ))}
                  </div>
                ) : (
                  <div key={`group-${block.group}-${blockIdx}`}>
                    <div
                      className="px-0.5 pb-1.5 pt-1 text-[12.5px] font-bold uppercase tracking-wide"
                      style={{ color: "rgba(60,60,67,0.55)" }}
                    >
                      {block.group}
                    </div>
                    <div className="card px-4 py-0.5">
                      {block.subBlocks.map((sub, subIdx) => (
                        <div key={`sub-${subIdx}`}>
                          {sub.subgroup && (
                            <p
                              className="mb-0.5 pt-2.5 text-[12px] font-medium"
                              style={{ color: "rgba(60,60,67,0.5)", borderTop: subIdx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}
                            >
                              {sub.subgroup}
                            </p>
                          )}
                          {sub.items.map((item, i) => (
                            <CategoryRow
                              key={item.key}
                              item={item}
                              ratings={ratings}
                              flags={flags}
                              selects={selects}
                              setRatings={setRatings}
                              setFlags={setFlags}
                              setSelects={setSelects}
                              last={subIdx === block.subBlocks.length - 1 && i === sub.items.length - 1}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}

        {current.kind === "comments" && (
          <div className="space-y-5">
            <MobileField label="Nombre del mesero que te atendió (opcional)">
              <input
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                style={inputStyle}
                placeholder="Ej. Fermín"
                type="text"
                autoComplete="off"
                enterKeyHint="next"
              />
            </MobileField>
            <div>
              <div className="heading mb-1 text-[22px] font-bold">Sugerencias, mejoras y más</div>
              <div className="mb-3.5 text-[13.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
                Opcional, pero ayuda mucho al negocio
              </div>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Ej. el mesero tardó en tomar la orden, el menú está desactualizado..."
                style={{ ...inputStyle, height: 160, lineHeight: 1.4, resize: "none" }}
                enterKeyHint="done"
              />
            </div>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          </div>
        )}
      </div>

      <div
        className="flex flex-shrink-0 gap-2.5 px-5 pt-3"
        style={{
          background: "rgba(249,249,251,0.95)",
          borderTop: "1px solid rgba(60,60,67,0.1)",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
        }}
      >
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="mf-tap flex-1 rounded-2xl py-3.5 text-center text-[15.5px] font-semibold"
            style={{ background: "rgba(118,118,128,0.12)" }}
          >
            Atrás
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="mf-tap flex-[2] rounded-2xl py-3.5 text-center text-[15.5px] font-bold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mf-tap flex-[2] rounded-2xl py-3.5 text-center text-[15.5px] font-bold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {submitting ? "Guardando..." : "Guardar visita"}
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  item,
  ratings,
  flags,
  selects,
  setRatings,
  setFlags,
  setSelects,
  last,
}: {
  item: CategoryItem;
  ratings: Record<string, number>;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  setRatings: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSelects: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  last: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-3.5"
      style={!last ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
    >
      <div className="max-w-[190px] text-[14.5px] leading-tight">{item.label}</div>
      {item.type === "star" && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              filled={n <= (ratings[item.key] || 0)}
              onClick={() => setRatings((prev) => ({ ...prev, [item.key]: n === prev[item.key] ? 0 : n }))}
            />
          ))}
        </div>
      )}
      {item.type === "boolean" && (
        <Toggle
          value={Boolean(flags[item.key])}
          onChange={(v) => setFlags((prev) => ({ ...prev, [item.key]: v }))}
        />
      )}
      {item.type === "select" && item.options && (
        <SelectChips
          options={item.options}
          value={selects[item.key]}
          onChange={(v) => setSelects((prev) => ({ ...prev, [item.key]: v }))}
        />
      )}
    </div>
  );
}
