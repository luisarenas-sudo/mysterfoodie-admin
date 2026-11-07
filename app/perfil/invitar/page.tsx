import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { ensureInviteLink, getMyAlias } from "@/lib/aliasStore";
import { countPendingApplications } from "@/lib/aspirantes";
import { Group } from "@/components/perfil/ListRow";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import InviteQr from "@/components/perfil/InviteQr";
import InviteUserForm from "@/components/InviteUserForm";
import AspirantesList from "@/components/admin/AspirantesList";

export const dynamic = "force-dynamic";

type TabKey = "qr" | "correo" | "aspirantes";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Por aprobar", color: "#B26A00", bg: "rgba(255,149,0,0.14)" },
  aprobada: { label: "Ya es Shopper", color: "#248A3D", bg: "rgba(52,199,89,0.14)" },
  rechazada: { label: "No aprobada", color: "#6B6B70", bg: "rgba(60,60,67,0.1)" },
};

const MUTED = "rgba(60,60,67,0.7)";

/**
 * Un solo lugar para sumar gente al equipo: con tu QR, por correo y (Master Chef)
 * aprobando a quienes llegaron con un QR. Antes eran tres pantallas sueltas en Perfil.
 */
export default async function InvitarPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireRole("admin", "sibarita");
  const isAdmin = profile.role === "admin";
  const { tab: tabParam } = await searchParams;
  const db = getSupabaseServiceClient();

  const pendientes = isAdmin ? await countPendingApplications(db).catch(() => 0) : 0;
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "qr", label: "Mi QR" },
    { key: "correo", label: "Por correo" },
    ...(isAdmin ? [{ key: "aspirantes" as const, label: "Aspirantes", badge: pendientes }] : []),
  ];
  const tab: TabKey = tabs.find((t) => t.key === tabParam)?.key ?? "qr";

  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-10 md:max-w-2xl">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-3 pt-5">
          <div className="heading text-[30px] font-bold">Invitar</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: MUTED }}>
            {isAdmin
              ? "Suma gente al equipo: con tu QR, por correo, o aprobando a quienes llegan solos con un QR."
              : "Suma Shoppers al equipo: con tu QR o por correo."}
          </p>
        </div>

        <nav aria-label="Formas de invitar" className="mx-5 mb-4 flex gap-1 rounded-[12px] p-1" style={{ background: "rgba(118,118,128,0.12)" }}>
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/perfil/invitar?tab=${t.key}`}
                replace
                aria-current={active ? "page" : undefined}
                className="mf-tap flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[13.5px] font-semibold"
                style={active ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: MUTED }}
              >
                {t.label}
                {!!t.badge && (
                  <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: "#F24444" }}>
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {tab === "qr" && <QrTab userId={profile.userId} />}
        {tab === "correo" && <CorreoTab isAdmin={isAdmin} />}
        {tab === "aspirantes" && isAdmin && <AspirantesTab />}
      </div>
    </div>
  );
}

async function QrTab({ userId }: { userId: string }) {
  const db = getSupabaseServiceClient();
  const mine = await getMyAlias(db, userId);

  if (!mine.alias) {
    return (
      <div className="card mx-5 px-5 py-5 text-center">
        <p className="text-[14px] leading-snug" style={{ color: MUTED }}>
          Tu QR lleva tu nombre anónimo. Descúbrelo primero y aquí te queda tu QR fijo.
        </p>
        <Link href="/perfil/alias?next=invitar" className="mf-tap mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[14px] px-5 text-[14.5px] font-bold text-white" style={{ background: "#F24444" }}>
          Elegir mi nombre anónimo
        </Link>
      </div>
    );
  }

  const url = (await ensureInviteLink(db, userId, mine)) ?? "";
  const { data: apps } = await db
    .from("shopper_applications")
    .select("id, full_name, status, created_at")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <p className="mb-3 px-5 text-[14px] leading-snug" style={{ color: MUTED }}>
        Quien escanee tu QR llena su solicitud con todos sus datos y lo que le gusta comer. Un Master Chef la aprueba y le llega su acceso.
      </p>
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
    </>
  );
}

async function CorreoTab({ isAdmin }: { isAdmin: boolean }) {
  const db = getSupabaseServiceClient();
  const clients = isAdmin ? ((await db.from("clients").select("id, name").order("name")).data ?? []) : [];
  return (
    <>
      <p className="mb-3 px-5 text-[14px] leading-snug" style={{ color: MUTED }}>
        {isAdmin
          ? "Manda un acceso directo a un Shopper, Sibarita, Master Chef o dueño de negocio. La invitación vale 5 días."
          : "Manda un acceso directo a un Shopper que ya conoces. La invitación vale 5 días."}
      </p>
      <div className="card mx-5 mb-5 px-5 pb-5 pt-1">
        <InviteUserForm
          clients={clients.map((c) => ({ id: c.id as string, name: c.name as string }))}
          allowedRoles={isAdmin ? undefined : ["agente"]}
        />
      </div>
      {isAdmin && (
        <div className="px-5 text-center">
          <Link href="/admin/usuarios" className="text-[14px] font-semibold" style={{ color: "#F24444" }}>
            Ver y administrar a todos los usuarios
          </Link>
        </div>
      )}
    </>
  );
}

async function AspirantesTab() {
  const db = getSupabaseServiceClient();
  const { data } = await db.from("shopper_applications").select("*").order("created_at", { ascending: false }).limit(100);
  const inviterIds = [...new Set((data || []).map((a) => a.inviter_id as string | null).filter(Boolean))] as string[];
  const { data: inviters } = inviterIds.length ? await db.from("profiles").select("id, full_name, email").in("id", inviterIds) : { data: [] };
  const inviterName = Object.fromEntries((inviters || []).map((i) => [i.id as string, ((i.full_name as string | null) || (i.email as string)) as string]));
  return <AspirantesList applications={(data || []) as Record<string, unknown>[]} inviterName={inviterName} />;
}
