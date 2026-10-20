import { requireRole } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import MobileSectionHeader from "@/components/mobile/MobileSectionHeader";
import AspiranteActions from "@/components/admin/AspiranteActions";
import { CUISINES, DISHES } from "@/lib/foodCatalog";

export const dynamic = "force-dynamic";

const label = (opts: { key: string; label: string; emoji: string }[], keys: string[]) =>
  keys.map((k) => opts.find((o) => o.key === k)).filter(Boolean).map((o) => `${o!.emoji} ${o!.label}`).join(" · ");

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

export default async function AspirantesPage() {
  await requireRole("admin");
  const db = getSupabaseServiceClient();
  const { data } = await db.from("shopper_applications").select("*").order("created_at", { ascending: false }).limit(100);
  const inviterIds = [...new Set((data || []).map((a) => a.inviter_id as string | null).filter(Boolean))] as string[];
  const { data: inviters } = inviterIds.length ? await db.from("profiles").select("id, full_name, email").in("id", inviterIds) : { data: [] };
  const inviterName = new Map((inviters || []).map((i) => [i.id as string, (i.full_name as string | null) || (i.email as string)]));
  const pending = (data || []).filter((a) => a.status === "pendiente");
  const reviewed = (data || []).filter((a) => a.status !== "pendiente");

  const Card = ({ a, actions }: { a: Record<string, unknown>; actions: boolean }) => (
    <div className="card mx-5 mb-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold">{a.full_name as string}</div>
          <div className="text-[13px]" style={{ color: "rgba(60,60,67,0.6)" }}>
            {a.city as string}, {a.colonia as string}{a.postal_code ? ` (CP ${a.postal_code as string})` : ""} · {dateFmt(a.created_at as string)}
          </div>
        </div>
        {!actions && (
          <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: a.status === "aprobada" ? "rgba(52,199,89,0.14)" : "rgba(60,60,67,0.1)", color: a.status === "aprobada" ? "#248A3D" : "#6B6B70" }}>
            {a.status === "aprobada" ? "Aprobada" : "Rechazada"}
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-1.5 text-[13.5px]">
        <div><dt className="inline font-semibold">Invitó: </dt><dd className="inline">{(a.inviter_id ? inviterName.get(a.inviter_id as string) : null) ?? "—"}{a.inviter_alias ? ` (${a.inviter_alias as string})` : ""}</dd></div>
        <div><dt className="inline font-semibold">WhatsApp: </dt><dd className="inline"><a href={`https://wa.me/52${(a.whatsapp as string).replace(/\D/g, "").slice(-10)}`} className="underline">{a.whatsapp as string}</a> · {a.email as string}</dd></div>
        <div><dt className="inline font-semibold">Instagram: </dt><dd className="inline"><a href={`https://instagram.com/${a.instagram as string}`} className="underline" target="_blank" rel="noreferrer">@{a.instagram as string}</a></dd></div>
        <div><dt className="inline font-semibold">Experiencia: </dt><dd className="inline">{a.experience_level as string} — {a.experience_text as string}</dd></div>
        <div><dt className="inline font-semibold">Disponibilidad: </dt><dd className="inline">{(a.days as string[]).join(", ")} · {(a.slots as string[]).join(", ")} · {a.has_vehicle ? "con vehículo" : "sin vehículo"}</dd></div>
        <div><dt className="inline font-semibold">Cocinas: </dt><dd className="inline">{label(CUISINES, a.cuisines as string[])}</dd></div>
        <div><dt className="inline font-semibold">Platillos: </dt><dd className="inline">{label(DISHES, a.dishes as string[])}</dd></div>
      </dl>
      {actions && <AspiranteActions id={a.id as string} name={a.full_name as string} />}
    </div>
  );

  return (
    <div className="mf-push-in min-h-screen pb-10" style={{ background: "#F2F2F7" }}>
      <div className="mx-auto max-w-md">
        <MobileSectionHeader backHref="/perfil" backLabel="Perfil" />
        <div className="px-5 pb-3 pt-5">
          <div className="heading text-[30px] font-bold">Aspirantes a Shopper</div>
          <p className="mt-1.5 text-[14px]" style={{ color: "rgba(60,60,67,0.7)" }}>
            Llegaron con el QR de un Sibarita o Master Chef. Al aprobar se crea su cuenta de Shopper (con su nombre anónimo) y le llega su acceso por correo.
          </p>
        </div>
        {pending.length === 0 && (
          <p className="mx-5 mb-4 rounded-[14px] bg-white px-4 py-4 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>No hay solicitudes por aprobar.</p>
        )}
        {pending.map((a) => <Card key={a.id as string} a={a} actions />)}
        {reviewed.length > 0 && (
          <>
            <div className="mx-5 mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>Ya revisadas</div>
            {reviewed.map((a) => <Card key={a.id as string} a={a} actions={false} />)}
          </>
        )}
      </div>
    </div>
  );
}
