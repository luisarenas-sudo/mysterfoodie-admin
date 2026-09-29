"use client";

import { useState } from "react";
import ScoreSelector from "@/components/ScoreSelector";
import BooleanToggle from "@/components/BooleanToggle";
import SelectChips from "@/components/SelectChips";
import { CATEGORIES, BUSINESS_TYPES, type Category } from "@/lib/categories";

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

type CategoryScoreResult = { key: string; label: string; average: number; count: number };

type SubmitResult = {
  shortCode: string;
  reportUrl: string;
  overallScore: number;
  categoryScores: CategoryScoreResult[];
  email: { status: string; error?: string } | null;
  dmMessage: string;
  dmLink: string | null;
  profileLink: string | null;
};

type StepDef =
  | { kind: "business" }
  | { kind: "category"; category: Category }
  | { kind: "comments" }
  | { kind: "review" };

const STEPS: StepDef[] = [
  { kind: "business" },
  ...CATEGORIES.map((category) => ({ kind: "category" as const, category })),
  { kind: "comments" },
  { kind: "review" },
];

function stepLabel(step: StepDef): string {
  if (step.kind === "business") return "Negocio";
  if (step.kind === "category") return step.category.label;
  if (step.kind === "comments") return "Comentarios";
  return "Revisar";
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<Business>(EMPTY_BUSINESS);
  const [shopperName, setShopperName] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const current = STEPS[step];
  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  function updateBusiness<K extends keyof Business>(key: K, value: Business[K]) {
    setBusiness((prev) => ({ ...prev, [key]: value }));
  }

  function categoryComplete(category: Category) {
    return category.items.every((item) => {
      if (item.type === "star") return (ratings[item.key] || 0) > 0;
      if (item.type === "select") return Boolean(selects[item.key]);
      return true;
    });
  }

  function canAdvance() {
    if (current.kind === "business") return Boolean(business.name.trim());
    if (current.kind === "category") return categoryComplete(current.category);
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business, shopperName, ratings, flags, selects, comments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "No se pudo guardar la evaluación");
        return;
      }
      setResult(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error de red");
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

  function resetAll() {
    setStep(0);
    setBusiness(EMPTY_BUSINESS);
    setShopperName("");
    setRatings({});
    setFlags({});
    setSelects({});
    setComments("");
    setResult(null);
    setSubmitError(null);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="text-sm uppercase tracking-wide text-brand-600">Evaluación guardada</p>
        <h1 className="heading mt-2 text-3xl text-ink">
          {business.name}: {result.overallScore} de 5
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {result.categoryScores
            .filter((c) => c.count > 0)
            .map((c) => (
              <div key={c.key} className="rounded-lg border border-stone-200 bg-white p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{c.average}</p>
                <p className="text-xs text-stone-400">de 5</p>
              </div>
            ))}
        </div>

        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700">Correo automático</p>
          {result.email ? (
            <p className="mt-1 text-sm text-stone-600">
              {result.email.status === "sent" && "Enviado correctamente."}
              {result.email.status === "skipped_no_api_key" &&
                "No se envió: falta configurar RESEND_API_KEY."}
              {result.email.status === "failed" && `Falló el envío: ${result.email.error}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-stone-600">
              No se envió: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700">Link corto del reporte</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={result.reportUrl}
              className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(result.reportUrl, "link")}
              className="rounded-md bg-stone-800 px-3 py-2 text-sm text-white hover:bg-stone-700"
            >
              {copied === "link" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700">
            Texto para enviar por DM de Instagram a la cuenta del negocio
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Instagram no permite pre-llenar el mensaje desde un link, así que copia el texto y
            pégalo dentro del DM al abrirlo.
          </p>
          <textarea
            readOnly
            value={result.dmMessage}
            rows={5}
            className="mt-2 w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(result.dmMessage, "dm")}
              className="rounded-md bg-stone-800 px-3 py-2 text-sm text-white hover:bg-stone-700"
            >
              {copied === "dm" ? "Copiado" : "Copiar mensaje"}
            </button>
            {result.dmLink ? (
              <a
                href={result.dmLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-brand-500 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"
              >
                Abrir DM en Instagram
              </a>
            ) : (
              <p className="self-center text-xs text-stone-500">
                Agrega el usuario de Instagram del negocio para generar el link directo.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="mt-8 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          Registrar otra visita
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Evaluación Mystery Shopper</h1>

      <div className="mt-6">
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-2 rounded-full bg-brand-gradient transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Paso {step + 1} de {STEPS.length} — {stepLabel(current)}
        </p>
      </div>

      {current.kind === "business" && (
        <div className="mt-8 max-w-xl space-y-4">
          <Field label="Nombre del negocio">
            <input
              value={business.name}
              onChange={(e) => updateBusiness("name", e.target.value)}
              className="input"
              placeholder="Ej. Cocina de Mar"
            />
          </Field>
          <Field label="Tipo de negocio">
            <select
              value={business.type}
              onChange={(e) => updateBusiness("type", e.target.value)}
              className="input"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Usuario de Instagram del negocio (sin @)">
            <input
              value={business.instagramHandle}
              onChange={(e) => updateBusiness("instagramHandle", e.target.value)}
              className="input"
              placeholder="Ej. cocinademar"
            />
          </Field>
          <Field label="Correo del negocio (opcional)">
            <input
              value={business.email}
              onChange={(e) => updateBusiness("email", e.target.value)}
              className="input"
              placeholder="contacto@negocio.com"
              type="email"
            />
          </Field>
          <Field label="Ciudad">
            <input
              value={business.city}
              onChange={(e) => updateBusiness("city", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Dirección (opcional)">
            <input
              value={business.address}
              onChange={(e) => updateBusiness("address", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Tu nombre (mystery shopper)">
            <input
              value={shopperName}
              onChange={(e) => setShopperName(e.target.value)}
              className="input"
            />
          </Field>
        </div>
      )}

      {current.kind === "category" && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {current.category.items.map((item) => (
            <div key={item.key}>
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <div className="mt-2">
                {item.type === "star" && (
                  <ScoreSelector
                    value={ratings[item.key] || 0}
                    onChange={(v) => setRatings((prev) => ({ ...prev, [item.key]: v }))}
                  />
                )}
                {item.type === "boolean" && (
                  <BooleanToggle
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
            </div>
          ))}
        </div>
      )}

      {current.kind === "comments" && (
        <div className="mt-8 max-w-xl space-y-2">
          <p className="text-sm font-medium text-ink">Sugerencias, mejoras y más</p>
          <p className="text-xs text-stone-500">
            Opcional: cualquier observación adicional sobre la visita que no quede reflejada en
            los indicadores.
          </p>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={6}
            className="input"
            placeholder="Escribe aquí cualquier comentario adicional..."
          />
        </div>
      )}

      {current.kind === "review" && (
        <div className="mt-8 max-w-xl space-y-4">
          <div className="rounded-md border border-stone-200 bg-white p-4 text-sm">
            <p className="font-medium text-ink">{business.name}</p>
            <p className="text-stone-500">
              {business.city || "Sin ciudad"} - @{business.instagramHandle || "sin instagram"}
            </p>
            <ul className="mt-3 space-y-1 text-stone-600">
              {CATEGORIES.map((cat) => (
                <li key={cat.key} className="flex justify-between">
                  <span>{cat.label}</span>
                  <span className="text-stone-400">completo</span>
                </li>
              ))}
            </ul>
            {comments.trim() && (
              <p className="mt-3 text-xs text-stone-500">
                Comentarios: {comments.trim().slice(0, 140)}
                {comments.trim().length > 140 ? "…" : ""}
              </p>
            )}
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        </div>
      )}

      <div className="mt-8 flex max-w-xl justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Atrás
          </button>
        ) : (
          <span />
        )}
        {current.kind === "review" ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Guardando..." : "Enviar evaluación"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
          </button>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
