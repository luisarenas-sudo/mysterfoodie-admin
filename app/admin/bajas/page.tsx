import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/brand";
import BackLink from "@/components/BackLink";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import BajaReview, { type BajaBusiness, type BajaOwnerOption } from "@/components/BajaReview";

export const dynamic = "force-dynamic";

type RemovalRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  removed_at: string;
  moved: Record<string, string[]>;
  status: "pendiente" | "revisada";
};

export default async function BajasPage() {
  await requireRole("admin");
  const db = getSupabaseServiceClient();

  const { data: removalRows } = await db
    .from("user_removals")
    .select("id, email, full_name, role, removed_at, moved, status")
    .order("status", { ascending: false })
    .order("removed_at", { ascending: false });
  const removals = (removalRows || []) as RemovalRow[];

  const clientIds = [...new Set(removals.flatMap((r) => r.moved?.["clients.created_by"] ?? []))];
  const [{ data: clients }, { data: forms }, { data: owners }] = await Promise.all([
    clientIds.length
      ? db.from("clients").select("id, name, type, city, created_by").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string; type: string | null; city: string | null; created_by: string | null }[] }),
    clientIds.length
      ? db.from("forms").select("client_id").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string }[] }),
    db.from("profiles").select("id, full_name, email, role").in("role", ["admin", "sibarita", "agente"]).order("email"),
  ]);

  const visitCount = new Map<string, number>();
  for (const f of forms || []) visitCount.set(f.client_id as string, (visitCount.get(f.client_id as string) ?? 0) + 1);
  const ownerOptions: BajaOwnerOption[] = (owners || []).map((o) => ({
    id: o.id as string,
    label: `${o.full_name || o.email} · ${ROLE_LABELS[o.role as string] ?? o.role}`,
  }));
  const ownerLabel = new Map(ownerOptions.map((o) => [o.id, o.label]));
  const clientById = new Map((clients || []).map((c) => [c.id as string, c]));

  const items = removals.map((r) => {
    const businesses: BajaBusiness[] = (r.moved?.["clients.created_by"] ?? [])
      .map((id) => clientById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        visits: visitCount.get(c.id) ?? 0,
        ownerId: c.created_by,
        ownerLabel: c.created_by ? ownerLabel.get(c.created_by) ?? "Asignado" : null,
      }));
    return {
      id: r.id,
      who: r.full_name || r.email,
      email: r.email,
      roleLabel: ROLE_LABELS[r.role ?? ""] ?? r.role ?? "",
      removedAt: r.removed_at,
      status: r.status,
      visits: (r.moved?.["forms.created_by"] ?? []).length,
      assignments: (r.moved?.["visit_assignments.assigned_to"] ?? []).length,
      businesses,
    };
  });

  return (
    <>
      <div className="md:hidden">
        <MobileSectionHeader backHref="/admin/usuarios" backLabel="Usuarios" />
      </div>
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-5 md:px-6 md:py-10">
        <div className="hidden md:block">
          <BackLink href="/admin/usuarios" label="Usuarios" />
        </div>
        <h1 className="heading mt-2 text-2xl text-brand-500 md:text-3xl">Bajas por revisar</h1>
        <p className="mt-1 text-sm text-stone-500">
          Cuando eliminas a alguien, sus visitas y asignaciones pasan a ti. Sus negocios quedan sin dueño hasta que decidas:
          asignarlos a alguien o eliminarlos.
        </p>
        <BajaReview items={items} owners={ownerOptions} />
      </main>
    </>
  );
}
