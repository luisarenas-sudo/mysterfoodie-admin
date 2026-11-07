/**
 * Lo que comparten el asistente de escritorio y el del celular: tipos, borrador, valores iniciales y el envío de la visita.
 * Está aquí (una sola vez) para que un cambio, como Enviar GRATIS o un campo nuevo, no se tenga que repetir en dos archivos.
 */
import { commentPartsHaveContent } from "@/lib/visitComments";
import { friendlyError } from "@/lib/friendlyError";
import type { Stamps } from "./VisitContext";

export type Business = {
  name: string;
  type: string;
  contactName: string;
  phone: string;
  instagramHandle: string;
  email: string;
  address: string;
  city: string;
};

export const EMPTY_BUSINESS: Business = {
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

export function businessFromAssignment(a: BoundAssignment): Business {
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

export type WizardDraft = {
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
  /** Contexto de la visita (nov 2026): borradores anteriores no lo traen. */
  startedAt?: string;
  stamps?: Stamps;
  wouldReturn?: number | null;
  step: number;
  savedAt: number;
  /** Ruta de la visita y total de pasos: los usa Pendientes del Inicio para avisar y llevar de vuelta. */
  href?: string;
  totalSteps?: number;
};

export function draftHasContent(d: Pick<WizardDraft, "business" | "shopperName" | "ratings" | "flags" | "selects" | "comments" | "waiterName" | "na" | "tagsGood" | "tagsImprove" | "notes">) {
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

export type CategoryScoreResult = { key: string; label: string; average: number; count: number };
export type EmailOutcome = { status: string; error?: string; to?: string | null; expected?: number };
export type SubmitResult = {
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


/** Datos que el asistente reúne y que /api/visits necesita. */
export type VisitSubmitInput = {
  boundAssignment?: BoundAssignment;
  business: Business;
  shopperName: string;
  waiterName: string;
  ratings: Record<string, number>;
  flags: Record<string, boolean>;
  selects: Record<string, string>;
  /** Comentarios ya compuestos (composeComments). */
  finalComments: string;
  startedAt: string | null;
  stamps: Stamps;
  wouldReturn: number | null;
  freeDemo?: boolean;
  /** Dónde queda guardado el avance si no hay internet ("en este equipo" / "en este teléfono"). */
  device: "equipo" | "teléfono";
};

/** Guarda la visita. Mismo envío para escritorio y celular. */
export async function submitVisit(i: VisitSubmitInput): Promise<{ ok: true; data: SubmitResult } | { ok: false; error: string }> {
  try {
    const common = { shopperName: i.shopperName, ratings: i.ratings, flags: i.flags, selects: i.selects, comments: i.finalComments, waiterName: i.waiterName };
    const payload = i.boundAssignment
      ? i.boundAssignment.assignmentId
        ? { assignmentId: i.boundAssignment.assignmentId, ...common }
        : { clientId: i.boundAssignment.client.id, ...common }
      : { business: i.business, ...common };
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, startedAt: i.startedAt ?? undefined, stamps: i.stamps, wouldReturn: i.wouldReturn, ...(i.freeDemo ? { freeDemo: true } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "No se pudo guardar la evaluación" };
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: friendlyError(err, { offline: `Sin conexión. Tu avance está guardado en este ${i.device}: vuelve a intentar cuando tengas internet.` }),
    };
  }
}
