import Link from "next/link";
import type { BuyableProfile } from "@/lib/profilePurchases";
import { MYSTERFOODIE_PROFILE_PRICE_MXN } from "@/lib/mysterfoodieProfile";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });

/** "Conoce a tus MysterFoodies": perfiles anónimos que el negocio puede comprar (visitas con reporte desbloqueado). */
export default function MysterfoodieProfilesCard({ profiles, className = "" }: { profiles: BuyableProfile[]; className?: string }) {
  if (profiles.length === 0) return null;
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        Conoce a tus MysterFoodies
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-stone-500">
        Perfil anónimo de quien te visitó: sus palabras, gustos, con quién sale, cuánto consume y de qué sector viene.
        ${MYSTERFOODIE_PROFILE_PRICE_MXN} MXN + IVA por perfil, pago único.
      </p>
      <div className="mt-3 divide-y" style={{ borderColor: "rgba(60,60,67,0.08)" }}>
        {profiles.map((p) => (
          <Link key={p.mysterfoodieId} href={`/mi-negocio/mysterfoodie/${p.formId}`} className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-[15px] font-bold">{p.alias}</div>
              <div className="text-[12px] text-stone-500">
                {p.rankLabel} · visita del {fmt(p.visitDate)}
              </div>
            </div>
            <span className="text-[12.5px] font-bold" style={{ color: p.purchased ? "#1E8E4E" : "#F24444" }}>
              {p.purchased ? "Ver perfil" : "Comprar"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
