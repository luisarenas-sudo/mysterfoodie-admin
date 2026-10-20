import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import AnonProfileForm from "@/components/perfil/AnonProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilAnonimoPage() {
  const me = await requireRole("admin", "sibarita", "agente");
  const { data } = await getSupabaseServiceClient()
    .from("profiles")
    .select("postal_code, food_cuisines, food_dishes")
    .eq("id", me.userId)
    .maybeSingle();
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-10">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">Mi perfil anónimo</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Los negocios que te visiten podrán comprar un perfil con tu nombre anónimo, tus gustos, tus palabras, con cuántas personas
            sales, tus totales y tu zona. Nunca ven tu nombre, foto ni contacto.
          </p>
        </div>
        <div className="px-5 pt-3">
          <AnonProfileForm initial={{ postalCode: data?.postal_code ?? "", cuisines: data?.food_cuisines ?? [], dishes: data?.food_dishes ?? [] }} />
        </div>
      </div>
    </div>
  );
}
