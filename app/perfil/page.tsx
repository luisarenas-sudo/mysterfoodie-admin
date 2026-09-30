import { redirect } from "next/navigation";
import { requireRole, createSupabaseServerClient } from "@/lib/auth";
import { getVisitsByAgent, getAllVisits } from "@/lib/dashboard";
import { initialsFor } from "@/lib/ring";
import Link from "next/link";
import MobileInviteForm from "@/components/mobile/MobileInviteForm";

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
  sibarita: "Sibarita",
};

const RANKS = [
  {
    key: "master",
    emoji: "👨‍🍳",
    label: "Master Chef",
    desc: "Administra toda la red de Mystery Shoppers y da seguimiento a cada negocio.",
  },
  {
    key: "sibarita",
    emoji: "🍷",
    label: "Sibarita",
    desc: "Da de alta negocios y levanta visitas Mystery Shopper libremente.",
  },
  {
    key: "foodie",
    emoji: "🌱",
    label: "Foodie",
    desc: "Levanta visitas Mystery Shopper y registra la evaluación en la app.",
  },
] as const;

export default async function PerfilPage() {
  const profile = await requireRole("admin", "agente", "sibarita");
  const visits =
    profile.role === "admin" ? await getAllVisits() : await getVisitsByAgent(profile.userId);

  const now = new Date();
  const visitasMes = visits.filter((v) => {
    const d = new Date(v.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const displayName = profile.fullName || profile.email;
  const currentRank =
    profile.role === "admin" ? RANKS[0] : profile.role === "sibarita" ? RANKS[1] : RANKS[2];

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
        Tu rango
      </div>
      <div className="card mx-5 mb-2.5 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ background: "rgba(242,68,68,0.12)" }}
          >
            {currentRank.emoji}
          </div>
          <div>
            <div className="text-[17px] font-bold">{currentRank.label}</div>
            <div className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              {ROLE_LABEL[profile.role] ?? profile.role}
            </div>
          </div>
        </div>
        <div className="mt-3.5 flex pt-3.5" style={{ borderTop: "1px solid rgba(60,60,67,0.08)" }}>
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
      </div>
      <div className="card mx-5 mb-5 px-4 py-1.5">
        {RANKS.map((r, idx) => {
          const isCurrent = r.key === currentRank.key;
          return (
            <div
              key={r.key}
              className="flex items-center gap-3 py-2.5"
              style={{
                opacity: isCurrent ? 1 : 0.45,
                borderBottom: idx < RANKS.length - 1 ? "1px solid rgba(60,60,67,0.08)" : undefined,
              }}
            >
              <div
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: "rgba(60,60,67,0.06)" }}
              >
                {r.emoji}
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-bold">{r.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
                  {r.desc}
                </div>
              </div>
              {isCurrent && (
                <div
                  className="flex-shrink-0 rounded-lg px-2 py-[3px] text-[10px] font-bold"
                  style={{ color: "#F24444", background: "rgba(242,68,68,0.1)" }}
                >
                  TÚ
                </div>
              )}
            </div>
          );
        })}
      </div>

      {profile.role === "admin" && <MobileInviteForm />}

      {profile.role === "admin" && (
        <Link
          href="/automatizaciones"
          className="card mx-5 mt-4 flex items-center justify-between p-4"
        >
          <div>
            <div className="text-[14.5px] font-bold">Automatizaciones</div>
            <div className="mt-0.5 text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Correos automáticos y agenda de asesorías
            </div>
          </div>
          <span style={{ color: "rgba(60,60,67,0.35)" }}>&rsaquo;</span>
        </Link>
      )}

      <div
        className="mx-5 mt-5 rounded-[18px] p-5"
        style={{ background: "#1C1C1E" }}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(242,68,68,0.18)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" fill="#F24444" />
              <path d="M9 12.5l2 2 4-4.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="heading text-[19px] font-bold uppercase tracking-wide text-white">Palabra Foodie</div>
        </div>
        <div className="text-[14px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
          &ldquo;Palabra Foodie, orgullo de gordo: la verdad es mi palabra y pongo mi boca en la verdad.&rdquo;
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
