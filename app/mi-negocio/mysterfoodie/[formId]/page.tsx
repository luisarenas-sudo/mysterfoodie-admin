import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildMysterfoodieProfile, MYSTERFOODIE_PROFILE_PRICE_MXN } from "@/lib/mysterfoodieProfile";
import { hasPurchasedProfile } from "@/lib/profilePurchases";
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
  const purchased = await hasPurchasedProfile(me.clientId, form.created_by);
  const profile = await buildMysterfoodieProfile(form.created_by);
  if (!profile) notFound();

  const aviso = pago ? AVISOS[pago] : null;
  const tone = { ok: ["#E8F7EE", "#1E8E4E"], warn: ["#FFF6E0", "#9A6A00"], bad: ["rgba(255,59,48,0.1)", "#C7301E"] };

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
      <div className="mt-4">
        {purchased ? (
          <MysterfoodieProfileView profile={profile} />
        ) : (
          <div className="card p-6">
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>
              {profile.rankLabel} · perfil anónimo
            </p>
            <h1 className="heading mt-1 text-3xl text-ink">{profile.alias}</h1>
            <p className="mt-2 text-[15px] text-stone-600">
              Conoce a la persona que evaluó tu negocio, sin nombre ni datos personales: cómo reseña, qué le gusta comer, con
              cuántas personas sale, cuánto consume y de qué sector viene.
            </p>
            <ul className="mt-4 space-y-1.5 text-[14px] text-stone-700">
              <li>• Las palabras que más usa en sus reseñas</li>
              <li>• Sus gustos de cocina y platillos</li>
              <li>• Con cuántas personas suele salir</li>
              <li>• Totales de sus cuentas y cuenta promedio</li>
              <li>• Sector que representa y por dónde consume</li>
            </ul>
            {unlocked ? (
              <>
                <a
                  href={`/api/mi-negocio/perfil/checkout?formId=${form.id}`}
                  className="mt-6 flex w-full items-center justify-center rounded-2xl py-4 text-[16px] font-bold text-white"
                  style={{ background: "#F24444" }}
                >
                  Comprar perfil completo · ${MYSTERFOODIE_PROFILE_PRICE_MXN} MXN + IVA
                </a>
                <p className="mt-2 text-center text-[12px] text-stone-400">Pago único con MercadoPago. El perfil queda disponible en tu cuenta.</p>
              </>
            ) : (
              <p className="mt-6 rounded-xl px-4 py-3 text-[14px]" style={{ background: "#F2F2F7" }}>
                El perfil está disponible para visitas con reporte completo. Desbloquea primero el reporte de esta visita.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
