import { requireRole } from "@/lib/auth";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import ExitSurvey from "@/components/perfil/ExitSurvey";

export const dynamic = "force-dynamic";

/** Hoja de salida de la baja voluntaria (cualquier cuenta). El botón de Perfil llega aquí al tercer toque. */
export default async function EliminarCuentaPage() {
  const profile = await requireRole("admin", "agente", "sibarita", "cliente");
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <div className="px-5 pb-10 pt-5 md:pt-12">
        <ExitSurvey name={profile.fullName || ""} />
      </div>
    </div>
  );
}
