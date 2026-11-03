import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { buildMysterfoodieProfile } from "@/lib/mysterfoodieProfile";
import MysterfoodieProfileView from "@/components/negocio/MysterfoodieProfileView";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import { TIERS, TIER_EMOJI, type TierKey } from "@/lib/personaCatalog";

export const dynamic = "force-dynamic";

/** «Vista del negocio»: el MysterFoodie ve su propio perfil anónimo tal como lo vería un negocio que compra el nivel ID o Passport. */
export default async function VistaNegocioPage({ searchParams }: { searchParams: Promise<{ nivel?: string }> }) {
  const me = await requireRole("admin", "sibarita", "agente");
  const { nivel } = await searchParams;
  const tier: TierKey = nivel === "passport" ? "passport" : "id";
  const profile = await buildMysterfoodieProfile(me.userId, { tier });

  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-12 md:max-w-3xl">
        <MobileSectionHeader backHref="/perfil/anonimo" backLabel="Mi perfil anónimo" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">Vista del negocio</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Así ve un negocio tu perfil anónimo cuando compra cada nivel. Solo aparece lo que decidiste compartir; nunca tu nombre, foto, contacto ni documentos.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Nivel a previsualizar">
            {(["id", "passport"] as TierKey[]).map((t) => {
              const on = t === tier;
              const accent = t === "passport" ? "#5856D6" : "#F24444";
              return (
                <Link
                  key={t}
                  href={`/perfil/anonimo/vista-negocio?nivel=${t}`}
                  role="tab"
                  aria-selected={on}
                  replace
                  className="rounded-2xl px-3 py-3 text-center text-[14.5px] font-bold"
                  style={on ? { background: accent, color: "#fff" } : { background: "#fff", color: "#1C1C1E", boxShadow: "inset 0 0 0 1.5px #E3E3E8" }}
                >
                  <span aria-hidden="true">{TIER_EMOJI[t]}</span> Nivel {TIERS[t].label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="px-4 pt-2 md:px-5">
          {!profile ? (
            <div className="mt-6 rounded-2xl bg-white p-5 text-[14.5px] leading-snug">
              <p className="font-bold">Aún no hay perfil que mostrar</p>
              <p className="mt-1" style={{ color: "rgba(60,60,67,0.7)" }}>
                Para verlo necesitas tu nombre anónimo y compartir al menos un bloque de tu perfil.
              </p>
              <Link href="/perfil/anonimo" className="mt-3 inline-block font-bold" style={{ color: "#F24444" }}>Ir a Mi perfil anónimo →</Link>
            </div>
          ) : profile.blocks.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-5 text-[14.5px] leading-snug">
              <p className="font-bold">Todavía no compartes nada de este nivel</p>
              <p className="mt-1" style={{ color: "rgba(60,60,67,0.7)" }}>
                {tier === "passport"
                  ? "El nivel Passport necesita al menos 3 visitas y completar y compartir las secciones del buyer persona."
                  : "Comparte tus gustos, tu consumo o tu sector para que aparezcan aquí."}
              </p>
              <Link href="/perfil/anonimo" className="mt-3 inline-block font-bold" style={{ color: "#F24444" }}>Completar y compartir →</Link>
            </div>
          ) : (
            <MysterfoodieProfileView profile={profile} />
          )}
        </div>
      </div>
    </div>
  );
}
