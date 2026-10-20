import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ensureInviteLink, getMyAlias } from "@/lib/aliasStore";
import { Group } from "@/components/perfil/ListRow";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import InviteQr from "@/components/perfil/InviteQr";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Por aprobar", color: "#B26A00", bg: "rgba(255,149,0,0.14)" },
  aprobada: { label: "Ya es Shopper", color: "#248A3D", bg: "rgba(52,199,89,0.14)" },
  rechazada: { label: "No aprobada", color: "#6B6B70", bg: "rgba(60,60,67,0.1)" },
};

export default async function InvitarPage() {
  const profile = await requireRole("admin", "sibarita");
  const db = getSupabaseServiceClient();
  const mine = await getMyAlias(db, profile.userId);
  if (!mine.alias) redirect("/perfil/alias?next=invitar");
  const url = (await ensureInviteLink(db, profile.userId, mine)) ?? "";
  const { data: apps } = await db
    .from("shopper_applications")
    .select("id, full_name, status, created_at")
    .eq("inviter_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-10">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-3 pt-5">
          <div className="heading text-[30px] font-bold">Invitar Shoppers</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Quien escanee tu QR llena su solicitud con todos sus datos y lo que le gusta comer. Un Master Chef la aprueba y le llega su acceso.
          </p>
        </div>
        <div className="card mx-5 mb-6 px-5 py-5">
          <div className="mb-3 text-center">
            <div className="text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Tu QR fijo como
            </div>
            <div className="heading text-[22px] font-bold" style={{ color: "#F24444" }}>
              {mine.alias}
            </div>
          </div>
          <InviteQr url={url} alias={mine.alias} />
        </div>

        <Group title="Mis invitados" footer="Quien aplica ve tu nombre anónimo, no tu nombre real.">
          {(apps || []).length === 0 ? (
            <div className="px-4 py-4 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              Todavía nadie ha llenado su solicitud con tu QR.
            </div>
          ) : (
            (apps || []).map((a, i, all) => {
              const st = STATUS[a.status as string] ?? STATUS.pendiente;
              return (
                <div key={a.id as string} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5" style={i < all.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}>
                  <span className="truncate text-[15px] font-medium">{a.full_name as string}</span>
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>
              );
            })
          )}
        </Group>
        <div className="px-5 text-center">
          <Link href="/perfil" className="text-[14px] font-semibold" style={{ color: "#F24444" }}>
            Volver a Perfil
          </Link>
        </div>
      </div>
    </div>
  );
}
