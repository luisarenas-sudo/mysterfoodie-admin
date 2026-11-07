import { Pix } from "@/components/ui/Pix";
import Link from "next/link";
import type { HomeSummary, ReyNegocio } from "@/lib/dashboard";
import Avatar from "@/components/Avatar";
import MobileBrandMark from "@/components/mobile/MobileBrandMark";
import PendientesPanel from "@/components/PendientesPanel";
import type { HomeAlert } from "@/lib/alerts";

export default function MobileHome({
  displayName,
  avatarUrl,
  stats,
  rey,
  alerts = [],
  insights = null,
}: {
  displayName: string;
  avatarUrl?: string | null;
  stats: HomeSummary;
  rey: ReyNegocio;
  /** Pendientes del usuario (ya filtrados: sin los que cerró). */
  alerts?: HomeAlert[];
  /** Estadísticas del Inicio (gráficas, rachas, palabras...), ya armadas por el servidor. */
  insights?: React.ReactNode;
}) {
  const promedioLabel = stats.promedioGeneral !== null ? String(stats.promedioGeneral) : "—";
  const promedioColor =
    stats.promedioGeneral !== null && stats.promedioGeneral >= 4
      ? "#34C759"
      : stats.promedioGeneral !== null && stats.promedioGeneral >= 3
      ? "#FF9F0A"
      : "#1C1C1E";

  return (
    <div className="md:hidden min-h-[70vh]" style={{ background: "#F2F2F7" }}>
      <div className="px-5 pt-5 pb-2">
        <MobileBrandMark />
        <div className="flex items-center justify-between">
          <div className="heading text-[34px] font-bold">Inicio</div>
          <Link href="/perfil">
            <Avatar displayName={displayName} avatarUrl={avatarUrl} />
          </Link>
        </div>
      </div>

      <PendientesPanel alerts={alerts} />

      <div className="flex gap-3 px-5 pt-3.5">
        <div className="card flex-1 p-4">
          <div className="text-[28px] font-bold">{stats.visitasMes}</div>
          <div className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            Visitas este mes
          </div>
        </div>
        <div className="card flex-1 p-4">
          <div className="text-[28px] font-bold" style={{ color: promedioColor }}>
            {promedioLabel}
          </div>
          <div className="mt-0.5 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            Promedio general
          </div>
        </div>
      </div>

      {rey && (
        <Link
          href={`/negocios/${rey.id}`}
          className="mx-5 mt-2.5 flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5"
          style={{ background: "rgba(255,204,0,0.12)" }}
        >
          <div><Pix e="👑" size={24} /></div>
          <div className="text-[13px] font-semibold" style={{ color: "#1C1C1E" }}>
            El Rey: {rey.nombre} — {rey.scoreLabel}/5
          </div>
        </Link>
      )}

      <div className="px-5 pb-2 pt-6 text-xl font-bold">Actividad reciente</div>
      {stats.actividadReciente.length === 0 ? (
        <p className="mx-5 text-sm" style={{ color: "rgba(60,60,67,0.55)" }}>
          Aún no hay visitas registradas.
        </p>
      ) : (
        <div className="card mx-5 overflow-hidden">
          {stats.actividadReciente.map((r, idx) => (
            <div key={r.id}>
              <Link href={`/negocios/${r.negocioId}`} className="flex items-center gap-3 px-4 py-[13px]">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                  style={{ background: r.avatarColor }}
                >
                  {r.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{r.negocioNombre}</div>
                  {r.creatorLabel && (
                    <div className="truncate text-[12px] font-medium" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {r.creatorLabel}
                    </div>
                  )}
                  <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                    {r.fecha}
                  </div>
                </div>
                <div
                  className="flex w-[78px] flex-shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center"
                  style={{ color: r.verdictColor, background: `${r.verdictColor}1F` }}
                >
                  <div className="text-[26px] font-extrabold leading-none">{r.score}</div>
                  <div className="mt-1 text-[12px] font-bold leading-none">{r.verdictLabel}</div>
                </div>
              </Link>
              {idx < stats.actividadReciente.length - 1 && (
                <div className="ml-[68px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
              )}
            </div>
          ))}
        </div>
      )}

      {stats.negociosRecientes.length > 0 && (
        <>
          <div className="px-5 pb-2 pt-6 text-xl font-bold">Últimos negocios añadidos</div>
          <div className="card mx-5 mb-5 overflow-hidden">
            {stats.negociosRecientes.map((n, idx) => (
              <div key={n.id}>
                <Link href={`/negocios/${n.id}`} className="flex items-center gap-3 px-4 py-[13px]">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                    style={{ background: n.avatarColor }}
                  >
                    {n.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{n.nombre}</div>
                    <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {n.fecha}
                    </div>
                    {n.creatorLabel && (
                      <div className="truncate text-[11.5px]" style={{ color: "rgba(60,60,67,0.4)" }}>
                        Añadido por: {n.creatorLabel}
                      </div>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ opacity: 0.28 }} className="flex-shrink-0">
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="#000"
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                {idx < stats.negociosRecientes.length - 1 && (
                  <div className="ml-[68px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {insights}
    </div>
  );
}
