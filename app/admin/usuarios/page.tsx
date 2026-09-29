import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getAdminStats } from "@/lib/dashboard";
import InviteUserForm from "@/components/InviteUserForm";
import UserRoleEditor from "@/components/UserRoleEditor";

export const dynamic = "force-dynamic";

type Role = "admin" | "agente" | "cliente";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  client_id: string | null;
};

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="heading mt-1 text-3xl text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-stone-500">{sublabel}</p>}
    </div>
  );
}

export default async function UsuariosPage() {
  const session = await requireRole("admin");
  const db = getSupabaseServiceClient();

  const [{ data: profiles }, { data: clients }, stats] = await Promise.all([
    db.from("profiles").select("id, email, full_name, role, client_id").order("email"),
    db.from("clients").select("id, name").order("name"),
    getAdminStats(),
  ]);

  const clientNameById = new Map((clients || []).map((c) => [c.id, c.name as string]));

  const rows: (ProfileRow & { client_name: string | null })[] = (profiles || []).map((p) => ({
    ...p,
    client_name: p.client_id ? clientNameById.get(p.client_id) ?? null : null,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="heading text-3xl text-brand-500">Usuarios</h1>
      <p className="mt-1 text-sm text-stone-500">
        Invita agentes y dueños de negocio, y administra sus roles.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Negocios totales"
          value={stats.totalNegocios}
          sublabel={`+${stats.negociosUltimoMes} en el último mes`}
        />
        <StatCard
          label="Negocios nuevos"
          value={stats.negociosUltimoMes}
          sublabel="Últimos 30 días"
        />
        <StatCard
          label="Usuarios totales"
          value={stats.totalUsuarios}
          sublabel={`${stats.usuariosPorRol.admin} admin · ${stats.usuariosPorRol.agente} agentes · ${stats.usuariosPorRol.cliente} clientes`}
        />
        <StatCard
          label="Visitas registradas"
          value={stats.totalVisitas}
          sublabel={`${stats.visitasUltimoMes} en el último mes`}
        />
      </div>

      <div className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Invitar usuario</h2>
        <InviteUserForm clients={(clients || []).map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-4 py-2 font-medium">Correo</th>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Negocio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2">{r.full_name || "-"}</td>
                <td className="px-4 py-2">
                  <UserRoleEditor
                    userId={r.id}
                    initialRole={r.role as Role}
                    isSelf={r.id === session.userId}
                  />
                </td>
                <td className="px-4 py-2">{r.client_name || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-stone-400" colSpan={4}>
                  Aún no hay usuarios invitados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
