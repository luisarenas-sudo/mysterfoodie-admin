"use client";

import { useState } from "react";
import type { Automation } from "@/lib/automations";

const ACCENT = "#F24444";

const AUTOMATION_LABELS: Record<string, { title: string; desc: string }> = {
  asesoria_gratuita: {
    title: "Asesoría gratuita (correo al día siguiente)",
    desc: "Se manda a las 8am (CDMX) del día después de la visita, ofreciendo 20 min gratis para hablar del negocio.",
  },
};

function AutomationCard({ automation }: { automation: Automation }) {
  const [enabled, setEnabled] = useState(automation.enabled);
  const [subject, setSubject] = useState(automation.subjectTemplate);
  const [body, setBody] = useState(automation.bodyTemplate);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = AUTOMATION_LABELS[automation.key] ?? { title: automation.key, desc: "" };
  const dirty = enabled !== automation.enabled || subject !== automation.subjectTemplate || body !== automation.bodyTemplate;

  async function save(patch: { enabled?: boolean; subjectTemplate?: string; bodyTemplate?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: automation.key, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await save({ enabled: next });
  }

  return (
    <div className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-bold">{label.title}</p>
          <p className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            {label.desc}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={saving}
          className="flex-shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
          style={
            enabled
              ? { background: "rgba(52,199,89,0.14)", color: "#2E9E4F" }
              : { background: "#F2F2F7", color: "rgba(60,60,67,0.6)" }
          }
        >
          {enabled ? "Activa" : "Desactivada"}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
          Asunto
        </span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
          Cuerpo del correo
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="input mt-1 font-mono text-[13px]"
        />
        <span className="mt-1 block text-[11.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
          Variables disponibles: {"{{negocio}}"}
        </span>
      </label>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => save({ subjectTemplate: subject, bodyTemplate: body })}
          className="rounded-md px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {savedAt && !dirty && (
          <span className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
            Guardado
          </span>
        )}
      </div>
    </div>
  );
}

function GoogleCalendarCard({
  connected: initialConnected,
  email: initialEmail,
}: {
  connected: boolean;
  email: string | null;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [email, setEmail] = useState(initialEmail);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/google", { method: "DELETE" });
      if (res.ok) {
        setConnected(false);
        setEmail(null);
      }
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="card mt-4 p-5">
      <p className="text-[15px] font-bold">Google Calendar</p>
      <p className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
        Se usa para ofrecer horarios de agenda solo dentro de los bloques &quot;Face2Face&quot; de tu
        calendario, y para crear el evento automáticamente cuando alguien agenda.
      </p>

      <div className="mt-3 flex items-center gap-3">
        {connected ? (
          <>
            <span
              className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
              style={{ background: "rgba(52,199,89,0.14)", color: "#2E9E4F" }}
            >
              Conectado{email ? ` · ${email}` : ""}
            </span>
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="text-[13px] font-semibold disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </>
        ) : (
          <a
            href="/api/integrations/google/start"
            className="rounded-md px-4 py-2 text-[13.5px] font-semibold text-white"
            style={{ background: ACCENT }}
          >
            Conectar Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}

export default function AutomatizacionesPanel({
  automations,
  calendar,
}: {
  automations: Automation[];
  calendar: { connected: boolean; email: string | null };
}) {
  return (
    <div className="mt-2">
      <GoogleCalendarCard connected={calendar.connected} email={calendar.email} />
      {automations.map((a) => (
        <AutomationCard key={a.key} automation={a} />
      ))}
      {automations.length === 0 && (
        <p className="mt-4 text-[13px]" style={{ color: "rgba(60,60,67,0.5)" }}>
          No hay automatizaciones configuradas todavía.
        </p>
      )}
    </div>
  );
}
