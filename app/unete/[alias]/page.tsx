import { findProfileBySlug } from "@/lib/aliasStore";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase";
import FlancoCredit from "@/components/FlancoCredit";
import UneteForm from "@/components/unete/UneteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Únete como MysterFoodie Shopper", robots: { index: false, follow: false } };

export default async function UnetePage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias: slug } = await params;
  let inviter: { alias: string | null; role: string } | null = null;
  try {
    const data = await findProfileBySlug(getSupabaseServiceClient(), slug, "alias, role");
    inviter = data ? { alias: data.alias as string | null, role: data.role as string } : null;
  } catch {
    inviter = null;
  }
  if (!inviter || !inviter.alias || !["admin", "sibarita"].includes(inviter.role)) notFound();

  return (
    <main className="min-h-screen pb-12" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md px-5 pt-8">
        <div className="mb-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-wordmark.png" alt="MysterFoodie" className="mx-auto h-auto w-[140px]" />
        </div>
        <UneteForm inviterSlug={slug.toLowerCase()} inviterAlias={inviter.alias} />
        <div className="mt-8 text-center">
          <FlancoCredit />
        </div>
      </div>
    </main>
  );
}
