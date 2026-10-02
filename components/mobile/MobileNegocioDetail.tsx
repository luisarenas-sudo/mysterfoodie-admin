import Link from "next/link";
import type { ClientDetail, PendingAssignmentForClient } from "@/lib/dashboard";
import MobileSectionHeader from "./MobileSectionHeader";
import { getMonthlyTrend } from "@/lib/dashboard";
import { getVerdict } from "@/lib/verdict";
import { avatarColorFor, initialsFor, CATEGORY_EMOJI } from "@/lib/ring";
import ActivityRing from "./ActivityRing";
import OpportunityCopyButton from "./OpportunityCopyButton";
import DeleteButton from "@/components/DeleteButton";

type OpportunityDef = {
  key: "hasWebsite" | "hasGoogleBusiness" | "hasProfessionalPhotos" | "hasReels";
  emoji: string;
  title: string;
  desc: string;
  copyText: (name: string) => string;
};

const OPPORTUNITIES: OpportunityDef[] = [
  {
    key: "hasWebsite",
    emoji: "🌐",
    title: "Sin página web",
    desc: "Aún no tiene un sitio web propio.",
    copyText: (name) =>
      `Hola, equipo de ${name}. Notamos que aún no cuentan con una página web — podemos ayudarles a crear una sencilla para que más clientes los encuentren. ¿Les interesaría platicarlo?`,
  },
  {
    key: "hasGoogleBusiness",
    emoji: "📍",
    title: "Sin Google Mi Negocio",
    desc: "No tiene ficha en Google Mi Negocio.",
    copyText: (name) =>
      `Hola, equipo de ${name}. Vimos que aún no tienen su ficha de Google Mi Negocio configurada — les ayuda a aparecer en búsquedas y mapas. ¿Les interesaría que les ayudemos a crearla?`,
  },
  {
    key: "hasProfessionalPhotos",
    emoji: "📸",
    title: "Fotos de producto mejorables",
    desc: "No cuenta con fotos profesionales de sus platillos.",
    copyText: (name) =>
      `Hola, equipo de ${name}. Creemos que unas fotos profesionales de sus platillos podrían ayudarles mucho en redes y el menú digital. ¿Les gustaría que les cotizemos una sesión?`,
  },
  {
    key: "hasReels",
    emoji: "🎬",
    title: "Sin reels comerciales",
    desc: "No tiene contenido de video (reels) promocional.",
    copyText: (name) =>
      `Hola, equipo de ${name}. Los reels ayudan mucho a atraer clientes nuevos — ¿les interesaría que platiquemos sobre producir algunos para su negocio?`,
  },
];

const TYPE_LABEL: Record<string, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafeteria: "Cafetería",
};

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

function AssignedFoodieCard({ assignment }: { assignment: PendingAssignmentForClient }) {
  return (
    <div className="card mx-5 mt-4 flex items-center gap-3 px-4 py-3.5">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[15px]"
        style={{ background: "rgba(242,68,68,0.12)" }}
      >
        🌱
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
          Visita asignada a
        </div>
        <div className="truncate text-[14.5px] font-bold">
          {assignment.foodieName || assignment.foodieEmail}
        </div>
      </div>
      <div
        className="flex-shrink-0 rounded-lg px-2 py-[3px] text-[10px] font-bold"
        style={{ color: "#FF9500", background: "rgba(255,149,0,0.12)" }}
      >
        PENDIENTE
      </div>
    </div>
  );
}

