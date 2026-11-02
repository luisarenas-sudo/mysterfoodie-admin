import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import SeguimientoView from "@/components/admin/SeguimientoView";
import { getSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

/** Perfil > Stats: toda la medición (aperturas, clics, correos, reportes y el contador de la web). Solo Master Chef. */
export default async function SeguimientoPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireRole("admin");
  const { dias } = await searchParams;
  const days = [7, 30, 90].includes(Number(dias)) ? Number(dias) : 30;
  const data = await getSeguimiento(getSupabaseServiceClient(), days);
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-2xl pb-10">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-3 pt-5">
          <div className="heading text-[30px] font-bold">📈 Stats</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Lo que mide MysterFoodie: reportes abiertos, clics en «Comprar», correos, solicitudes y las visitas a la web. Solo lo ves tú.
          </p>
        </div>
        <div className="px-5">
          <SeguimientoView s={data} />
        </div>
      </div>
    </div>
  );
}
