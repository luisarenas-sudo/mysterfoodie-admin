import Link from "next/link";
import type { BuyableProfile } from "@/lib/profilePurchases";
import { PixelBadge } from "@/components/ui/PixelBadge";
import { PERFIL_PITCH, PERFIL_PITCH_TITLE, PLATFORM_FEE_PCT, TIERS } from "@/lib/personaCatalog";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });

function action(p: BuyableProfile): { text: string; color: string } {
  if (p.owned === "passport") return { text: "Ver perfil", color: "#1E8E4E" };
  if (p.owned === "id") return { text: p.passportAvailable ? "Ver · mejorar a Passport" : "Ver perfil", color: "#1E8E4E" };
  return { text: "Destapar", color: "#F24444" };
}

/** "Destapa el perfil de tu MysterFoodie": perfiles anónimos que el negocio puede comprar (visitas con reporte desbloqueado). */
export default function MysterfoodieProfilesCard({ profiles, className = "" }: { profiles: BuyableProfile[]; className?: string }) {
  if (profiles.length === 0) return null;
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="heading text-[20px] leading-tight">{PERFIL_PITCH_TITLE}</h2>
      <p className="mt-1 text-[13px] leading-snug text-stone-500">{PERFIL_PITCH}</p>
      <p className="mt-2 text-[12.5px] font-semibold text-stone-600">
        ID ${TIERS.id.price} · Passport ${TIERS.passport.price} MXN + {PLATFORM_FEE_PCT}% de cargo por uso de la plataforma + IVA · pago único
      </p>
      <div className="mt-3 divide-y" style={{ borderColor: "rgba(60,60,67,0.08)" }}>
        {profiles.map((p) => {
          const a = action(p);
          return (
            <Link key={p.mysterfoodieId} href={`/mi-negocio/mysterfoodie/${p.formId}`} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <PixelBadge name="sunglasses" size={38} tone="dark" />
                <div>
                  <div className="text-[15px] font-bold">{p.alias}</div>
                  <div className="text-[12px] text-stone-500">
                    {p.rankLabel} · visita del {fmt(p.visitDate)}
                  </div>
                </div>
              </div>
              <span className="text-[12.5px] font-bold" style={{ color: a.color }}>{a.text}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
