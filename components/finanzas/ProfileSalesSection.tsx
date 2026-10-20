import Link from "next/link";
import { formatMxn } from "@/lib/earningsMatrix";
import { MYSTERFOODIE_SHARE_PCT, PLATFORM_FEE_PCT } from "@/lib/personaCatalog";
import type { ProfileSale } from "@/lib/profileSales";

const MUTED = "rgba(60,60,67,0.6)";
const when = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(iso));
const tierLabel = (t: ProfileSale["tier"]) => (t === "passport" ? "Perfil Passport" : t === "id" ? "Perfil ID" : "Perfil anónimo");

/** Detalle mensual de las ventas del perfil anónimo de un MysterFoodie: precio, cargo por uso de la plataforma y su parte, bloque por bloque. */
export function ProfileSalesPersonal({ sales }: { sales: ProfileSale[] }) {
  const total = sales.reduce((a, s) => a + s.share, 0);
  return (
    <>
      <div className="mb-1.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Tu perfil anónimo vendido
      </div>
      <div className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[14px]">
            {sales.length} {sales.length === 1 ? "venta" : "ventas"} del mes
          </div>
          <div className="text-[22px] font-bold text-brand-500">{formatMxn(total)}</div>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug" style={{ color: MUTED }}>
          Cuando un negocio compra tu perfil, te llevas el {MYSTERFOODIE_SHARE_PCT}% del precio, repartido entre los bloques que compartes. El negocio paga además un {PLATFORM_FEE_PCT}% de cargo por uso de la plataforma que no se te descuenta.
        </p>
      </div>
      {sales.length === 0 && (
        <p className="mt-3 px-1 text-[13px] leading-snug" style={{ color: MUTED }}>
          Aún no hay ventas de tu perfil este mes. Cuantos más bloques compartas en{" "}
          <Link href="/perfil/anonimo" className="font-semibold text-brand-500">Mi perfil anónimo</Link>, más información puede comprar un negocio.
        </p>
      )}
      {sales.length > 0 && (
        <div className="card mt-3 overflow-hidden">
          {sales.map((s, idx) => (
            <div key={s.id} className="px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid rgba(60,60,67,0.08)" : undefined }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{s.negocio}</div>
                  <div className="text-[12px]" style={{ color: MUTED }}>
                    {when(s.soldAt)} · {tierLabel(s.tier)} · {s.status === "pagado" ? "Pagado" : "Por pagar"}
                  </div>
                </div>
                <div className="text-[15px] font-bold">{formatMxn(s.share)}</div>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed" style={{ color: MUTED }}>
                {s.price !== null ? <>Precio del perfil {formatMxn(s.price)} · cargo por uso de la plataforma (lo paga el negocio) {formatMxn(s.fee)}<br /></> : null}
                {s.blocks.map((b) => `${b.label} ${formatMxn(b.amount)}`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Resumen del Master Chef: cuánto se cobró, cuánto es cargo de plataforma y cuánto es de los MysterFoodies. */
export function ProfileSalesAdmin({ sales, names }: { sales: ProfileSale[]; names: Map<string, string> }) {
  // Las ventas anteriores al cargo por uso de la plataforma no tienen precio registrado: se listan aparte para que las sumas cuadren.
  const known = sales.filter((s) => s.price !== null);
  const legacy = sales.filter((s) => s.price === null);
  const price = known.reduce((a, s) => a + (s.price ?? 0), 0);
  const fee = known.reduce((a, s) => a + s.fee, 0);
  const shares = known.reduce((a, s) => a + s.share, 0);
  const legacyShares = legacy.reduce((a, s) => a + s.share, 0);
  const by = new Map<string, { n: number; total: number }>();
  for (const s of sales) {
    const r = by.get(s.mysterfoodieId) ?? { n: 0, total: 0 };
    r.n += 1;
    r.total += s.share;
    by.set(s.mysterfoodieId, r);
  }
  return (
    <>
      <div className="mb-1.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Perfiles anónimos vendidos
      </div>
      <div className="card p-5">
        {sales.length === 0 ? (
          <p className="text-[14px]" style={{ color: MUTED }}>Todavía no hay ventas de perfiles este mes.</p>
        ) : (
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between"><span>Ventas ({known.length})</span><span className="font-semibold">{formatMxn(price)}</span></div>
            <div className="flex justify-between"><span>+ Cargo por uso de la plataforma ({PLATFORM_FEE_PCT}%)</span><span className="font-semibold">{formatMxn(fee)}</span></div>
            <div className="flex justify-between" style={{ color: MUTED }}><span>− Parte de los MysterFoodies ({MYSTERFOODIE_SHARE_PCT}% del precio si comparten todo)</span><span>−{formatMxn(shares)}</span></div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-[15px] font-bold"><span>Para la plataforma</span><span>{formatMxn(price + fee - shares)}</span></div>
            {legacy.length > 0 && (
              <p className="pt-1 text-[12px]" style={{ color: MUTED }}>
                Además, {legacy.length} {legacy.length === 1 ? "venta anterior" : "ventas anteriores"} al cargo por uso de la plataforma (sin precio registrado): parte de los MysterFoodies {formatMxn(legacyShares)}.
              </p>
            )}
          </div>
        )}
        {by.size > 0 && (
          <ul className="mt-3 space-y-0.5 text-[12.5px]" style={{ color: MUTED }}>
            {[...by.entries()].map(([id, v]) => (
              <li key={id}>{names.get(id) ?? "MysterFoodie"} · {v.n} {v.n === 1 ? "venta" : "ventas"} · {formatMxn(v.total)}</li>
            ))}
          </ul>
        )}
        <Link href="/admin/ganancias-perfil" className="mt-3 inline-block text-[13px] font-semibold text-brand-500">Ver pagos pendientes →</Link>
      </div>
    </>
  );
}
