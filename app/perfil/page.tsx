import { redirect } from "next/navigation";
import { requireRole, createSupabaseServerClient } from "@/lib/auth";
import { getVisitsByAgent, getAllVisits } from "@/lib/dashboard";
import { initialsFor } from "@/lib/ring";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  agente: "Mystery shopper",
  cliente: "Dueño de negocio",
};

export default async function PerfilPage() {
  const profile = await requireRole("admin", "agente");
  const visits = profile.role === "admin" ? await getAllVisits() : await getVisitsByAgent(profile.userId);

  const now = new Date();
  const visitasMes = visits.filter((v) => {
    const d = new Date(v.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const displayName = profile.fullName || profile.email;

  return (
    <div className="md:hidden min-h-[70vh]" style={{ background: "#F2F2F7" }}>
      <div className="px-5 pb-3.5 pt-5">
        <div className="mb-0.5 text-[10px] font-bold tracking-[1.1px]" style={{ color: "#F24444" }}>
          MYSTERFOODIE
        </div>
        <div className="heading text-[34px] font-bold">Perfil</div>
      </div>

      <div className="card mx-5 mb-5 flex items-center gap-3.5 p-[18px]">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ background: "#1C1C1E" }}
        >
          {initialsFor(displayName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold">{displayName}</div>
          {displayName !== profile.email && (
            <div className="truncate text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              {profile.email}
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        Rol
      </div>
      <div className="card mx-5 mb-5 flex items-center gap-3 px-4 py-3.5">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg"
          style={{ background: "rgba(242,68,68,0.12)" }}
        >
          {profile.role === "admin" ? "🛠️" : "🕵️"}
        </div>
        <div className="text-[15px] font-semibold">{ROLE_LABEL[profile.role] ?? profile.role}</div>
      </div>

      <div className="card mx-5 flex p-3.5">
        <div className="flex-1 text-center">
          <div className="text-[18px] font-bold">{visits.length}</div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            Visitas totales
          </div>
        </div>
        <div className="w-px" style={{ background: "rgba(60,60,67,0.08)" }} />
        <div className="flex-1 text-center">
          <div className="text-[18px] font-bold" style={{ color: "#F24444" }}>
            {visitasMes}
          </div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            Este mes
          </div>
        </div>
      </div>

      <form action={signOut} className="mx-5 mt-6 mb-8">
        <button
          type="submit"
          className="card w-full py-3.5 text-[15px]"
          style={{ color: "#FF3B30" }}
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
