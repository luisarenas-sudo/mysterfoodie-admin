"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { HomeAlert, AlertTone } from "@/lib/alerts";
import { friendlyError } from "@/lib/friendlyError";
import { clearWizardDraft, listWizardDrafts } from "@/lib/wizardDraft";

const TONE: Record<AlertTone, { bg: string; dot: string }> = {
  urgent: { bg: "#FFE5E3", dot: "#FF3B30" },
  warn: { bg: "#FFF3D6", dot: "#FF9F0A" },
  info: { bg: "#E6F0FF", dot: "#0A84FF" },
  ok: { bg: "#E8F8EC", dot: "#34C759" },
};

const VISIBLE_DEFAULT = 3;
/** Un borrador más viejo que esto ya no avisa (sigue guardado, pero deja de estorbar). */
const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type PanelAlert = HomeAlert & { draftId?: string };

function ago(ts: number): string {
  const min = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/**
 * Evaluaciones a medias de este equipo: el wizard guarda un borrador en el navegador y aquí avisamos que hay algo
 * sin terminar (es el mismo borrador que ofrece «Recuperamos tu progreso de esta visita»).
 */
function useDraftAlerts(): [PanelAlert[], (draftId: string) => void] {
  const [drafts, setDrafts] = useState<PanelAlert[]>([]);
  const refresh = useCallback(() => {
    setDrafts(
      listWizardDrafts()
        .filter((d) => Date.now() - d.savedAt <= DRAFT_MAX_AGE_MS)
        .map((d) => ({
          key: `draft:${d.id}`,
          draftId: d.id,
          kind: "pendiente" as const,
          tone: "warn" as const,
          emoji: "📝",
          title: d.name ? `Evaluación sin terminar: ${d.name}` : "Tienes una evaluación sin terminar",
          detail: `${d.totalSteps ? `Vas en el paso ${d.step} de ${d.totalSteps} · ` : ""}guardada ${ago(d.savedAt)} · toca para retomarla`,
          href: d.href,
        }))
    );
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  const discard = useCallback(
    (draftId: string) => {
      clearWizardDraft(draftId);
      refresh();
    },
    [refresh]
  );
  return [drafts, discard];
}

/**
 * Pendientes del Inicio: visitas asignadas, cobros, tickets, compras, citas…
 * según el rol. Cada aviso se cierra con la X y desaparece al instante; lo
 * que sigue pendiente reaparece a las 24 h (ver lib/alerts.ts).
 */
export default function PendientesPanel({ alerts }: { alerts: HomeAlert[] }) {
  const [serverItems, setItems] = useState(alerts);
  const [draftItems, discardDraft] = useDraftAlerts();
  const items: PanelAlert[] = [...draftItems, ...serverItems];
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss(alert: PanelAlert) {
    setError(null);
    // Un borrador no es un aviso del servidor: cerrarlo borra el progreso guardado, así que se confirma.
    if (alert.draftId) {
      if (window.confirm("¿Descartar esta evaluación sin terminar? Se pierde el progreso guardado.")) discardDraft(alert.draftId);
      return;
    }
    setLeaving((prev) => new Set(prev).add(alert.key));
    // Se espera a que termine la animación de salida para quitarlo de la lista.
    window.setTimeout(() => setItems((prev) => prev.filter((a) => a.key !== alert.key)), 220);
    try {
      const res = await fetch("/api/alertas/descartar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: alert.key }),
      });
      if (!res.ok) throw new Error("fail");
    } catch (err) {
      // Si no se pudo guardar, el aviso vuelve (si no, reaparecería solo al recargar y confundiría).
      setItems((prev) => (prev.some((a) => a.key === alert.key) ? prev : [...prev, alert].sort((a, b) => alerts.indexOf(a) - alerts.indexOf(b))));
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(alert.key);
        return next;
      });
      setError(err instanceof TypeError ? friendlyError(err) : "No se pudo cerrar el aviso. Intenta de nuevo.");
    }
  }

  const shown = expanded ? items : items.slice(0, VISIBLE_DEFAULT);
  const hidden = items.length - shown.length;

  return (
    <section aria-label="Pendientes" className="px-5 pt-3.5 md:px-0">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[17px] font-bold">Pendientes</h2>
        {items.length > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[12px] font-bold text-white" style={{ background: "#F24444" }}>
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card flex items-center gap-2.5 px-4 py-3 text-[14px]" style={{ color: "rgba(60,60,67,0.7)" }}>
          <span aria-hidden>✅</span> Todo al día, nada pendiente por ahora.
        </div>
      ) : (
        <div className="card overflow-hidden">
          {shown.map((a, idx) => (
            <div
              key={a.key}
              className={leaving.has(a.key) ? "mf-alert-out" : undefined}
              style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}
            >
              <div className="flex items-stretch">
                <Link href={a.href} className="mf-tap flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[17px]"
                    style={{ background: TONE[a.tone].bg }}
                  >
                    {a.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold leading-snug">{a.title}</span>
                    {a.detail && (
                      <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>
                        {a.detail}
                      </span>
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(a)}
                  aria-label={`Cerrar aviso: ${a.title}`}
                  className="mf-tap flex w-11 flex-shrink-0 items-start justify-center pt-3.5"
                  style={{ color: "rgba(60,60,67,0.4)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {(hidden > 0 || expanded) && items.length > VISIBLE_DEFAULT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mf-tap block w-full px-4 py-2.5 text-center text-[13px] font-semibold text-brand-500"
              style={{ borderTop: "1px solid rgba(60,60,67,0.08)" }}
            >
              {expanded ? "Ver menos" : `Ver ${hidden} más`}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-[12.5px] font-semibold" style={{ color: "#FF3B30" }}>
          {error}
        </p>
      )}
    </section>
  );
}
