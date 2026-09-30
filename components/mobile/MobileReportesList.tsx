import Link from "next/link";
import { avatarColorFor, initialsFor } from "@/lib/ring";
import { getVerdict } from "@/lib/verdict";

type ReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  overallScore: number;
  createdAt: string;
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export default function MobileReportesList({ visits }: { visits: ReportRow[] }) {
  return (
    <div className="md:hidden min-h-[70vh]" style={{ background: "#F2F2F7" }}>
      <div className="px-5 pb-3.5 pt-5">
        <div className="mb-0.5 text-[10px] font-bold tracking-[1.1px]" style={{ color: "#F24444" }}>
          MYSTERFOODIE
        </div>
        <div className="heading text-[34px] font-bold">Reportes</div>
      </div>

      {visits.length === 0 ? (
        <p className="mx-5 text-sm" style={{ color: "rgba(60,60,67,0.55)" }}>
          Aún no hay evaluaciones registradas.
        </p>
      ) : (
        <div className="card mx-5 overflow-hidden">
          {visits.map((r, idx) => {
            const verdict = getVerdict(r.overallScore);
            return (
              <div key={r.id}>
                <Link href={`/visitas/${r.id}`} className="flex items-center gap-3 px-4 py-[13px]">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                    style={{ background: avatarColorFor(r.clientName) }}
                  >
                    {initialsFor(r.clientName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{r.clientName}</div>
                    <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                      {formatShortDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold" style={{ color: verdict.color }}>
                      {r.overallScore}
                    </div>
                    <div
                      className="mt-0.5 inline-block rounded-lg px-[7px] py-[2px] text-[10.5px] font-bold"
                      style={{ color: verdict.color, background: `${verdict.color}1F` }}
                    >
                      {verdict.label}
                    </div>
                  </div>
                </Link>
                {idx < visits.length - 1 && (
                  <div className="ml-[68px] h-px" style={{ background: "rgba(60,60,67,0.08)" }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
