"use client";

import { useState } from "react";
import ScoreSelector from "@/components/ScoreSelector";
import { RATING_CATEGORIES, FLAG_QUESTIONS, BUSINESS_TYPES } from "@/lib/categories";

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

type SubmitResult = {
  shortCode: string;
  reportUrl: string;
  overallScore: number;
  strengths: { key: string; label: string; score: number }[];
  opportunities: { key: string; label: string; score: number }[];
  email: { status: string; error?: string } | null;
  dmMessage: string;
  dmLink: string | null;
  profileLink: string | null;
};

const STEPS = ["Negocio", "Calificacion", "Indicadores", "Revisar"] as const;

export default function Home() {
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<Business>(EMPTY_BUSINESS);
  const [shopperName, setShopperName] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const ratingsComplete = RATING_CATEGORIES.every((c) => ratings[c.key]);

  function updateBusiness<K extends keyof Business>(key: K, value: Business[K]) {
    setBusiness((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business, shopperName, ratings, flags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "No se pudo guardar la evaluacion");
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
    setResult(null);
    setSubmitError(null);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="text-sm uppercase tracking-wide text-brand-600">Evaluacion guardada</p>
        <h1 className="heading mt-2 text-3xl text-ink">
          {business.name}: {result.overallScore} de 5
        </h1>

        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700">Correo automatico</p>
          {result.email ? (
            <p className="mt-1 text-sm text-stone-600">
              {result.email.status === "sent" && "Enviado correctamente."}
              {result.email.status === "skipped_no_api_key" &&
                "No se envio: falta configurar RESEND_API_KEY."}
              {result.email.status === "failed" && `Fallo el envio: ${result.email.error}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-stone-600">
              No se envio: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado.
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
            Instagram no permite pre-llenar el mensaje desde un link, asi que copia el texto y
            pegalo dentro del DM al abrirlo.
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
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Evaluacion Mystery Shopper</h1>

      <ol className="mt-6 flex gap-4 text-xs text-stone-500">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={i === step ? "font-semibold text-brand-600" : ""}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="mt-8 space-y-4">
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
          <Field label="Direccion (opcional)">
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
          <StepNav
            onNext={() => setStep(1)}
            nextDisabled={!business.name.trim()}
          />
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 space-y-6">
          {RATING_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <p className="text-sm font-medium text-ink">{cat.label}</p>
              <p className="text-xs text-stone-500">{cat.helpText}</p>
              <div className="mt-2">
                <ScoreSelector
                  value={ratings[cat.key] || 0}
                  onChange={(v) => setRatings((prev) => ({ ...prev, [cat.key]: v }))}
                />
              </div>
            </div>
          ))}
          <StepNav
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            nextDisabled={!ratingsComplete}
          />
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-4">
          {FLAG_QUESTIONS.map((f) => (
            <label
              key={f.key}
              className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-3"
            >
              <span className="text-sm text-ink">{f.label}</span>
              <input
                type="checkbox"
                checked={Boolean(flags[f.key])}
                onChange={(e) =>
                  setFlags((prev) => ({ ...prev, [f.key]: e.target.checked }))
                }
                className="h-5 w-5"
              />
            </label>
          ))}
          <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="mt-8 space-y-4">
          <div className="rounded-md border border-stone-200 bg-white p-4 text-sm">
            <p className="font-medium text-ink">{business.name}</p>
            <p className="text-stone-500">
              {business.city || "Sin ciudad"} - @{business.instagramHandle || "sin instagram"}
            </p>
            <p className="mt-2 text-stone-600">
              {RATING_CATEGORIES.length} categorias calificadas
            </p>
          </div>
          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          <StepNav
            onBack={() => setStep(2)}
            onNext={handleSubmit}
            nextLabel={submitting ? "Guardando..." : "Enviar evaluacion"}
            nextDisabled={submitting}
          />
        </div>
      )}
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

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex justify-between pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          Atras
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}
