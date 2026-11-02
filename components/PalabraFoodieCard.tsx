import type { ReactNode } from "react";
import { PALABRA_FOODIE_QUOTE } from "@/lib/brand";

/**
 * "Palabra MysterFoodie": tarjeta oscura, centrada (escudo, título y frase). Es EL formato de la marca para esta
 * garantía: Perfil, el reporte público, los correos (lib/email.ts) y el PDF (lib/reportPdf.ts) lo repiten igual.
 * `children` = texto de apoyo opcional debajo de la frase (por ejemplo, el párrafo de confianza del reporte).
 */
export default function PalabraFoodieCard({ className = "mx-5 mt-5", children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`rounded-[18px] p-5 text-center ${className}`} style={{ background: "#1C1C1E" }}>
      <div className="mb-3 flex flex-col items-center gap-2">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(242,68,68,0.18)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" fill="#F24444" />
            <path d="M9 12.5l2 2 4-4.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="heading text-[21px] font-bold uppercase tracking-wide text-white">Palabra MysterFoodie</div>
      </div>
      <div className="mx-auto text-[14.5px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.85)", maxWidth: "80%" }}>
        &ldquo;{PALABRA_FOODIE_QUOTE}&rdquo;
      </div>
      {children && (
        <div className="mx-auto mt-3 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "85%" }}>
          {children}
        </div>
      )}
    </div>
  );
}
