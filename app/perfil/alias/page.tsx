import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ALIAS_MAX_ATTEMPTS, getMyAlias } from "@/lib/aliasStore";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import AliasPicker from "@/components/perfil/AliasPicker";

export const dynamic = "force-dynamic";

export default async function AliasPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const profile = await requireRole("admin", "sibarita", "agente");
  const { next } = await searchParams;
  const mine = await getMyAlias(getSupabaseServiceClient(), profile.userId);
  const nextHref = next === "invitar" ? "/perfil/invitar" : "/perfil";
  // Perfil nuevo: una vez elegido, ya no se puede cambiar. Perfil que ya existía: puede cambiarlo.
  if (mine.alias && mine.capped) redirect(nextHref);
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-10">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">{mine.alias ? "Cambiar mi nombre" : "Tu nombre anónimo"}</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Cada MysterFoodie tiene uno: el nombre de una especia (o, si eres no binarie, de una fruta o verdura que termina en «e») con el apellido de una figura famosa. Es un secreto del equipo.
            {mine.capped ? " Elige el estilo y descubre el tuyo." : " Elige el estilo y te proponemos uno."}
          </p>
        </div>
        <div className="px-5 pt-3">
          <AliasPicker
            nextHref={nextHref}
            capped={mine.capped}
            maxAttempts={ALIAS_MAX_ATTEMPTS}
            rollsUsed={mine.rollsUsed}
            proposals={mine.proposals}
            initialStyle={mine.style}
            currentAlias={mine.alias}
          />
        </div>
      </div>
    </div>
  );
}
