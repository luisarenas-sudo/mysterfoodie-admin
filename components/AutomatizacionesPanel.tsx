"use client";

import { useRef, useState } from "react";
import type { Automation } from "@/lib/automations";
import { AUTOMATION_CATALOG } from "@/lib/automations";

const ACCENT = "#F24444";

function TagBox({
  tags,
  onInsert,
}: {
  tags: { tag: string; desc: string }[];
  onInsert: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-2">
      <span className="text-[11.5px] font-medium" style={{ color: "rgba(60,60,67,0.6)" }}>
        Variables disponibles (toca una para insertarla donde esté el cursor):
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => onInsert(t.tag)}
            title={t.desc}
            className="rounded-full px-2.5 py-1 font-mono text-[11.5px] font-semibold"
            style={{ background: "rgba(242,68,68,0.08)", color: ACCENT }}
          >
            {`{{${t.tag}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function AutomationCard({ automation }: { automation: Automation }) {
  const [enabled, setEnabled] = useState(automation.enabled);
  const [subject, setSubject] = useState(automation.subjectTemplate);
  const [body, setBody] = useState(automation.bodyTemplate);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const catalog = AUTOMATION_CATALOG[automation.key] ?? { title: automation.key, desc: "", tags: [] };
  const hasSubject = catalog.hasSubject !== false;
  const enabledLabel = catalog.enabledLabel ?? { on: "Activa", off: "Desactivada" };
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

  function insertTag(tag: string) {
    const insertText = `{{${tag}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + insertText);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + insertText + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertText.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-bold">{catalog.title}</p>
          <p className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            {catalog.desc}
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
          {enabled ? enabledLabel.on : enabledLabel.off}
        </button>
      </div>

      {hasSubject && (
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
      )}

      <label className="mt-3 block">
        <span className="text-[12.5px] font-medium" style={{ color: "rgba(60,60,67,0.7)" }}>
          {hasSubject ? "Cuerpo del correo" : "Texto del mensaje"}
        </span>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="input mt-1 font-mono text-[13px]"
        />
      </label>

      <TagBox tags={catalog.tags} onInsert={insertTag} />

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
