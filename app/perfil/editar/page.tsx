import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import EditarPerfil from "@/components/perfil/EditarPerfil";

export const dynamic = "force-dynamic";

export default async function EditarPerfilPage() {
  const profile = await requireRole("admin", "agente", "sibarita", "cliente");

  // El teléfono vive aparte de getSessionProfile para no tocar esa consulta
  // (que usa toda la app) con una columna nueva.
  let phone = "";
  try {
    const { data } = await getSupabaseServiceClient().from("profiles").select("phone").eq("id", profile.userId).maybeSingle();
    phone = (data?.phone as string | null) ?? "";
  } catch {
    phone = "";
  }

  const displayName = profile.fullName || profile.email;
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pt-5">
          <div className="heading text-[30px] font-bold">Editar perfil</div>
        </div>
        <EditarPerfil
          displayName={displayName}
          email={profile.email}
          avatarUrl={profile.avatarUrl}
          initialName={profile.fullName ?? ""}
          initialPhone={phone}
        />
      </div>
    </div>
  );
}
