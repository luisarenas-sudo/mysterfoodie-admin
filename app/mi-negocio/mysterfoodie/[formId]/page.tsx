import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildMysterfoodieProfile, getProfileOffer } from "@/lib/mysterfoodieProfile";
import { BLOCKS_OF_TIER, PERFIL_PITCH, PERFIL_PITCH_TITLE, TIERS, type TierKey } from "@/lib/personaCatalog";
import { getOwnedTiers, highestTier, priceFor } from "@/lib/profilePurchases";
import MysterfoodieProfileView from "@/components/negocio/MysterfoodieProfileView";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  exitoso: { text: "¡Pago recibido! Si el perfil aún no aparece, recarga en un minuto: MercadoPago nos avisa en segundos.", tone: "ok" },
  pendiente: { text: "Tu pago está pendiente. En cuanto se acredite, el perfil se desbloquea solo.", tone: "warn" },
  fallido: { text: "El pago no se completó. No se hizo ningún cargo; puedes intentarlo de nuevo.", tone: "bad" },
  error: { text: "No pudimos iniciar el pago. Intenta de nuevo o escríbenos a hola@mysterfoodie.com.", tone: "bad" },
};

export default async function PerfilMysterfoodiePage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { formId } = await params;
  const { pago } = await searchParams;
  const me = await requireRole("cliente");
  if (!me.clientId) notFound();

  const db = getSupabaseServiceClient();
  const { data: form } = await db
    .from("forms")
    .select("id, client_id, created_by, report_unlocked_at, plan_id")
    .eq("id", formId)
    .maybeSingle();
  if (!form || form.client_id !== me.clientId || !form.created_by) notFound();

  const unlocked = Boolean(form.report_unlocked_at || form.plan_id);
  const owned = await getOwnedTiers(me.clientId, form.created_by);
  const best = highestTier(owned);
  const offer = await getProfileOffer(form.created_by);
  if (!offer || !offer.idAvailable) notFound();

  const profile = best ? await buildMysterfoodieProfile(form.created_by, { tier: best }) : null;

  const aviso = pago ? AVISOS[pago] : null;
  const tone = { ok: ["#E8F7EE", "#1E8E4E"], warn: ["#FFF6E0", "#9A6A00"], bad: ["rgba(255,59,48,0.1)", "#C7301E"] };

  const buy = (tier: TierKey, label: string) => (
    <a
      href={`/api/mi-negocio/perfil/checkout?formId=${form.id}&tier=${tier}`}
      className="flex w-full items-center justify-center rounded-2xl py-4 text-[16px] font-bold text-white"
      style={{ background: "#F24444" }}
    >
      {label}
    </a>
  );

  const tierCard = (tier: TierKey, available: boolean, price: number, note?: string) => (
    <div className="rounded-2xl p-4" style={{ border: "1.5px solid rgba(60,60,67,0.12)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="heading text-[22px]">{TIERS[tier].label}</h2>
        <div className="text-[18px] font-extrabold" style={{ color: "#F24444" }}>
          ${price} <span className="text-[12px] font-semibold text-stone-500">MXN + IVA</span>
        </div>
      </div>
      <p className="mt-1 text-[13.5px] text-stone-600">{TIERS[tier].tagline}</p>
      <ul className="mt-2 space-y-1 text-[13.5px] text-stone-700">
        {BLOCKS_OF_TIER(tier === "passport" ? "passport" : "id").map((b) => (
          <li key={b.key}>• <strong>{b.label}:</strong> {b.desc}</li>
        ))}
        {tier === "passport" && <li>• Incluye todo el nivel ID.</li>}
      </ul>
      {note && <p className="mt-2 text-[12.5px] text-stone-500">{note}</p>}
      <div className="mt-3">
        {!unlocked ? (
          <p className="rounded-xl px-3.5 py-3 text-[13.5px]" style={{ background: "#F2F2F7" }}>
            Disponible para visitas con reporte completo. Desbloquea primero el reporte de esta visita.
          </p>
        ) : available ? (
          buy(tier, `${tier === "passport" && owned.has("id") ? "Mejorar a Passport" : `Destapar ${TIERS[tier].label}`} · $${price} MXN + IVA`)
        ) : (
          <p className="rounded-xl px-3.5 py-3 text-[13.5px]" style={{ background: "#F2F2F7" }}>
            Este MysterFoodie aún no comparte suficiente información para este nivel.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <Link href="/mi-negocio" className="text-sm font-semibold" style={{ color: "#F24444" }}>
        ← Mi negocio
      </Link>
      {aviso && (
        <p className="mt-3 rounded-xl px-4 py-3 text-[14px] font-medium" style={{ background: tone[aviso.tone][0], color: tone[aviso.tone][1] }}>
          {aviso.text}
        </p>
      )}
      <div className="mt-4 space-y-3.5">
        {profile && <MysterfoodieProfileView profile={profile} />}

        {best !== "passport" && (
          <div className="card p-5">
            {!best && (
              <>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
                  {offer.rankLabel} · perfil anónimo
                </p>
                <h1 className="heading mt-1 text-3xl text-ink">{offer.alias}</h1>
              </>
            )}
            <h2 className={best ? "heading text-[22px]" : "heading mt-4 text-[20px]"}>{PERFIL_PITCH_TITLE}</h2>
            <p className="mt-1 text-[14.5px] text-stone-600">{PERFIL_PITCH}</p>
            <div className="mt-4 space-y-3">
              {!best && tierCard("id", offer.idAvailable, priceFor("id", owned))}
              {tierCard("passport", offer.passportAvailable, priceFor("passport", owned), owned.has("id") ? "Ya pagaste el nivel ID: la mejora solo cobra la diferencia." : undefined)}
            </div>
            <p className="mt-3 text-center text-[12px] text-stone-400">
              Pago único con MercadoPago. Cada MysterFoodie decide qué comparte: solo ves lo que él autorizó, siempre de forma anónima.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
