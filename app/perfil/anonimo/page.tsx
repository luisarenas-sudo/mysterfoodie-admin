import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import AnonProfileForm from "@/components/perfil/AnonProfileForm";
import { isBlockKey, sanitizePersona } from "@/lib/personaCatalog";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

export default async function PerfilAnonimoPage() {
  const me = await requireRole("admin", "sibarita", "agente");
  const db = getSupabaseServiceClient();
  const [{ data }, { count }, { data: earn }] = await Promise.all([
    db.from("profiles").select("postal_code, food_cuisines, food_dishes, persona, share_blocks").eq("id", me.userId).maybeSingle(),
    db.from("forms").select("id", { count: "exact", head: true }).eq("created_by", me.userId),
    db.from("profile_earnings").select("amount, status").eq("mysterfoodie_id", me.userId),
  ]);
  const pending = (earn ?? []).filter((e) => e.status === "pendiente").reduce((a, e) => a + Number(e.amount), 0);
  const paid = (earn ?? []).filter((e) => e.status === "pagado").reduce((a, e) => a + Number(e.amount), 0);
  return (
    <div className="mf-push-in min-h-screen" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md pb-10 md:max-w-2xl">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-2 pt-5">
          <div className="heading text-[30px] font-bold">Mi perfil anónimo</div>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
            Los negocios que te visiten pueden comprar un perfil con tu nombre anónimo: gustos, hábitos y, en el nivel 👑 Passport, tu estilo de vida
            y datos demográficos en rangos. Tú decides si compartes el nivel 🪪 ID, el 👑 Passport o los dos, y te llevas el 50% del precio de cada venta, repartido entre sus secciones (el cargo por uso de la plataforma lo paga el negocio aparte). Nunca ven tu nombre, foto,
            contacto ni documentos.
          </p>
          <Link
            href="/perfil/anonimo/vista-negocio"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5"
            style={{ boxShadow: "inset 0 0 0 1.5px #E3E3E8" }}
          >
            <span className="flex items-center gap-3">
              <span aria-hidden="true" className="text-[22px]">👁️</span>
              <span>
                <span className="block text-[15px] font-bold">Vista del negocio</span>
                <span className="block text-[12.5px]" style={{ color: "rgba(60,60,67,0.7)" }}>Mira tu perfil como lo ve quien compra ID o Passport</span>
              </span>
            </span>
            <span aria-hidden="true" className="text-[20px]" style={{ color: "rgba(60,60,67,0.4)" }}>›</span>
          </Link>
          {(pending > 0 || paid > 0) && (
            <div className="mt-3 flex gap-2.5">
              <div className="flex-1 rounded-2xl bg-white p-3"><div className="text-[11.5px] font-semibold text-stone-500">Por cobrar</div><div className="text-[20px] font-extrabold">{money(pending)}</div></div>
              <div className="flex-1 rounded-2xl bg-white p-3"><div className="text-[11.5px] font-semibold text-stone-500">Ya pagado</div><div className="text-[20px] font-extrabold">{money(paid)}</div></div>
            </div>
          )}
        </div>
        <div className="px-5 pt-3">
          <AnonProfileForm
            visits={count ?? 0}
            initial={{
              postalCode: data?.postal_code ?? "",
              cuisines: data?.food_cuisines ?? [],
              dishes: data?.food_dishes ?? [],
              persona: sanitizePersona(data?.persona),
              shared: ((data?.share_blocks as unknown[]) ?? []).filter(isBlockKey),
            }}
          />
        </div>
      </div>
    </div>
  );
}
