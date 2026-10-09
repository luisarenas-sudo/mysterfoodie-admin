import { requireRole } from "@/lib/auth";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import SeguridadForm from "@/components/perfil/SeguridadForm";
import ConnectGoogleButton from "@/components/auth/ConnectGoogleButton";
import { Group, Row } from "@/components/perfil/ListRow";

export const dynamic = "force-dynamic";

const GOOGLE_G = (
  <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
  </svg>
);

export default async function SeguridadPage() {
  const profile = await requireRole("admin", "agente", "sibarita", "cliente");
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-4 pt-5">
          <div className="heading text-[30px] font-bold">Contraseña y acceso</div>
        </div>

        <Group title="Cómo entras">
          <Row icon="✉️" iconBg="#34C759" title="Correo" detail={profile.email} last={false} />
          {profile.hasGoogleIdentity ? (
            <Row icon={GOOGLE_G} iconBg="#fff" title="Google" detail="Conectada ✓" last />
          ) : (
            <div className="px-4 py-3.5">
              <p className="mb-3 text-[13px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>
                Conecta tu cuenta de Google para entrar con un toque.
              </p>
              <ConnectGoogleButton />
            </div>
          )}
        </Group>

        <SeguridadForm email={profile.email} />
      </div>
    </div>
  );
}
