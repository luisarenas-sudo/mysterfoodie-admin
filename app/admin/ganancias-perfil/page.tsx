import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import MarcarPagadoPerfil from "@/components/admin/MarcarPagadoPerfil";
import { BLOCK_BY_KEY } from "@/lib/personaCatalog";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const date = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

/** Ganancias de los MysterFoodies por la venta de sus perfiles anónimos: lo pendiente por pagar y lo ya pagado. */
export default async function GananciasPerfilPage() {
  await requireRole("admin");
  const db = getSupabaseServiceClient();
  const { data: rows } = await db.from("profile_earnings").select("id, mysterfoodie_id, amount, blocks, status, created_at, paid_at").order("created_at", { ascending: false }).limit(500);
  const ids = [...new Set((rows ?? []).map((r) => r.mysterfoodie_id as string))];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, alias").in("id", ids) : { data: [] as { id: string; full_name: string | null; alias: string | null }[] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));

  const pendingBy = new Map<string, { total: number; items: NonNullable<typeof rows> }>();
  for (const r of rows ?? []) {
    if (r.status !== "pendiente") continue;
    const cur = pendingBy.get(r.mysterfoodie_id as string) ?? { total: 0, items: [] };
    cur.total += Number(r.amount);
    cur.items.push(r);
    pendingBy.set(r.mysterfoodie_id as string, cur);
  }
  const paid = (rows ?? []).filter((r) => r.status === "pagado");
  const paidTotal = paid.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-2xl pb-10">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">Ganancias de perfiles</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Lo que gana cada MysterFoodie cuando un negocio compra su perfil anónimo (un porcentaje fijo por cada bloque compartido).
          </p>
        </div>
        <div className="space-y-3 px-5 pt-3">
          {pendingBy.size === 0 && <p className="rounded-2xl bg-white p-4 text-[14px] text-stone-500">No hay ganancias pendientes por pagar.</p>}
          {[...pendingBy.entries()].map(([id, v]) => {
            const p = who.get(id);
            const label = p?.full_name || p?.alias || "MysterFoodie";
            return (
              <div key={id} className="rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-bold">{label}</div>
                    <div className="text-[12px] text-stone-500">{p?.alias ?? ""} · {v.items.length} {v.items.length === 1 ? "venta" : "ventas"}</div>
                  </div>
                  <div className="text-[20px] font-extrabold">{money(v.total)}</div>
                </div>
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-stone-500">
                  {v.items.map((r) => (
                    <li key={r.id as string}>
                      {date(r.created_at as string)} · {money(Number(r.amount))} · {(r.blocks as string[]).map((k) => BLOCK_BY_KEY[k as keyof typeof BLOCK_BY_KEY]?.label ?? k).join(", ")}
                    </li>
                  ))}
                </ul>
                <div className="mt-3"><MarcarPagadoPerfil mysterfoodieId={id} label={label} /></div>
              </div>
            );
          })}
          {paid.length > 0 && (
            <p className="px-1 text-[13px] text-stone-500">Pagado en total: <strong>{money(paidTotal)}</strong> ({paid.length} {paid.length === 1 ? "venta" : "ventas"}).</p>
          )}
        </div>
      </div>
    </div>
  );
}
