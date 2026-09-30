"use client";

import { useState } from "react";
import { getVerdict } from "@/lib/verdict";
import { CATEGORY_EMOJI } from "@/lib/ring";
import { CATEGORIES, groupCategoryItems, type CategoryItem } from "@/lib/categories";
import type { Ratings } from "@/lib/scoring";
import ActivityRing from "./ActivityRing";

const ACCENT = "#F24444";

function StarsReadonly({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="13" height="13" viewBox="0 0 24 24">
          <path
            d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"
            fill={n <= value ? ACCENT : "rgba(60,60,67,0.15)"}
          />
        </svg>
      ))}
    </div>
  );
}

function ItemValue({
  item,
  ratings,
  flags,
  menuType,
}: {
  item: CategoryItem;
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
}) {
  if (item.type === "star") return <StarsReadonly value={ratings[item.key] || 0} />;
  if (item.type === "boolean") {
    const value = Boolean(flags[item.key]);
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={value ? { background: "rgba(52,199,89,0.14)", color: "#248A3D" } : { background: "rgba(60,60,67,0.08)", color: "rgba(60,60,67,0.55)" }}
      >
        {value ? "Sí" : "No"}
      </span>
    );
  }
  if (item.type === "select" && item.options) {
    const opt = item.options.find((o) => o.value === menuType);
    return <span className="text-[12.5px]" style={{ color: "rgba(60,60,67,0.6)" }}>{opt?.label ?? "—"}</span>;
  }
  return null;
}

