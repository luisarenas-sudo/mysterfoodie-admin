import Link from "next/link";
import type { BuyableProfile } from "@/lib/profilePurchases";
import { PixelBadge } from "@/components/ui/PixelBadge";
import { Pix } from "@/components/ui/Pix";
import { PERFIL_PITCH, PERFIL_PITCH_TITLE, PLATFORM_FEE_PCT, TIERS, TIER_EMOJI } from "@/lib/personaCatalog";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });

function action(p: BuyableProfile): { text: string; color: string } {
  if (p.owned === "passport") return { text: "Ver perfil", color: "#1E8E4E" };
  if (p.owned === "id") return { text: p.passportAvailable ? "Ver · mejorar a 👑 Passport" : "Ver perfil", color: p.passportAvailable ? "#5856D6" : "#1E8E4E" };
  return { text: p.passportAvailable ? "Destapar 👑" : "Destapar", color: p.passportAvailable ? "#5856D6" : "#F24444" };
}

/** Prioridad: primero quien ya tiene Passport, luego quien lo ofrece (a destapar o mejorar) y al final solo ID; dentro de cada grupo, lo más reciente. */
const rank = (p: BuyableProfile) => (p.owned === "passport" ? 0 : p.passportAvailable ? 1 : 2);
const sortProfiles = (list: BuyableProfile[]) => [...list].sort((a, b) => rank(a) - rank(b) || b.visitDate.localeCompare(a.visitDate));

/** Nivel que se muestra junto al nombre: el que ya compró; si no, el más alto que ofrece. */
const badgeOf = (p: BuyableProfile) => (p.owned === "passport" || (!p.owned && p.passportAvailable) ? "passport" : "id") as "passport" | "id";

/** "Destapa el perfil de tu MysterFoodie": perfiles anónimos que el negocio puede comprar (visitas con reporte desbloqueado). */
export default function MysterfoodieProfilesCard({ profiles, className = "" }: { profiles: BuyableProfile[]; className?: string }) {
  if (profiles.length === 0) return null;
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="heading text-[20px] leading-tight">{PERFIL_PITCH_TITLE}</h2>
      <p className="mt-1 text-[13px] leading-snug text-stone-500">{PERFIL_PITCH}</p>
      <p className="mt-2 text-[12.5px] font-semibold text-stone-600">
        {TIER_EMOJI.passport} Passport ${TIERS.passport.price} · {TIER_EMOJI.id} ID ${TIERS.id.price} MXN + {PLATFORM_FEE_PCT}% de cargo por uso de la plataforma + IVA · pago único
      </p>
      <div className="mt-3 divide-y" style={{ borderColor: "rgba(60,60,67,0.08)" }}>
        {sortProfiles(profiles).map((p) => {
          const a = action(p);
          const b = badgeOf(p);
          return (
            <Link key={p.mysterfoodieId} href={`/mi-negocio/mysterfoodie/${p.formId}`} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <PixelBadge name="sunglasses" size={38} tone="dark" />
                <div>
                  <div className="flex items-center gap-1.5 text-[15px] font-bold">
                    {p.alias}
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={b === "passport" ? { background: "#EEEEFC", color: "#5856D6" } : { background: "#FFF0EE", color: "#F24444" }}
                    >
                      <Pix e={TIER_EMOJI[b]} size={12} />
                      {TIERS[b].label}
                    </span>
                  </div>
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
