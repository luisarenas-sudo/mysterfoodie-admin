import { getSessionProfile } from "@/lib/auth";
import { getHomeSummary, getReyNegocio } from "@/lib/dashboard";
import MobileHome from "@/components/mobile/MobileHome";
import DesktopWizard from "@/components/wizard/DesktopWizard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getSessionProfile();
  const scope = profile?.role === "agente" && profile.userId ? { agentId: profile.userId } : {};

  const [stats, rey] = await Promise.all([getHomeSummary(scope), getReyNegocio()]);
  const displayName = profile?.fullName || profile?.email || "MysterFoodie";

  return (
    <>
      <MobileHome displayName={displayName} stats={stats} rey={rey} />
      <div className="hidden md:block">
        <DesktopWizard />
      </div>
    </>
  );
}
