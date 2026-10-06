import { redirect } from "next/navigation";
import { requireRole, createSupabaseServerClient } from "@/lib/auth";
import { getVisitsByAgent, getAllVisits } from "@/lib/dashboard";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import ConnectGoogleButton from "@/components/auth/ConnectGoogleButton";
import MobileInviteForm from "@/components/mobile/MobileInviteForm";
import DeleteButton from "@/components/DeleteButton";
import FlancoCredit from "@/components/FlancoCredit";

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

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; error?: string }>;
}) {
  const profile = await requireRole("admin", "agente", "sibarita", "cliente");
  const { google, error: googleError } = await searchParams;
  const isCliente = profile.role === "cliente";
  const visits = isCliente
    ? []
    : profile.role === "admin"
    ? await getAllVisits()
    : await getVisitsByAgent(profile.userId);

  const now = new Date();
  const visitasMes = visits.filter((v) => {
    const d = new Date(v.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const displayName = profile.fullName || profile.email;
  const currentRank = isCliente
    ? null
    : profile.role === "admin"
    ? RANKS[0]
    : profile.role === "sibarita"
    ? RANKS[1]
    : RANKS[2];

  return (
    <>
    <div className="md:hidden min-h-[70vh]" style={{ background: "#F2F2F7" }}>
      <div className="px-5 pb-3.5 pt-5">
        <div className="mb-0.5 text-[10px] font-bold tracking-[1.1px]" style={{ color: "#F24444" }}>
          MYSTERFOODIE
        </div>
        <div className="heading text-[34px] font-bold">Perfil</div>
      </div>

      <div className="card mx-5 mt-4 mb-5 flex items-center gap-3.5 p-[18px]">
        <Avatar displayName={displayName} avatarUrl={profile.avatarUrl} sizeClass="h-14 w-14 text-xl" />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold">{displayName}</div>
          {displayName !== profile.email && (
            <div className="truncate text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              {profile.email}
            </div>
          )}
        </div>
      </div>

      {google === "conectado" && (
        <p className="mx-5 mb-5 rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(52,199,89,0.1)", color: "#248A3D" }}>
          Tu cuenta de Google quedó conectada.
        </p>
      )}
      {googleError && (
        <p className="mx-5 mb-5 rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>
          {googleError}
        </p>
      )}

      <div className="card mx-5 mb-5 p-[18px]">
        {profile.hasGoogleIdentity ? (
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            <span className="text-[14px] font-semibold">Cuenta de Google conectada</span>
            <span className="ml-auto text-[13px]" style={{ color: "#248A3D" }}>✓</span>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
              Conecta tu cuenta de Google para que tu foto de perfil se vea bien en toda la app.
            </p>
            <ConnectGoogleButton />
          </>
        )}
      </div>

      {!isCliente && currentRank && (
      <>
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
      </>
      )}

      {(profile.role === "admin" || profile.role === "sibarita") && (
        <div className="mx-5">
          {profile.role === "admin" && <MobileInviteForm />}
          {profile.role === "sibarita" && <MobileInviteForm allowedRoles={["agente"]} />}
        </div>
      )}

      <div
        className="mx-5 mt-5 rounded-[18px] p-5 text-center"
        style={{ background: "#1C1C1E" }}
      >
        <div className="mb-3 flex flex-col items-center gap-2">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(242,68,68,0.18)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" fill="#F24444" />
              <path d="M9 12.5l2 2 4-4.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="heading text-[21px] font-bold uppercase tracking-wide text-white">Palabra Foodie</div>
        </div>
        <div
          className="mx-auto text-[14.5px] italic leading-relaxed"
          style={{ color: "rgba(255,255,255,0.85)", maxWidth: "80%" }}
        >
          &ldquo;Palabra Foodie, orgullo sibarita:
          <br />
          ponemos la boca en el plato
          <br />
          y la firma en la verdad.&rdquo;
        </div>
      </div>

      <div className="mx-5 mt-2.5 text-center">
        <FlancoCredit />
      </div>

      {profile.role === "admin" && (
        <Link
          href="/admin/usuarios"
          className="card mx-5 mt-4 flex items-center justify-between p-4"
        >
          <div>
            <div className="text-[14.5px] font-bold">Usuarios</div>
            <div className="mt-0.5 text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Administra Sibaritas, Foodies y sus roles
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
            <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

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
          <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
            <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      {profile.role === "admin" && (
        <Link
          href="/admin/finanzas"
          className="card mx-5 mt-4 flex items-center justify-between p-4"
        >
          <div>
            <div className="text-[14.5px] font-bold">Finanzas</div>
            <div className="mt-0.5 text-[12px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              Calculadora de reparto de ingresos por visita
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
            <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      {profile.role === "admin" && (
        <div className="mx-5">
          <DeleteButton
            endpoint="/api/admin/reset-demo-data"
            confirmText="Esto BORRA todos los negocios y visitas que haya en este momento y deja todo vacío, listo para empezar a usar la app en serio. No se puede deshacer."
            redirectTo="/negocios"
            triggerLabel="Vaciar negocios y visitas"
            variant="mobile"
          />
        </div>
      )}

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

    {/* Esta pantalla es sobre todo móvil (rango, Palabra Foodie, etc.), pero
       "Conectar cuenta de Google" solo vive aquí y antes no tenía ninguna
       versión de escritorio -- quien entrara a /perfil desde una
       computadora veía el header y nada más debajo. Esta versión reducida
       cubre lo esencial: identidad y la conexión de Google. */}
    <main className="mx-auto hidden max-w-xl px-6 py-14 md:block">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Perfil</h1>

      <div className="mt-6 flex items-center gap-3.5 card p-[18px]">
        <Avatar displayName={displayName} avatarUrl={profile.avatarUrl} sizeClass="h-14 w-14 text-xl" />
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-ink">{displayName}</div>
          <div className="truncate text-sm text-stone-500">
            {ROLE_LABEL[profile.role] ?? profile.role}
            {displayName !== profile.email ? ` · ${profile.email}` : ""}
          </div>
        </div>
      </div>

      {google === "conectado" && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Tu cuenta de Google quedó conectada.
        </p>
      )}
      {googleError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {googleError}
        </p>
      )}

      <div className="mt-4 card p-[18px]">
        {profile.hasGoogleIdentity ? (
          <div className="flex items-center gap-2.5 text-sm font-semibold text-ink">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            Cuenta de Google conectada
            <span className="ml-auto text-green-700">✓</span>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-500">
              Conecta tu cuenta de Google para que tu foto de perfil se vea bien en toda la app.
            </p>
            <ConnectGoogleButton />
          </>
        )}
      </div>

      {!isCliente && currentRank && (
        <>
          <div className="mt-8 mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
            Tu rango
          </div>
          <div className="card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-2xl"
                style={{ background: "rgba(242,68,68,0.12)" }}
              >
                {currentRank.emoji}
              </div>
              <div>
                <div className="text-base font-bold text-ink">{currentRank.label}</div>
                <div className="text-sm text-stone-500">{ROLE_LABEL[profile.role] ?? profile.role}</div>
              </div>
            </div>
            <div className="mt-3.5 flex border-t border-stone-100 pt-3.5">
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-ink">{visits.length}</div>
                <div className="mt-0.5 text-xs text-stone-500">Visitas totales</div>
              </div>
              <div className="w-px bg-stone-100" />
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-brand-500">{visitasMes}</div>
                <div className="mt-0.5 text-xs text-stone-500">Este mes</div>
              </div>
            </div>
          </div>
          <div className="card mt-2.5 px-4 py-1.5">
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
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg">
                    {r.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-ink">{r.label}</div>
                    <div className="mt-0.5 text-xs leading-snug text-stone-500">{r.desc}</div>
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
        </>
      )}

      {(profile.role === "admin" || profile.role === "sibarita") && (
        <div className="mt-5">
          {profile.role === "admin" && <MobileInviteForm />}
          {profile.role === "sibarita" && <MobileInviteForm allowedRoles={["agente"]} />}
        </div>
      )}

      {profile.role === "admin" && (
        <div className="mt-6 border-t border-stone-100 pt-6">
          <DeleteButton
            endpoint="/api/admin/reset-demo-data"
            confirmText="Esto BORRA todos los negocios y visitas que haya en este momento y deja todo vacío, listo para empezar a usar la app en serio. No se puede deshacer."
            redirectTo="/negocios"
            triggerLabel="Vaciar negocios y visitas"
            variant="desktop"
          />
        </div>
      )}

      {isCliente && (
        <p className="mt-6 text-sm text-stone-500">
          Entra desde el celular para ver el resto de tu perfil.
        </p>
      )}
    </main>
    </>
  );
}
