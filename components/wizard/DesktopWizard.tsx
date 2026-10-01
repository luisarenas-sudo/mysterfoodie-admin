"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScoreSelector from "@/components/ScoreSelector";
import BooleanToggle from "@/components/BooleanToggle";
import SelectChips from "@/components/SelectChips";
import EmailStatusPanel from "@/components/EmailStatusPanel";
import {
  CATEGORIES,
  BUSINESS_TYPES,
  groupCategoryItems,
  type Category,
  type CategoryItem,
} from "@/lib/categories";

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

export default function DesktopWizard({ boundAssignment }: { boundAssignment?: BoundAssignment } = {}) {
  const router = useRouter();
  const steps = boundAssignment ? STEPS.filter((s) => s.kind !== "business") : STEPS;
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<Business>(
    boundAssignment ? businessFromAssignment(boundAssignment) : EMPTY_BUSINESS
  );
  const [shopperName, setShopperName] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const current = steps[step];
  const progressPct = Math.round((step / (steps.length - 1)) * 100);

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

  function goBack() {
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
    if (boundAssignment?.assignmentId) {
      router.push("/nueva-visita");
    } else if (boundAssignment) {
      router.push(`/negocios/${boundAssignment.client.id}`);
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
    setWaiterName("");
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
              <div key={c.key} className="card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{c.average}</p>
                <p className="text-xs text-stone-400">de 5</p>
              </div>
            ))}
        </div>

        <div className="mt-6">
          <EmailStatusPanel formId={result.formId} initialStatus={result.email} />
        </div>

        <div className="mt-4 card p-5">
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
              className="btn-primary text-sm"
            >
              {copied === "link" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="mt-4 card p-5">
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
              className="btn-primary text-sm"
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

        {boundAssignment ? (
          <button
            type="button"
            onClick={() => {
              if (boundAssignment.assignmentId) {
                router.push("/nueva-visita");
              } else {
                router.push(`/negocios/${boundAssignment.client.id}`);
              }
            }}
            className="mt-8 btn-primary text-sm"
          >
            Listo
          </button>
        ) : (
          <button
            type="button"
            onClick={resetAll}
            className="mt-8 btn-secondary text-sm"
          >
            Registrar otra visita
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Evaluación Mystery Shopper</h1>
      {boundAssignment && (
        <p className="mt-1 text-sm text-stone-500">Visitando: {boundAssignment.client.name}</p>
      )}

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
        <div className="mt-8 space-y-6">
          {groupCategoryItems(current.category.items).map((block, blockIdx) =>
            block.kind === "standalone" ? (
              <div
                key={`standalone-${blockIdx}`}
                className="grid grid-cols-1 gap-6 sm:grid-cols-2"
              >
                {block.items.map((item) => (
                  <ItemField
                    key={item.key}
                    item={item}
                    ratings={ratings}
                    flags={flags}
                    selects={selects}
                    setRatings={setRatings}
                    setFlags={setFlags}
                    setSelects={setSelects}
                  />
                ))}
              </div>
            ) : (
              <div
                key={`group-${block.group}-${blockIdx}`}
                className="rounded-lg border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {block.group}
                </p>
                <div className="mt-3 space-y-4">
                  {block.subBlocks.map((sub, subIdx) => (
                    <div key={`sub-${subIdx}`}>
                      {sub.subgroup && (
                        <p className="mb-2 border-t border-stone-200 pt-3 text-xs font-medium text-stone-500">
                          {sub.subgroup}
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {sub.items.map((item) => (
                          <ItemField
                            key={item.key}
                            item={item}
                            ratings={ratings}
                            flags={flags}
                            selects={selects}
                            setRatings={setRatings}
                            setFlags={setFlags}
                            setSelects={setSelects}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {current.kind === "comments" && (
        <div className="mt-8 max-w-xl space-y-6">
          <Field label="Nombre del mesero que te atendió (opcional)">
            <input
              value={waiterName}
              onChange={(e) => setWaiterName(e.target.value)}
              className="input"
              placeholder="Ej. Fermín"
            />
          </Field>
          <div className="space-y-2">
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
        </div>
      )}

      {current.kind === "review" && (
        <div className="mt-8 max-w-xl space-y-4">
          <div className="card p-4 text-sm">
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
            {waiterName.trim() && (
              <p className="mt-3 text-xs text-stone-500">Mesero: {waiterName.trim()}</p>
            )}
            {comments.trim() && (
              <p className="mt-1 text-xs text-stone-500">
                Comentarios: {comments.trim().slice(0, 140)}
                {comments.trim().length > 140 ? "…" : ""}
              </p>
            )}
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        </div>
      )}

      <div className="mt-8 flex max-w-xl justify-between">
        {step > 0 || boundAssignment ? (
          <button
            type="button"
            onClick={goBack}
            className="btn-secondary text-sm"
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

function ItemField({
  item,
  ratings,
  flags,
  selects,
  setRatings,
  setFlags,
  setSelects,
}: {
  item: CategoryItem;
  ratings: Record<string, number>;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  setRatings: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSelects: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div>
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
  );
}
