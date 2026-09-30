"use client";

import Link from "next/link";
import type { VisitFullDetail } from "@/lib/dashboard";
import { getVerdict } from "@/lib/verdict";
import { CATEGORY_EMOJI } from "@/lib/ring";
import ActivityRing from "./ActivityRing";
import EmailStatusPanel from "@/components/EmailStatusPanel";

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

export default function MobileVisitDetail({
  visit,
  backHref,
  backLabel,
}: {
  visit: VisitFullDetail;
  backHref: string;
  backLabel: string;
}) {
  const verdict = getVerdict(visit.overallScore);
  const mainCategories = visit.categoryScores.filter((c) => c.key !== "accesibilidad");
  const extraCategory = visit.categoryScores.find((c) => c.key === "accesibilidad");

  async function share() {
    const shareData = {
      title: `${visit.clientName} — ${visit.overallScore}/5`,
      text: `Reporte de ${visit.clientName}: ${visit.overallScore}/5`,
      url: visit.reportUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // usuario canceló, no hacer nada
      }
    } else {
      await navigator.clipboard.writeText(visit.reportUrl);
    }
  }

  return (
    <div className="md:hidden" style={{ background: "#F2F2F7", minHeight: "100vh" }}>
      <div
        className="flex items-center px-3 py-[14px]"
        style={{ background: "rgba(249,249,251,0.92)", borderBottom: "1px solid rgba(60,60,67,0.1)" }}
      >
        <Link href={backHref} className="-my-2.5 -ml-1 flex items-center gap-1 py-2.5 pl-2 pr-4" style={{ color: "#F24444" }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M15 6l-6 6 6 6" stroke="#F24444" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[16px]">{backLabel}</span>
        </Link>
      </div>

      <div className="px-5 pb-8">
        <div className="pt-6 text-center">
          <div className="heading text-[26px] font-bold">{visit.clientName}</div>
          <div className="mt-1 text-sm" style={{ color: "rgba(60,60,67,0.55)" }}>
            {formatDateLong(visit.createdAt)} &middot; {visit.shopperName ? visit.shopperName : "Tu visita"}
          </div>
        </div>

        <div className="flex flex-col items-center py-4">
          <ActivityRing value={visit.overallScore} max={5} size={140} strokeWidth={12} color={verdict.color}>
            <div className="text-[32px] font-bold">{visit.overallScore}</div>
          </ActivityRing>
          <div
            className="mt-2.5 rounded-[10px] px-3 py-1 text-[13px] font-bold"
            style={{ color: verdict.color, background: `${verdict.color}1F` }}
          >
            {verdict.label}
          </div>
          {visit.clientVisitCount > 1 && visit.clientAverageScore !== null && (
            <div className="mt-1.5 text-[11.5px]" style={{ color: "rgba(60,60,67,0.45)" }}>
              ★ Promedio global {visit.clientAverageScore} &middot; {visit.clientVisitCount}{" "}
              {visit.clientVisitCount === 1 ? "visita" : "visitas"}
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-4">
            {mainCategories.map((cs) => (
              <div key={cs.key} className="flex items-center gap-2.5">
                <ActivityRing value={cs.average} max={5} size={50} strokeWidth={6} color={verdict.color}>
                  <div className="text-[19px]">{CATEGORY_EMOJI[cs.key] ?? "⭐"}</div>
                </ActivityRing>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold">{cs.label}</div>
                  <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                    {cs.average}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {extraCategory && (
          <div className="card mt-2.5 flex items-center gap-3 p-3.5">
            <ActivityRing value={extraCategory.average} max={5} size={40} strokeWidth={6} color={verdict.color}>
              <div className="text-[15px]">{CATEGORY_EMOJI[extraCategory.key] ?? "⭐"}</div>
            </ActivityRing>
            <div className="flex-1">
              <div className="flex justify-between text-[13px]">
                <span className="font-medium">
                  {extraCategory.label} <span style={{ color: "rgba(60,60,67,0.45)", fontWeight: 400 }}>&middot; Extra</span>
                </span>
                <span style={{ color: "rgba(60,60,67,0.55)" }}>{extraCategory.average}</span>
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "rgba(60,60,67,0.45)" }}>
                No cuenta para el promedio general
              </div>
            </div>
          </div>
        )}

        {visit.comments && (
          <div className="card mt-3.5 p-4">
            <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
              Comentarios
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">{visit.comments}</p>
          </div>
        )}

        <div className="mt-3.5">
          <EmailStatusPanel
            formId={visit.id}
            initialStatus={
              visit.lastEmail
                ? { status: visit.lastEmail.status, error: visit.lastEmail.error, to: visit.lastEmail.recipientEmail }
                : null
            }
          />
        </div>

        <button
          type="button"
          onClick={share}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-bold text-white"
          style={{ background: "#F24444" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M12 3v12M12 3l-4 4M12 3l4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Compartir
        </button>
      </div>
    </div>
  );
}
