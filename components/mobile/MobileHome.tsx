import Link from "next/link";
import type { HomeSummary, ReyNegocio } from "@/lib/dashboard";
import Avatar from "@/components/Avatar";

export default function MobileHome({
  displayName,
  avatarUrl,
  stats,
  rey,
}: {
  displayName: string;
  avatarUrl?: string | null;
  stats: HomeSummary;
  rey: ReyNegocio;
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
        <div className="mb-1 flex items-center gap-[5px]">
          <div className="text-[11px] font-bold tracking-[1.2px]" style={{ color: "#F24444" }}>
            MYSTERFOODIE
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="heading text-[34px] font-bold">Inicio</div>
          <Link href="/perfil">
            <Avatar displayName={displayName} avatarUrl={avatarUrl} />
          </Link>
        </div>
      </div>

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
          <div className="text-xl">👑</div>
          <div className="text-[13px] font-semibold" style={{ color: "#1C1C1E" }}>
            El Rey: {rey.nombre} — {rey.scoreLabel}/5
          </div>
        </Link>
      )}

      <div className="px-5 pt-4">
        <Link
          href="/nueva-visita"
          className="flex items-center justify-between rounded-[18px] px-5 py-[18px]"
          style={{
            background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)",
            boxShadow: "0 6px 16px rgba(242,68,68,0.28)",
          }}
        >
          <div>
            <div className="text-[17px] font-bold text-white">Nueva visita</div>
            <div className="mt-0.5 text-[13px] text-white/85">Levanta una evaluación ahora</div>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

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
                <div className="w-[76px] flex-shrink-0 text-right">
                  <div className="text-[18px] font-bold leading-none" style={{ color: r.verdictColor }}>
                    {r.score}
                  </div>
                  <div
                    className="mt-1.5 inline-block w-full rounded-lg px-[7px] py-[3px] text-center text-[12px] font-bold"
                    style={{ color: r.verdictColor, background: `${r.verdictColor}1F` }}
                  >
                    {r.verdictLabel}
                  </div>
                </div>
              </Link>
              {idx < stats.actividadReciente.length - 1 && (
                <div className="ml-[68px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
