"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/categories";

const ACCENT = "#F24444";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 16, // >=16px evita el zoom automático de iOS Safari al enfocar
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="mf-tap -m-2 p-2"
      style={{ flexShrink: 0 }}
    >
      <div
        style={{
          width: 51,
          height: 31,
          borderRadius: 16,
          background: value ? "#34C759" : "rgba(120,120,128,0.32)",
          position: "relative",
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
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  last,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3"
      style={!last ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
    >
      <div className="min-w-0">
        <div className="text-[14.5px] font-medium">{label}</div>
        {desc && (
          <div className="mt-0.5 text-[12px]" style={{ color: "rgba(60,60,67,0.5)" }}>
            {desc}
          </div>
        )}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

const OPPORTUNITY_ITEMS = [
  { key: "hasWebsite", label: "¿Tiene página web?" },
  { key: "hasGoogleBusiness", label: "¿Tiene Google Mi Negocio?" },
  { key: "hasProfessionalPhotos", label: "¿Fotos de producto profesionales?" },
  { key: "hasReels", label: "¿Tiene reels comerciales?" },
] as const;

type OpportunityKey = (typeof OPPORTUNITY_ITEMS)[number]["key"];

export default function MobileNuevoNegocio() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState(BUSINESS_TYPES[0].value);
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [email, setEmail] = useState("");
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  const [opportunities, setOpportunities] = useState<Record<OpportunityKey, boolean>>({
    hasWebsite: false,
    hasGoogleBusiness: false,
    hasProfessionalPhotos: false,
    hasReels: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string } | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Falta el nombre del negocio");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          city,
          contactName,
          phone,
          instagramHandle,
          email,
          autoEmailEnabled,
          ...opportunities,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar el negocio");
        setSubmitting(false);
        return;
      }
      // Solo confirmamos el alta -- no se obliga a asignar el negocio a un
      // Foodie aquí; eso es un paso aparte y opcional desde el detalle del
      // negocio (ver "Asignar a un Foodie" en MobileNegocioDetail).
      setCreated({ id: data.id });
    } catch {
      setError("Error de conexión, intenta de nuevo");
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="md:hidden fixed inset-0 z-40 flex flex-col items-center justify-center mf-push-in px-8 text-center" style={{ background: "#F2F2F7" }}>
        <svg width="56" height="56" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#34C759" />
          <path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="heading mt-3 text-[20px] font-bold">Negocio añadido</div>
        <div className="mt-1 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          {name} ya está dado de alta.
        </div>

        <div className="mt-8 w-full space-y-2.5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mf-tap w-full rounded-2xl py-3.5 text-center text-[16px] font-bold text-white"
            style={{ background: ACCENT }}
          >
            Listo
          </button>
          <Link
            href={`/negocios/${created.id}`}
            className="mf-tap block w-full rounded-2xl py-3.5 text-center text-[15px] font-semibold"
            style={{ color: "rgba(60,60,67,0.6)" }}
          >
            Ver negocio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col mf-push-in" style={{ background: "#F2F2F7" }}>
      <div
        className="flex flex-shrink-0 items-center justify-between px-4 pb-2.5 pt-3.5"
        style={{
          background: "rgba(249,249,251,0.95)",
          borderBottom: "1px solid rgba(60,60,67,0.1)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <Link
          href="/negocios"
          className="mf-tap -my-3 -ml-2 py-3 pl-2 pr-3 text-[16px]"
          style={{ color: ACCENT }}
        >
          Cancelar
        </Link>
        <div className="flex-1 truncate text-center text-[16px] font-bold">Nuevo negocio</div>
        <div className="w-[70px] flex-shrink-0" />
      </div>

      <div className="mf-scroll flex-1 overflow-y-auto px-5 pb-6 pt-[18px]">
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
          Datos del negocio
        </div>
        <div className="space-y-3.5">
          <Field label="Nombre del negocio">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Ej. Cocina de Mar"
              type="text"
              autoComplete="organization"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Tipo de negocio">
            <div className="flex flex-wrap gap-2">
              {BUSINESS_TYPES.map((t) => {
                const active = t.value === type;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className="mf-tap rounded-full px-4 py-2 text-[14px] font-semibold"
                    style={{
                      background: active ? ACCENT : "#fff",
                      color: active ? "#fff" : "rgba(60,60,67,0.7)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Ciudad">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={inputStyle}
              type="text"
              autoComplete="address-level2"
              enterKeyHint="next"
            />
          </Field>
        </div>

        <div className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
          Contacto
        </div>
        <div className="space-y-3.5">
          <Field label="Nombre de contacto">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              style={inputStyle}
              type="text"
              autoComplete="name"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Usuario de Instagram del negocio (sin @)">
            <input
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              style={inputStyle}
              placeholder="Ej. cocinademar"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Correo del negocio (opcional)">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              placeholder="contacto@negocio.com"
              enterKeyHint="done"
            />
          </Field>
        </div>

        <div className="card mt-5 px-4">
          <ToggleRow
            label="Correo automático"
            desc="Enviar el reporte al negocio por correo después de cada visita"
            value={autoEmailEnabled}
            onChange={setAutoEmailEnabled}
            last
          />
        </div>

        <div className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
          Oportunidades de venta
        </div>
        <div className="card px-4">
          {OPPORTUNITY_ITEMS.map((item, idx) => (
            <ToggleRow
              key={item.key}
              label={item.label}
              value={opportunities[item.key]}
              onChange={(v) => setOpportunities((prev) => ({ ...prev, [item.key]: v }))}
              last={idx === OPPORTUNITY_ITEMS.length - 1}
            />
          ))}
        </div>

        {error && <p className="mt-4 text-[13.5px] text-red-600">{error}</p>}
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
          onClick={handleSubmit}
          disabled={submitting}
          className="mf-tap w-full rounded-2xl py-3.5 text-center text-[16px] font-bold text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {submitting ? "Guardando..." : "Guardar negocio"}
        </button>
      </div>
    </div>
  );
}