function FullDetail({
  ratings,
  flags,
  menuType,
  comments,
}: {
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
  comments: string | null;
}) {
  return (
    <div className="px-5 pb-8 pt-2">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="mb-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.5)" }}>
            <span>{CATEGORY_EMOJI[cat.key] ?? "⭐"}</span>
            {cat.label}
          </div>
          <div className="card overflow-hidden px-4">
            {groupCategoryItems(cat.items).flatMap((block) =>
              block.kind === "standalone"
                ? block.items.map((item) => ({ item, heading: null as string | null }))
                : block.subBlocks.flatMap((sub) =>
                    sub.items.map((item, i) => ({
                      item,
                      heading: i === 0 ? [block.group, sub.subgroup].filter(Boolean).join(": ") : null,
                    }))
                  )
            ).map((row, idx, arr) => (
              <div key={row.item.key}>
                {row.heading && (
                  <div className="pt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.4)" }}>
                    {row.heading}
                  </div>
                )}
                <div
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={idx < arr.length - 1 ? { borderBottom: "1px solid rgba(60,60,67,0.08)" } : undefined}
                >
                  <div className="text-[13.5px]" style={{ color: "rgba(60,60,67,0.8)" }}>
                    {row.item.label}
                  </div>
                  <ItemValue item={row.item} ratings={ratings} flags={flags} menuType={menuType} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {comments && comments.trim() && (
        <div className="card p-4">
          <div className="text-[13px] font-semibold">Comentarios del mystery shopper</div>
          <div className="mt-1.5 whitespace-pre-wrap text-[13.5px]" style={{ color: "rgba(60,60,67,0.7)" }}>
            {comments}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileReportePublico({
  shortCode,
  clientName,
  overallScore,
  categories,
  unlocked,
  price,
  mercadopagoConfigured,
  whatsappFallbackLink,
  paymentStatus,
  ratings,
  flags,
  menuType,
  comments,
}: {
  shortCode: string;
  clientName: string;
  overallScore: number;
  categories: { key: string; label: string; average: number; count: number }[];
  unlocked: boolean;
  price: number;
  mercadopagoConfigured: boolean;
  whatsappFallbackLink: string | null;
  paymentStatus?: string;
  ratings: Ratings;
  flags: Record<string, boolean>;
  menuType: string | null;
  comments: string | null;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const verdict = getVerdict(overallScore);

  const checkoutParams = new URLSearchParams({ shortCode });
  if (nombre.trim()) checkoutParams.set("nombre", nombre.trim());
  if (email.trim()) checkoutParams.set("email", email.trim());
  const checkoutHref = `/api/checkout?${checkoutParams.toString()}`;

  return (
    <div className="md:hidden" style={{ background: "#F2F2F7", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(180deg,#EDEFF7 0%,#F2F2F7 100%)", padding: "28px 24px 22px 24px", textAlign: "center" }}>
        <div className="mb-[18px] flex items-center justify-center gap-1.5">
          <div className="text-[12px] font-bold tracking-[1.4px]" style={{ color: "rgba(60,60,67,0.55)" }}>
            MYSTERFOODIE
          </div>
        </div>
        <div className="mb-1 text-[14px]" style={{ color: "rgba(60,60,67,0.6)" }}>
          Reporte de visita anónima
        </div>
        <div className="heading text-[26px] font-bold leading-tight">{clientName}</div>

        <div className="flex flex-col items-center pb-1 pt-[18px]">
          <ActivityRing value={overallScore} max={5} size={126} strokeWidth={11} color={verdict.color}>
            <div className="text-[32px] font-bold">{overallScore}</div>
            <div className="text-[11px]" style={{ color: "rgba(60,60,67,0.5)" }}>
              de 5.0
            </div>
          </ActivityRing>
          <div
            className="mt-2.5 rounded-[11px] px-3.5 py-1.5 text-[13px] font-bold"
            style={{ color: verdict.color, background: `${verdict.color}1F` }}
          >
            {verdict.label}
          </div>
        </div>
      </div>

      {paymentStatus && (
        <div className="px-5 pt-4">
          {paymentStatus === "exitoso" && (
            <p className="rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(52,199,89,0.1)", color: "#248A3D" }}>
              Pago recibido. Si el detalle completo no aparece todavía, espera unos segundos y recarga la página.
            </p>
          )}
          {paymentStatus === "pendiente" && (
            <p className="rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(255,159,10,0.12)", color: "#B25E00" }}>
              Tu pago está en proceso. En cuanto se confirme, el detalle completo aparecerá aquí.
            </p>
          )}
          {paymentStatus === "fallido" && (
            <p className="rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>
              El pago no se pudo completar. Puedes intentarlo de nuevo abajo.
            </p>
          )}
          {paymentStatus === "error" && (
            <p className="rounded-[14px] px-4 py-3 text-[13.5px] font-medium" style={{ background: "rgba(255,59,48,0.1)", color: "#C7301E" }}>
              Hubo un problema al iniciar el pago. Intenta de nuevo en unos minutos.
            </p>
          )}
        </div>
      )}

      <div className="px-5 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((c) => (
            <div key={c.key} className="card flex items-center gap-2.5 p-3.5">
              <ActivityRing value={c.average} max={5} size={42} strokeWidth={6} color={verdict.color} trackColor="rgba(60,60,67,0.1)">
                <div className="text-[16px]">{CATEGORY_EMOJI[c.key] ?? "⭐"}</div>
              </ActivityRing>
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold">{c.label}</div>
                <div className="text-[17px] font-bold">{c.average}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {unlocked ? (
        <FullDetail ratings={ratings} flags={flags} menuType={menuType} comments={comments} />
      ) : (
        <>
          <div className="px-6 pb-1.5 pt-7 text-center">
            <div className="mb-1.5 text-[21px] font-bold">Obtén el reporte completo</div>
            <div className="text-[14px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>
              Más de <span className="font-bold" style={{ color: "rgba(60,60,67,0.85)" }}>40 indicadores</span> detallados:
              tiempos de atención, presentación, limpieza por zona y las recomendaciones de nuestro Myster Foodie.
            </div>
          </div>

          <div className="card mx-5 mt-4 p-[22px]">
            <div className="mb-4 flex items-baseline justify-center gap-1">
              <div className="text-[15px]" style={{ color: "rgba(60,60,67,0.5)" }}>$</div>
              <div className="text-[34px] font-bold">{price.toLocaleString("es-MX")}</div>
              <div className="text-[14px]" style={{ color: "rgba(60,60,67,0.5)" }}>MXN</div>
            </div>

            <div className="mb-2.5 rounded-xl px-3.5" style={{ background: "#F2F2F7" }}>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full bg-transparent py-3 text-[15px] outline-none"
              />
            </div>
            <div className="mb-4 rounded-xl px-3.5" style={{ background: "#F2F2F7" }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu correo electrónico"
                type="email"
                className="w-full bg-transparent py-3 text-[15px] outline-none"
              />
            </div>

            {mercadopagoConfigured ? (
              <a
                href={checkoutHref}
                className="block rounded-[14px] py-[15px] text-center text-[16px] font-bold text-white"
                style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}
              >
                Comprar reporte completo
              </a>
            ) : whatsappFallbackLink ? (
              <a
                href={whatsappFallbackLink}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[14px] py-[15px] text-center text-[16px] font-bold text-white"
                style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}
              >
                Solicitar el reporte completo
              </a>
            ) : (
              <p className="text-center text-[13.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
                Para solicitar el reporte completo, contacta a MysterFoodie.
              </p>
            )}

            {mercadopagoConfigured && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {["VISA", "MASTERCARD", "AMEX"].map((brand) => (
                    <div key={brand} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "#F2F2F7" }}>
                      <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
                        <rect x="0.5" y="0.5" width="17" height="12" rx="2" stroke="rgba(60,60,67,0.45)" />
                        <rect x="0.5" y="3.4" width="17" height="2.2" fill="rgba(60,60,67,0.45)" />
                      </svg>
                      <div className="text-[10px] font-bold tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
                        {brand}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                    <rect x="1" y="6" width="10" height="7" rx="1.5" stroke="rgba(60,60,67,0.5)" strokeWidth="1.1" />
                    <path d="M3.2 6V4C3.2 2.4 4.4 1.2 6 1.2C7.6 1.2 8.8 2.4 8.8 4V6" stroke="rgba(60,60,67,0.5)" strokeWidth="1.1" fill="none" />
                  </svg>
                  <div className="text-[11.5px] font-semibold" style={{ color: "rgba(60,60,67,0.55)" }}>
                    Pago seguro
                  </div>
                </div>
              </>
            )}
          </div>

          {whatsappFallbackLink && mercadopagoConfigured && (
            <a
              href={whatsappFallbackLink}
              target="_blank"
              rel="noreferrer"
              className="mx-5 mt-3 block rounded-[14px] py-3.5 text-center text-[14.5px] font-semibold"
              style={{ background: "rgba(52,199,89,0.1)", color: "#248A3D" }}
            >
              Prefiero preguntar por WhatsApp
            </a>
          )}

          <div className="px-6 pb-9 pt-7 text-center">
            <div className="text-[12px] leading-snug" style={{ color: "rgba(60,60,67,0.45)" }}>
              El costo de este reporte retribuye a nuestros Myster Foodies, quienes visitan el negocio de forma anónima y pagan su cuenta con propina incluida.
            </div>
            <div className="mt-3.5 text-[11px]" style={{ color: "rgba(60,60,67,0.35)" }}>
              Con el respaldo de Flanco Izquierdo
            </div>
          </div>
        </>
      )}
    </div>
  );
}
