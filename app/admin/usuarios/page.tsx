import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getAdminStats } from "@/lib/dashboard";
import InviteUserForm from "@/components/InviteUserForm";
import UserRoleEditor from "@/components/UserRoleEditor";
import UserActions from "@/components/UserActions";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";

export const dynamic = "force-dynamic";

type Role = "admin" | "agente" | "cliente" | "sibarita";

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
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="heading mt-1 text-3xl text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-stone-500">{sublabel}</p>}
    </div>
  );
}

export default async function UsuariosPage() {
  const session = await requireRole("admin");
  const db = getSupabaseServiceClient();

  const [{ data: profiles }, { data: clients }, stats, authUsers, removals] = await Promise.all([
    db.from("profiles").select("id, email, full_name, role, client_id").order("email"),
    db.from("clients").select("id, name").order("name"),
    getAdminStats(),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    // Si aún no se corre supabase/acceso.sql, la tabla no existe y simplemente no hay bajas.
    db.from("user_removals").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
  ]);
  const pendingRemovals = removals.count ?? 0;
  // Pendiente de activar = todavía no ha iniciado sesión nunca.
  const neverSignedIn = new Set(
    (authUsers.data?.users ?? []).filter((u) => !u.last_sign_in_at).map((u) => u.id)
  );

  const clientNameById = new Map((clients || []).map((c) => [c.id, c.name as string]));

  const rows: (ProfileRow & { client_name: string | null; pending: boolean })[] = (profiles || []).map((p) => ({
    ...p,
    client_name: p.client_id ? clientNameById.get(p.client_id) ?? null : null,
    pending: neverSignedIn.has(p.id),
  }));

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
      </div>
      <main className="mx-auto max-w-4xl px-5 pb-8 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/perfil" label="Perfil" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Usuarios</h1>
        <p className="mt-1 text-sm text-stone-500">
          Invita agentes y dueños de negocio, y administra sus roles. Las invitaciones valen 5 días.
        </p>
        {pendingRemovals > 0 && (
          <Link href="/admin/bajas" className="mt-3 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              🗂️ Tienes <strong>{pendingRemovals}</strong> {pendingRemovals === 1 ? "baja" : "bajas"} con registros por revisar
            </span>
            <span className="font-semibold">Revisar →</span>
          </Link>
        )}

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
            sublabel={`${stats.usuariosPorRol.admin} admin · ${stats.usuariosPorRol.sibarita} sibaritas · ${stats.usuariosPorRol.agente} foodies · ${stats.usuariosPorRol.cliente} clientes`}
          />
          <StatCard
            label="Visitas registradas"
            value={stats.totalVisitas}
            sublabel={`${stats.visitasUltimoMes} en el último mes`}
          />
        </div>

        <div className="mt-8 card p-5">
          <h2 className="text-sm font-semibold text-ink">Invitar usuario</h2>
          <InviteUserForm clients={(clients || []).map((c) => ({ id: c.id, name: c.name }))} />
        </div>

        {/* Escritorio: tabla. Antes era la única versión y se veía
           comprimida/con scroll horizontal en celular -- en pantallas chicas
           se usa la lista de tarjetas de abajo en su lugar. */}
        <div className="mt-8 hidden overflow-x-auto card md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-4 py-2 font-medium">Correo</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Rol</th>
                <th className="px-4 py-2 font-medium">Negocio</th>
                <th className="px-4 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2">
                    {r.email}
                    {r.pending && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Por activar</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{r.full_name || "-"}</td>
                  <td className="px-4 py-2">
                    <UserRoleEditor
                      userId={r.id}
                      initialRole={r.role as Role}
                      isSelf={r.id === session.userId}
                    />
                  </td>
                  <td className="px-4 py-2">{r.client_name || "-"}</td>
                  <td className="px-4 py-2">
                    <UserActions userId={r.id} email={r.email} name={r.full_name} pending={r.pending} isSelf={r.id === session.userId} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-stone-400" colSpan={5}>
                    Aún no hay usuarios invitados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Móvil: una tarjeta por usuario en vez de la tabla. */}
        <div className="mt-8 space-y-3 md:hidden">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="truncate text-sm font-semibold text-ink">
                {r.email}
                {r.pending && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Por activar</span>
                )}
              </p>
              {r.full_name && <p className="mt-0.5 text-sm text-stone-500">{r.full_name}</p>}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <UserRoleEditor
                  userId={r.id}
                  initialRole={r.role as Role}
                  isSelf={r.id === session.userId}
                />
                {r.client_name && (
                  <span className="text-xs text-stone-500">{r.client_name}</span>
                )}
              </div>
              <div className="mt-2">
                <UserActions userId={r.id} email={r.email} name={r.full_name} pending={r.pending} isSelf={r.id === session.userId} />
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="card p-4 text-center text-sm text-stone-400">
              Aún no hay usuarios invitados.
            </p>
          )}
        </div>
        </main>
    </>
  );
}
