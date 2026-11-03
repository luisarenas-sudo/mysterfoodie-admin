"use client";

import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/friendlyError";

export type EmailInfo = { status: string; error?: string | null; to?: string | null; expected?: number };

/**
 * Al guardar una visita los correos salen en segundo plano ("queued"): este hook consulta
 * /api/forms/[formId]/email-status cada 2 s (hasta ~40 s) y devuelve el estado final.
 * `waiting` es true mientras sigue en camino; `slow` si pasó el tiempo y aún no se confirma.
 */
export function useEmailStatus(formId: string, initial: EmailInfo | null) {
  const [status, setStatus] = useState<EmailInfo | null>(initial);
  const [slow, setSlow] = useState(false);
  const queued = status?.status === "queued";
  const expected = status?.expected ?? initial?.expected ?? 1;

  useEffect(() => {
    if (!queued) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const res = await fetch(`/api/forms/${formId}/email-status?expected=${expected}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.status !== "queued") {
            setStatus({ status: data.status, error: data.error, to: data.to });
            return;
          }
        }
      } catch {
        // sin señal un momento: se vuelve a intentar
      }
      if (tries >= 20) {
        if (!cancelled) setSlow(true);
        return;
      }
      setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [queued, formId, expected]);

  return { status, setStatus, waiting: queued && !slow, slow };
}

/**
 * Estado del correo automático (enviado / falló / no se envió) más los
 * controles para reenviarlo o mandarlo a otro correo. Se usa tanto en
 * la pantalla de confirmación justo después de guardar una visita
 * (app/page.tsx) como al entrar a una evaluación ya guardada
 * (app/visitas/[formId]), sobre el mismo endpoint genérico
 * /api/forms/[formId]/email.
 */
export default function EmailStatusPanel({
  formId,
  initialStatus,
}: {
  formId: string;
  initialStatus: EmailInfo | null;
}) {
  const { status: emailStatus, setStatus: setEmailStatus, waiting, slow } = useEmailStatus(formId, initialStatus);
  const [emailBusy, setEmailBusy] = useState<"resend" | "alt" | null>(null);
  const [emailActionError, setEmailActionError] = useState<string | null>(null);
  const [showAltEmail, setShowAltEmail] = useState(false);
  const [altEmail, setAltEmail] = useState("");

  async function sendReportEmail(overrideTo?: string) {
    setEmailActionError(null);
    setEmailBusy(overrideTo ? "alt" : "resend");
    try {
      const res = await fetch(`/api/forms/${formId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrideTo ? { to: overrideTo } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailActionError(data.error || "No se pudo enviar el correo");
        return;
      }
      setEmailStatus({ ...data.email, to: data.recipientEmail });
      if (overrideTo) {
        setShowAltEmail(false);
        setAltEmail("");
      }
    } catch (err) {
      setEmailActionError(friendlyError(err));
    } finally {
      setEmailBusy(null);
    }
  }

  const info = emailStatus;
  const infoStatus = info?.status;
  const sentTo = info?.to;

  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-stone-700">Correo automático</p>

      <div className="mt-3 flex items-center gap-3">
        {infoStatus === "sent" ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 flex-shrink-0 text-status-excellent">
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
            <path
              d="M8 12.5l2.5 2.5L16 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : infoStatus === "failed" ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 flex-shrink-0 text-status-critical">
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
            <path
              d="M9 9l6 6M15 9l-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 flex-shrink-0 text-status-good">
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
            <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16.2" r="1.1" fill="currentColor" />
          </svg>
        )}
        <div>
          <p className="text-sm text-stone-600">
            {waiting && "Enviando el correo…"}
            {slow && infoStatus === "queued" && "Sigue en camino. Si no llega en unos minutos, reenvíalo desde aquí."}
            {infoStatus === "sent" && "Enviado correctamente."}
            {infoStatus === "skipped_no_api_key" && "No se envió: falta configurar RESEND_API_KEY."}
            {infoStatus === "failed" && `Falló el envío: ${info?.error}`}
            {infoStatus === "skipped_no_email" && "No se envió: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado."}
            {!info && "No se envió: el negocio no tiene correo registrado ni hay ADMIN_EMAIL configurado."}
          </p>
          {sentTo ? <p className="mt-0.5 text-xs text-stone-400">{infoStatus === "sent" ? "Enviado a" : "Para"} {sentTo}</p> : null}
        </div>
      </div>

      {emailActionError ? <p className="mt-2 text-xs text-status-critical">{emailActionError}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => sendReportEmail()}
          disabled={emailBusy !== null || waiting}
          className="btn-primary flex-1 text-sm"
        >
          {emailBusy === "resend" ? "Reenviando..." : "Reenviar"}
        </button>
        <button
          type="button"
          onClick={() => setShowAltEmail((v) => !v)}
          disabled={emailBusy !== null}
          className="btn-secondary flex-1 text-sm"
        >
          Enviar a otro correo
        </button>
      </div>

      {showAltEmail ? (
        <div className="mf-reveal mt-3 flex items-center gap-2">
          <input
            type="email"
            value={altEmail}
            onChange={(e) => setAltEmail(e.target.value)}
            placeholder="otro-correo@ejemplo.com"
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => sendReportEmail(altEmail.trim())}
            disabled={emailBusy !== null || !altEmail.trim()}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {emailBusy === "alt" ? "Enviando..." : "Enviar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
