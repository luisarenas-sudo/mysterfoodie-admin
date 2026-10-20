"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EmailStatusPanel from "@/components/EmailStatusPanel";
import SelectChips from "@/components/SelectChips";
import TriState, { type TriValue } from "@/components/wizard/TriState";
import { QUICK_TAGS, composeComments, commentPartsHaveContent } from "@/lib/visitComments";
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
import { BrandLoaderOverlay } from "@/components/BrandLoader";

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
  /** Presente cuando la visita viene de una asignación de Shopper; ausente cuando admin/sibarita visitan un negocio directamente. */
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
  /** Opcionales: borradores guardados antes de esta versión no los traen. */
  na?: Record<string, boolean>;
  tagsGood?: string[];
  tagsImprove?: string[];
  notes?: Record<string, string>;
  step: number;
  savedAt: number;
};

function draftHasContent(d: Pick<WizardDraft, "business" | "shopperName" | "ratings" | "flags" | "selects" | "comments" | "waiterName" | "na" | "tagsGood" | "tagsImprove" | "notes">) {
  return (
    Object.keys(d.na ?? {}).length > 0 ||
    commentPartsHaveContent({ good: d.tagsGood ?? [], improve: d.tagsImprove ?? [], notes: d.notes ?? {}, free: "" }) ||
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
  /** Visita de un plan mensual: avance del mes (el reporte ya se envió completo). */
  plan: { done: number; total: number; monthLabel: string; planName: string } | null;
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

const RATING_WORDS = ["", "Malo", "Bajo", "Regular", "Bueno", "Excelente"];

function Star({ filled, onClick, n }: { filled: boolean; onClick: () => void; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${n} de 5`}
      className="mf-tap flex flex-1 items-center justify-center"
      style={{ cursor: "pointer", height: 46 }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24">
        <path
          d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"
          fill={filled ? ACCENT : "rgba(60,60,67,0.15)"}
        />
      </svg>
    </button>
  );
}

function TagGroup({
  title,
  tags,
  selected,
  color,
  onToggle,
}: {
  title: string;
  tags: readonly string[];
  selected: string[];
  color: string;
  onToggle: (tag: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.55)" }}>
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(tag)}
              className="mf-tap rounded-full px-3.5 text-[13.5px] font-semibold"
              style={{
                height: 38,
                background: active ? color : "#fff",
                color: active ? "#fff" : "rgba(60,60,67,0.8)",
                boxShadow: active ? "none" : "inset 0 0 0 1px rgba(60,60,67,0.15)",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryNote({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(Boolean(value));
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mf-tap mt-4 w-full rounded-xl py-3 text-center text-[14px] font-semibold"
        style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
      >
        + Agregar una nota sobre {label.toLowerCase()} (opcional)
      </button>
    );
  }
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
        Nota sobre {label.toLowerCase()} (opcional)
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escríbela ahora que lo tienes fresco"
        style={{ ...inputStyle, height: 90, lineHeight: 1.4, resize: "none" }}
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
  // "No aplica" en un Sí/No: no entra al puntaje ni se guarda (igual que sin contestar).
  const [na, setNa] = useState<Record<string, boolean>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [tagsGood, setTagsGood] = useState<string[]>([]);
  const [tagsImprove, setTagsImprove] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
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
      setNa(draft.na ?? {});
      setSelects(draft.selects);
      setComments(draft.comments);
      setTagsGood(draft.tagsGood ?? []);
      setTagsImprove(draft.tagsImprove ?? []);
      setNotes(draft.notes ?? {});
      setStep(Math.min(draft.step, steps.length - 1));
      setDraftRestored(true);
    }
    draftLoadedRef.current = true;
    // Solo al montar: cada ruta es una visita distinta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || result) return;
    const draft: WizardDraft = { business, shopperName, waiterName, ratings, flags, na, selects, comments, tagsGood, tagsImprove, notes, step, savedAt: Date.now() };
    if (draftHasContent(draft)) {
      saveWizardDraft(draftId, draft);
    } else {
      clearWizardDraft(draftId);
    }
  }, [draftId, business, shopperName, waiterName, ratings, flags, na, selects, comments, tagsGood, tagsImprove, notes, step, result]);

  function discardDraft() {
    clearWizardDraft(draftId);
    setDraftRestored(false);
    setBusiness(boundAssignment ? businessFromAssignment(boundAssignment) : EMPTY_BUSINESS);
    setShopperName("");
    setWaiterName("");
    setRatings({});
    setFlags({});
    setNa({});
    setSelects({});
    setComments("");
    setTagsGood([]);
    setTagsImprove([]);
    setNotes({});
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

  function answeredIn(category: Category) {
    return category.items.filter((item) => {
      if (item.type === "star") return (ratings[item.key] || 0) > 0;
      if (item.type === "boolean") return typeof flags[item.key] === "boolean" || Boolean(na[item.key]);
      return Boolean(selects[item.key]);
    }).length;
  }

  function toggleTag(list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  function sendDm() {
    if (!result) return;
    copyToClipboard(result.dmMessage, "dm");
    if (result.dmLink) window.open(result.dmLink, "_blank", "noopener");
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
      const finalComments = composeComments({ good: tagsGood, improve: tagsImprove, notes, free: comments });
      const payload = boundAssignment
        ? boundAssignment.assignmentId
          ? { assignmentId: boundAssignment.assignmentId, shopperName, ratings, flags, selects, comments: finalComments, waiterName }
          : { clientId: boundAssignment.client.id, shopperName, ratings, flags, selects, comments: finalComments, waiterName }
        : { business, shopperName, ratings, flags, selects, comments: finalComments, waiterName };
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

          {result.plan && (
            <div className="card mt-3.5 flex items-center gap-3 p-4">
              <span aria-hidden className="inline-flex gap-1">
                {Array.from({ length: result.plan.total }, (_, i) => (
                  <span
                    key={i}
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: i < result.plan!.done ? "#34C759" : "rgba(60,60,67,0.18)" }}
                  />
                ))}
              </span>
              <div className="text-[13.5px] font-semibold">
                Plan {result.plan.planName}: visita {result.plan.done} de {result.plan.total} de {result.plan.monthLabel.toLowerCase()}
              </div>
            </div>
          )}

          {(() => {
            const emailOk = result.email?.status === "sent";
            return (
              <div className="mt-3.5 flex items-center gap-2 px-1 text-[13px] font-medium" style={{ color: emailOk ? "#248A3D" : "#B45309" }}>
                <span aria-hidden>{emailOk ? "✓" : "!"}</span>
                <span>{emailOk ? "Correo enviado al negocio." : "Aún no se envió el correo al negocio. Puedes hacerlo en “Más opciones”."}</span>
              </div>
            );
          })()}

          {!result.plan && (
            <div className="card mt-3 p-4">
              <p className="text-[15px] font-bold">Avísale al dueño</p>
              <p className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
                Un toque: copia el mensaje y abre su Instagram para que solo lo pegues.
              </p>
              <button
                type="button"
                onClick={sendDm}
                className="mf-tap mt-3 w-full rounded-2xl py-[14px] text-center text-[15.5px] font-bold text-white"
                style={{ background: ACCENT }}
              >
                {copied === "dm" ? "Mensaje copiado" : result.dmLink ? "Copiar mensaje y abrir Instagram" : "Copiar mensaje"}
              </button>
            </div>
          )}

          <details className="card mt-3 p-4" open={result.email?.status === "failed"}>
            <summary className="mf-tap cursor-pointer text-[14.5px] font-semibold" style={{ listStyle: "none" }}>
              Más opciones
            </summary>
            <div className="mt-3">
              <EmailStatusPanel formId={result.formId} initialStatus={result.email} />
            </div>
            {!result.plan && (
              <div className="mt-3 rounded-xl p-3 text-[13px] leading-relaxed" style={{ background: "#F2F2F7" }}>
                {result.dmMessage}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
                  Link del reporte
                </p>
                <p className="mt-0.5 truncate text-[14px]" style={{ color: ACCENT }}>
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
          </details>
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
            <div className="mb-2.5 flex items-center justify-between gap-3 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              <span>De 1 (malo) a 5 (excelente). Si algo no aplica, déjalo sin marcar.</span>
              <span
                className="flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: "rgba(60,60,67,0.08)", color: "rgba(60,60,67,0.7)" }}
              >
                {answeredIn(current.category)}/{current.category.items.length}
              </span>
            </div>

            {current.category.key === "atencion" && (
              <div className="mb-3.5">
                <MobileField label="Nombre de quien te atendió (opcional)">
                  <input
                    value={waiterName}
                    onChange={(e) => setWaiterName(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej. Fermín"
                    type="text"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </MobileField>
              </div>
            )}

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
                        na={na}
                        setNa={setNa}
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
                              na={na}
                              setNa={setNa}
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

            <CategoryNote
              key={current.category.key}
              label={current.category.label}
              value={notes[current.category.key] ?? ""}
              onChange={(v) => setNotes((prev) => ({ ...prev, [current.category.key]: v }))}
            />
          </>
        )}

        {current.kind === "comments" && (
          <div className="space-y-5">
            <div>
              <div className="heading mb-1 text-[22px] font-bold">¿Cómo te fue?</div>
              <div className="mb-3 text-[13.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>
                Toca lo que aplique. Todo es opcional y ayuda mucho al negocio.
              </div>
              <TagGroup title="Lo mejor" tags={QUICK_TAGS.good} selected={tagsGood} color="#34C759" onToggle={(t) => toggleTag(tagsGood, setTagsGood, t)} />
              <div className="h-3.5" />
              <TagGroup title="Para mejorar" tags={QUICK_TAGS.improve} selected={tagsImprove} color="#F24444" onToggle={(t) => toggleTag(tagsImprove, setTagsImprove, t)} />
            </div>
            <MobileField label="Algo más que quieras contar (opcional)">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Ej. el mesero fue muy amable pero el menú no tenía precios..."
                style={{ ...inputStyle, height: 110, lineHeight: 1.4, resize: "none" }}
                enterKeyHint="done"
              />
            </MobileField>
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
      {submitting && <BrandLoaderOverlay label="Guardando tu visita…" />}
    </div>
  );
}

function CategoryRow({
  item,
  ratings,
  flags,
  na,
  selects,
  setRatings,
  setFlags,
  setNa,
  setSelects,
  last,
}: {
  item: CategoryItem;
  ratings: Record<string, number>;
  flags: Record<string, boolean>;
  na: Record<string, boolean>;
  selects: Record<string, string>;
  setRatings: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setNa: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSelects: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  last: boolean;
}) {
  const rating = ratings[item.key] || 0;
  const tri: TriValue =
    item.type !== "boolean"
      ? undefined
      : na[item.key]
        ? "na"
        : typeof flags[item.key] === "boolean"
          ? flags[item.key]
            ? "yes"
            : "no"
          : undefined;

  function setTri(v: TriValue) {
    setFlags((prev) => {
      const next = { ...prev };
      if (v === "yes") next[item.key] = true;
      else if (v === "no") next[item.key] = false;
      else delete next[item.key];
      return next;
    });
    setNa((prev) => {
      const next = { ...prev };
      if (v === "na") next[item.key] = true;
      else delete next[item.key];
      return next;
    });
  }

  // Etiqueta arriba y control debajo, a todo el ancho: la etiqueta ya no se
  // parte en 3-4 renglones y cada estrella mide ~60x46 px (antes 40x40).
  return (
    <div className="py-3.5" style={!last ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[14.5px] leading-tight">{item.label}</div>
        {item.type === "star" && rating > 0 && (
          <span className="flex-shrink-0 text-[12px] font-semibold" style={{ color: ACCENT }}>
            {RATING_WORDS[rating]}
          </span>
        )}
      </div>
      <div className="mt-2">
        {item.type === "star" && (
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                n={n}
                filled={n <= rating}
                onClick={() => setRatings((prev) => ({ ...prev, [item.key]: n === prev[item.key] ? 0 : n }))}
              />
            ))}
          </div>
        )}
        {item.type === "boolean" && <TriState value={tri} onChange={setTri} />}
        {item.type === "select" && item.options && (
          <SelectChips
            options={item.options}
            value={selects[item.key]}
            onChange={(v) => setSelects((prev) => ({ ...prev, [item.key]: v }))}
          />
        )}
      </div>
    </div>
  );
}
