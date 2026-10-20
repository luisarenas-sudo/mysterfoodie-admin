import DeleteAccountButton from "@/components/perfil/DeleteAccountButton";
import { redirect } from "next/navigation";
import { PALABRA_FOODIE_QUOTE, ROLE_LABELS, mysterfoodieTitle } from "@/lib/brand";
import { requireRole, createSupabaseServerClient } from "@/lib/auth";
import { getVisitsByAgent, getAllVisits } from "@/lib/dashboard";
import Link from "next/link";
import ConnectGoogleButton from "@/components/auth/ConnectGoogleButton";
import MobileInviteForm from "@/components/mobile/MobileInviteForm";
import DeleteButton from "@/components/DeleteButton";
import FlancoCredit from "@/components/FlancoCredit";
import EasterEggBee from "@/components/EasterEggBee";
import { Group, Row } from "@/components/perfil/ListRow";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { countPendingRequests } from "@/lib/visitRequests";
import { countPendingApplications } from "@/lib/aspirantes";
import IdentityCard from "@/components/perfil/IdentityCard";
import DesktopIdentity from "@/components/perfil/DesktopIdentity";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}


const RANKS = [
  {
    key: "master",
    emoji: "👨‍🍳",
    label: ROLE_LABELS.admin,
    desc: "Administra toda la red de MysterFoodies y da seguimiento a cada negocio.",
    can: [
      "Añade negocios y administra a todo el equipo",
      "Asigna visitas a Sibaritas y Shoppers",
      "Revisa solicitudes, resultados y finanzas",
      "Configura planes y mensajes automáticos",
    ],
  },
  {
    key: "sibarita",
    emoji: "🍷",
    label: ROLE_LABELS.sibarita,
    desc: "Da de alta negocios y levanta visitas libremente.",
    can: [
      "Añade nuevos negocios",
      "Realiza visitas",
      "Asigna nuevas visitas a Shoppers",
    ],
  },
  {
    key: "foodie",
    emoji: "🌱",
    label: ROLE_LABELS.agente,
    desc: "Hace las visitas que le asignan y registra la evaluación en la app.",
    can: [
      "Realiza las visitas que le asignan",
      "Registra la evaluación desde su celular",
      "Consulta sus visitas y sus pagos",
    ],
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
  const solicitudesPendientes = profile.role === "admin" ? await countPendingRequests(getSupabaseServiceClient()).catch(() => 0) : 0;
  const aspirantesPendientes = profile.role === "admin" ? await countPendingApplications(getSupabaseServiceClient()).catch(() => 0) : 0;
  const myAliasRow = isCliente
    ? null
    : await getSupabaseServiceClient().from("profiles").select("alias, alias_capped").eq("id", profile.userId).maybeSingle().then((r) => r.data, () => null);
  const myAlias = (myAliasRow?.alias as string | null) ?? null;
  const canChangeAlias = !!myAlias && myAliasRow?.alias_capped === false;
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
    <div className="md:hidden min-h-[70vh] pb-6" style={{ background: "#F2F2F7" }}>
      <div className="px-5 pb-3.5 pt-5">
        <div className="heading text-[30px] font-bold leading-tight">
          Perfil del <span style={{ color: "#F24444" }}>MysterFoodie</span>
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

      {/* Tarjeta de identidad: toda es un botón hacia Editar perfil; tocar 3 veces el nombre revela el nombre anónimo */}
      <IdentityCard
        displayName={displayName}
        avatarUrl={profile.avatarUrl}
        email={profile.email}
        rankEmoji={currentRank?.emoji}
        rankLabel={currentRank?.label}
        alias={myAlias}
        canHaveAlias={!isCliente}
        canChangeAlias={canChangeAlias}
      />

      <Group title="Cuenta">
        <Row href="/perfil/editar" icon="📷" iconBg="#F24444" title="Foto y datos" subtitle="Tu foto, nombre y teléfono" />
        <Row
          href="/perfil/seguridad"
          icon="🔑"
          iconBg="#FF9500"
          title="Contraseña y acceso"
          detail={profile.hasGoogleIdentity ? "Google ✓" : undefined}
          last={profile.hasGoogleIdentity}
        />
        {!profile.hasGoogleIdentity && (
          <div className="px-4 py-3.5">
            <p className="mb-3 text-[13px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>
              Conecta tu cuenta de Google para entrar con un toque.
            </p>
            <ConnectGoogleButton />
          </div>
        )}
      </Group>

      {!isCliente && currentRank && (
      <>
      <div className="mx-5 mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
        Tu rango
      </div>
      <div className="card mx-5 mb-2.5 px-4 py-3.5">
        <div className="flex flex-col gap-3.5 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-[480px]:gap-5">
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
                Eres MysterFoodie
              </div>
            </div>
          </div>
          <ul className="space-y-1.5 min-[480px]:max-w-[55%]" aria-label={`Lo que puede hacer un ${currentRank.label}`}>
            {currentRank.can.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.75)" }}>
                <svg viewBox="0 0 20 20" className="mt-[1px] h-4 w-4 flex-shrink-0" fill="none" stroke="#8E8E93" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
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
        <div className="mx-5 mb-6">
          {profile.role === "admin" && <MobileInviteForm />}
          {profile.role === "sibarita" && <MobileInviteForm allowedRoles={["agente"]} />}
        </div>
      )}

      <Group title="Herramientas">
        {(profile.role === "admin" || profile.role === "sibarita" || profile.role === "agente") && (
          <Row
            href="/perfil/anonimo"
            icon="🕶️"
            iconBg="#1C1C1E"
            title="Mi perfil anónimo"
            subtitle="Código postal y gustos que ven los negocios (sin tu nombre)"
          />
        )}
        {(profile.role === "admin" || profile.role === "sibarita") && (
          <Row
            href="/perfil/invitar"
            icon="📲"
            iconBg="#007AFF"
            title="Invitar Shoppers con QR"
            subtitle="Tu QR fijo: quien lo escanee llena su solicitud"
          />
        )}
        {(profile.role === "admin" || profile.role === "sibarita" || profile.role === "agente") && (
          <Row
            href="/finanzas"
            icon="💰"
            iconBg="#34C759"
            title="Finanzas"
            subtitle={profile.role === "admin" ? "Ventas y ganancias de todos los perfiles, por mes" : "Tus ganancias por mes"}
            last={profile.role !== "admin"}
          />
        )}
        {profile.role === "admin" && (
          <>
            <Row
              href="/solicitudes"
              icon="🎁"
              iconBg="#F24444"
              title="Solicitudes de visita"
              subtitle={
                solicitudesPendientes > 0
                  ? `${solicitudesPendientes} por asignar · visitas gratis pedidas en la web`
                  : "Visitas gratis pedidas en la web"
              }
            />
            <Row
              href="/admin/aspirantes"
              icon="🙋"
              iconBg="#34C759"
              title="Aspirantes a Shopper"
              subtitle={aspirantesPendientes > 0 ? `${aspirantesPendientes} por aprobar · llegaron con un QR` : "Solicitudes que llegan con un QR"}
            />
            <Row href="/admin/ganancias-perfil" icon="💸" iconBg="#34C759" title="Ganancias de perfiles" subtitle="Lo que ganan los MysterFoodies por sus perfiles anónimos" />
            <Row href="/admin/usuarios" icon="👥" iconBg="#5856D6" title="Usuarios" subtitle="Administra Sibaritas, Shoppers y sus roles" />
            <Row href="/automatizaciones" icon="⚡" iconBg="#FF9500" title="Automatizaciones" subtitle="Correos automáticos y agenda de asesorías" />
            <Row href="/planes" icon="📅" iconBg="#007AFF" title="Planes" subtitle="Visitas mensuales contratadas por sucursal" last />
          </>
        )}
      </Group>

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
          <div className="heading text-[21px] font-bold uppercase tracking-wide text-white">Palabra MysterFoodie</div>
        </div>
        <div
          className="mx-auto text-[14.5px] italic leading-relaxed"
          style={{ color: "rgba(255,255,255,0.85)", maxWidth: "80%" }}
        >
          &ldquo;{PALABRA_FOODIE_QUOTE}&rdquo;
        </div>
      </div>


      <div className="mx-5 mt-2.5 text-center">
        <FlancoCredit />
      </div>

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

      <DeleteAccountButton variant="mobile" />

      <form action={signOut} className="mx-5 mt-4 mb-8">
        <button type="submit" className="card mf-tap flex min-h-[56px] w-full items-center justify-center text-[16px] font-semibold" style={{ color: "#FF3B30" }}>
          Cerrar sesión
        </button>
      </form>

      {/* Easter egg: 3 toques seguidos abren la bitácora de versiones. Solo para
         el equipo (el dueño de un negocio no necesita ver el historial interno). */}
      {!isCliente && <EasterEggBee />}
    </div>

    {/* Esta pantalla es sobre todo móvil (rango, Palabra MysterFoodie, etc.), pero
       "Conectar cuenta de Google" solo vive aquí y antes no tenía ninguna
       versión de escritorio -- quien entrara a /perfil desde una
       computadora veía el header y nada más debajo. Esta versión reducida
       cubre lo esencial: identidad y la conexión de Google. */}
    <main className="mx-auto hidden max-w-xl px-6 py-14 md:block">
      <h1 className="heading text-3xl text-ink">
        Perfil del <span className="text-brand-600">MysterFoodie</span>
      </h1>

      <DesktopIdentity
        displayName={displayName}
        avatarUrl={profile.avatarUrl}
        email={profile.email}
        title={mysterfoodieTitle(profile.role)}
        alias={myAlias}
        canHaveAlias={!isCliente}
        canChangeAlias={canChangeAlias}
      />

      <div className="mt-4 flex flex-nowrap items-center gap-2">
        <Link href="/perfil/editar" className="btn-secondary whitespace-nowrap !px-4 text-sm">
          Editar foto y datos
        </Link>
        <Link href="/perfil/seguridad" className="btn-secondary whitespace-nowrap !px-4 text-sm">
          Contraseña y acceso
        </Link>
        <DeleteAccountButton />
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
                <div className="text-sm text-stone-500">Eres MysterFoodie</div>
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

      {!isCliente && (
        <div className="mt-6">
          <EasterEggBee />
        </div>
      )}
    </main>
    </>
  );
}