export default function MobileNegocioDetail({
  client,
  canAssign = false,
  canDelete = false,
  canCreateVisit = true,
  backHref = "/negocios",
  backLabel = "Negocios",
  pendingAssignment = null,
}: {
  client: ClientDetail;
  canAssign?: boolean;
  canDelete?: boolean;
  /** false para el dueño del negocio (/mi-negocio): no le toca levantar visitas Mystery Shopper. */
  canCreateVisit?: boolean;
  /** null cuando esta pantalla no tiene a dónde "regresar" (ej. /mi-negocio, que ya es el nivel superior para ese rol) -- se muestra el nombre sin link. */
  backHref?: string | null;
  backLabel?: string;
  pendingAssignment?: PendingAssignmentForClient | null;
}) {
  const visits = client.visits;
  const hasVisits = visits.length > 0;
  const latest = hasVisits ? visits[visits.length - 1] : null;
  const previous = visits.length > 1 ? visits[visits.length - 2] : null;
  const verdict = latest ? getVerdict(latest.overallScore) : null;
  const avatarColor = avatarColorFor(client.name);

  const monthly = getMonthlyTrend(visits.map((v) => ({ createdAt: v.createdAt, overallScore: v.overallScore })));

  const categoryTrends =
    latest?.ratings.map((r) => {
      const prev = previous?.ratings.find((p) => p.key === r.key);
      const delta = prev ? Math.round((r.score - prev.score) * 10) / 10 : null;
      let arrow = "—";
      let arrowColor = "rgba(60,60,67,0.4)";
      if (delta !== null) {
        if (delta > 0) {
          arrow = "▲";
          arrowColor = "#34C759";
        } else if (delta < 0) {
          arrow = "▼";
          arrowColor = "#FF3B30";
        }
      }
      return { ...r, arrow, arrowColor, deltaLabel: delta !== null ? Math.abs(delta).toFixed(1) : "" };
    }) ?? [];

  return (
    <div className="md:hidden mf-push-in" style={{ background: "#F2F2F7", minHeight: "100vh" }}>
      <MobileSectionHeader backHref={backHref} backLabel={backLabel} />

      <div className="pb-6">
        <div className="flex flex-col items-center px-5 pb-2 pt-6 text-center">
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[26px] font-bold text-white"
            style={{ background: avatarColor }}
          >
            {initialsFor(client.name)}
          </div>
          <div className="mt-3 flex w-full items-center justify-center gap-[5px]">
            <div className="heading text-[22px] font-bold">{client.name}</div>
          </div>
          <div className="mt-0.5 text-sm" style={{ color: "rgba(60,60,67,0.6)" }}>
            {TYPE_LABEL[client.type] ?? "Negocio"}
            {client.city ? ` · ${client.city}` : ""}
          </div>
        </div>

        {hasVisits && latest && verdict ? (
          <>
            <div className="flex flex-col items-center pb-1.5 pt-3.5">
              <ActivityRing value={latest.overallScore} max={5} size={132} strokeWidth={12} color={verdict.color}>
                <div className="text-[30px] font-bold">{latest.overallScore}</div>
                <div className="text-[11px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                  de 5.0
                </div>
              </ActivityRing>
              <div
                className="mt-2 rounded-[10px] px-3 py-1 text-[13px] font-bold"
                style={{ color: verdict.color, background: `${verdict.color}1F` }}
              >
                {verdict.label}
              </div>
            </div>

            <div className="card mx-5 mt-[18px] p-4">
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-4">
                {latest.ratings.map((cs) => (
                  <div key={cs.key} className="flex items-center gap-2.5">
                    <ActivityRing value={cs.score} max={5} size={50} strokeWidth={6} color={getVerdict(cs.score).color} trackColor="rgba(60,60,67,0.1)">
                      <div className="text-[19px]">{CATEGORY_EMOJI[cs.key] ?? "⭐"}</div>
                    </ActivityRing>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold">{cs.label}</div>
                      <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                        {cs.score}/5
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="card mx-5 mt-4 p-5 text-center">
            <div className="text-[28px]">🆕</div>
            <div className="mt-1.5 text-[14.5px] font-bold">Aún sin visitas</div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Programa la primera evaluación Mystery Shopper para este negocio.
            </div>
          </div>
        )}

        {pendingAssignment && <AssignedFoodieCard assignment={pendingAssignment} />}

        {(canCreateVisit || canAssign) && (
          <div className="px-5 pt-4 space-y-2.5">
            {canCreateVisit && (
              <Link
                href={`/nueva-visita/negocio/${client.id}`}
                className="mf-tap block rounded-[14px] py-3.5 text-center text-[16px] font-bold text-white"
                style={{ background: "#F24444" }}
              >
                Nueva visita a este negocio
              </Link>
            )}
            {canAssign && (
              <Link
                href={`/negocios/${client.id}/asignar`}
                className="mf-tap block rounded-[14px] py-3.5 text-center text-[15px] font-bold"
                style={{ background: "#fff", color: "#F24444", border: "1.5px solid rgba(242,68,68,0.3)" }}
              >
                {pendingAssignment ? "Reasignar a otro Foodie" : "Asignar a un Foodie"}
              </Link>
            )}
          </div>
        )}

        {canDelete && (
          <div className="px-5">
            <DeleteButton
              variant="mobile"
              endpoint={`/api/clients/${client.id}`}
              confirmText={
                visits.length > 0
                  ? `¿Eliminar "${client.name}" y sus ${visits.length} visita${visits.length === 1 ? "" : "s"}? Esto no se puede deshacer.`
                  : `¿Eliminar "${client.name}"? Esto no se puede deshacer.`
              }
              redirectTo="/negocios"
              triggerLabel="Eliminar negocio"
            />
          </div>
        )}

        {monthly.length > 1 && (
          <>
            <div className="px-5 pb-2 pt-[22px] text-lg font-bold">Tendencia mensual</div>
            <div className="mx-5 mb-1 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
              Por mes
            </div>
            <div className="card mx-5 px-4">
              {monthly.map((m, idx) => (
                <div
                  key={m.mesLabel}
                  className="flex items-center justify-between py-2.5"
                  style={idx < monthly.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
                >
                  <div>
                    <div className="text-[14px] font-semibold">{m.mesLabel}</div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: "rgba(60,60,67,0.5)" }}>
                      {m.count} {m.count === 1 ? "visita" : "visitas"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-[15px] font-bold">{m.avgLabel}</div>
                    <div className="text-[13px] font-bold" style={{ color: m.arrowColor }}>
                      {m.arrow}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {previous && (
              <>
                <div className="mx-5 mb-1 mt-3.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
                  Por categoría (última vs. anterior)
                </div>
                <div className="card mx-5 px-4">
                  {categoryTrends.map((ct, idx) => (
                    <div
                      key={ct.key}
                      className="flex items-center gap-2.5 py-2.5"
                      style={idx < categoryTrends.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
                    >
                      <div className="flex-shrink-0 text-base">{CATEGORY_EMOJI[ct.key] ?? "⭐"}</div>
                      <div className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{ct.label}</div>
                      <div className="flex-shrink-0 text-[13.5px] font-bold">{ct.score}</div>
                      <div className="flex-shrink-0 text-right text-[12px] font-bold" style={{ color: ct.arrowColor, minWidth: 42 }}>
                        {ct.arrow} {ct.deltaLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {client.improvementKeywords.length > 0 && (
          <>
            <div className="px-5 pb-2 pt-[22px] text-lg font-bold">Aspectos a mejorar</div>
            <div className="card mx-5 flex flex-wrap gap-2 p-4">
              {client.improvementKeywords.map((k) => (
                <div
                  key={k.word}
                  className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: "rgba(242,68,68,0.08)", color: "#F24444" }}
                >
                  {k.word} ×{k.count}
                </div>
              ))}
            </div>
          </>
        )}

        {(() => {
          const pending = OPPORTUNITIES.filter((o) => !client[o.key]);
          if (pending.length === 0) return null;
          return (
            <>
              <div className="px-5 pb-2 pt-[22px] text-lg font-bold">Oportunidades detectadas</div>
              <div className="mx-5 space-y-2.5">
                {pending.map((o) => (
                  <div key={o.key} className="card flex items-start gap-3 p-4">
                    <div className="flex-shrink-0 text-[20px]">{o.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold">{o.title}</div>
                      <div className="mt-0.5 text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                        {o.desc}
                      </div>
                    </div>
                    <OpportunityCopyButton text={o.copyText(client.name)} />
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {hasVisits && (
          <>
            <div className="px-5 pb-2 pt-[22px] text-lg font-bold">Historial de visitas</div>
            <div className="card mx-5 overflow-hidden">
              {[...visits].reverse().map((v, idx, arr) => (
                <div key={v.id}>
                  <Link href={`/visitas/${v.id}`} className="flex items-center justify-between px-4 py-[13px]">
                    <div>
                      <div className="text-[14.5px]" style={{ color: "rgba(60,60,67,0.7)" }}>
                        {formatDateLong(v.createdAt)}
                      </div>
                      {v.shopperName && (
                        <div className="mt-0.5 text-[11.5px]" style={{ color: "rgba(60,60,67,0.45)" }}>
                          {v.shopperName}
                        </div>
                      )}
                    </div>
                    <div className="text-[15px] font-bold" style={{ color: getVerdict(v.overallScore).color }}>
                      {v.overallScore}
                    </div>
                  </Link>
                  {idx < arr.length - 1 && <div className="ml-4 h-px" style={{ background: "rgba(60,60,67,0.08)" }} />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
