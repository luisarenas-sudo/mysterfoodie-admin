import { Pix } from "@/components/ui/Pix";
import AspiranteActions from "@/components/admin/AspiranteActions";
import { CUISINES, DISHES } from "@/lib/foodCatalog";

const label = (opts: { key: string; label: string; emoji: string }[], keys: string[]) =>
  keys.map((k) => opts.find((o) => o.key === k)).filter(Boolean).map((o, i) => (
    <span key={o!.key}>{i > 0 && " · "}<Pix e={o!.emoji} size={16} /> {o!.label}</span>
  ));

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

function Card({ a, actions, inviterName }: { a: Record<string, unknown>; actions: boolean; inviterName: Record<string, string> }) {
  return (
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
        <div><dt className="inline font-semibold">Invitó: </dt><dd className="inline">{(a.inviter_id ? inviterName[a.inviter_id as string] : null) ?? "—"}{a.inviter_alias ? ` (${a.inviter_alias as string})` : ""}</dd></div>
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
}

/** Solicitudes que llegaron con un QR: por aprobar arriba, ya revisadas abajo. */
export default function AspirantesList({ applications, inviterName }: { applications: Record<string, unknown>[]; inviterName: Record<string, string> }) {
  const pending = applications.filter((a) => a.status === "pendiente");
  const reviewed = applications.filter((a) => a.status !== "pendiente");
  return (
    <>
      <p className="mb-3 px-5 text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.7)" }}>
        Llegaron con el QR de un Sibarita o Master Chef. Al aprobar se crea su cuenta de Shopper y le llega su acceso por correo. Su nombre anónimo lo elige la persona al entrar (3 intentos y queda fijo).
      </p>
      {pending.length === 0 && (
        <p className="mx-5 mb-4 rounded-[14px] bg-white px-4 py-4 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>No hay solicitudes por aprobar.</p>
      )}
      {pending.map((a) => <Card key={a.id as string} a={a} actions inviterName={inviterName} />)}
      {reviewed.length > 0 && (
        <>
          <div className="mx-5 mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>Ya revisadas</div>
          {reviewed.map((a) => <Card key={a.id as string} a={a} actions={false} inviterName={inviterName} />)}
        </>
      )}
    </>
  );
}
