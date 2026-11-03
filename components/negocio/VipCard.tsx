import { Pix } from "@/components/ui/Pix";

/**
 * Celebración para el negocio VIP (tiene un plan o paquete de visitas contratado). Tono «ustedes».
 * Va en Mi negocio, junto a la barra del proceso.
 */
export default function VipCard({ clientName, since, planNames, className = "" }: { clientName: string; since: string | null; planNames: string[]; className?: string }) {
  const desde = since ? new Date(since).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "America/Mexico_City" }) : null;
  return (
    <section className={`overflow-hidden rounded-[22px] ${className}`} style={{ background: "#1C1C1E", color: "#fff" }} aria-label="Negocio VIP">
      <div className="candy candy-is-vip" style={{ display: "block" }} aria-hidden="true">
        <div className="candy-track" style={{ height: 8, borderRadius: 0, background: "#1C1C1E" }}>
          <div className="candy-fill done" style={{ ["--w" as string]: "100%", borderRadius: 0 }} />
        </div>
      </div>
      <div className="p-5">
        <span className="candy-vip" style={{ background: "#F24444" }}><Pix e="⭐" size={14} /> NEGOCIO VIP</span>
        <h2 className="heading mt-3 text-[24px] leading-tight">¡{clientName} ya es VIP!</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
          Gracias por confiar en nosotros: en nuestra metodología, en el equipo de MysterFoodies que los visita y en Flanco Izquierdo®.
          Ser VIP significa que ya no son un primer contacto: son parte de la mesa.
          {desde ? ` Nos acompañan desde ${desde}${planNames.length ? `, con su plan ${planNames.join(" y ")}` : ""}.` : planNames.length ? ` Cuentan con su plan ${planNames.join(" y ")}.` : ""}
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          Si quieren sumar más sucursales o más visitas al mes, escríbannos: con gusto los ayudamos.
        </p>
      </div>
    </section>
  );
}
