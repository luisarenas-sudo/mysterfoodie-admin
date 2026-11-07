/**
 * Destacado «Incluye una asesoría gratuita de 20 minutos» del reporte público (va después del botón de pago y Mercado Pago).
 * Se muestra solo si la asesoría está disponible (agendaIncluded). Variante "mobile" = app del celular; "desktop" = página web.
 */
export default function IncludesAdvisory({ variant }: { variant: "mobile" | "desktop" }) {
  if (variant === "mobile") {
    return (
      <div className="mt-4 flex items-center gap-3.5 rounded-[14px] px-3.5 py-3 text-left" style={{ background: "#FFF0EE" }}>
        <div className="shrink-0 rounded-xl px-3 py-2 text-center text-white" style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}>
          <div className="text-[24px] font-bold leading-none">20</div>
          <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide">minutos</div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#F24444" }}>Incluye</div>
          <div className="text-[14.5px] font-bold leading-tight">Asesoría gratuita de 20 minutos</div>
          <div className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>para platicar qué mover primero.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-6 flex max-w-md items-center gap-4 rounded-xl border border-brand-200 bg-white p-4 text-left">
      <div className="shrink-0 rounded-lg bg-brand-gradient px-4 py-2.5 text-center text-white">
        <div className="text-3xl font-bold leading-none">20</div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">minutos</div>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Incluye</p>
        <p className="font-semibold leading-tight text-ink">Asesoría gratuita de 20 minutos</p>
        <p className="mt-0.5 text-sm text-stone-500">para platicar qué mover primero.</p>
      </div>
    </div>
  );
}
