/**
 * Demo GRATIS: el negocio recibe el reporte completo sin pasar por Mercado Pago. Un solo botón grande
 * descarga el PDF (mismo reporte que se manda por correo, con la marca de agua GRATIS).
 */
export default function FreeReportDownload({ shortCode, variant }: { shortCode: string; variant: "mobile" | "desktop" }) {
  const href = `/r/${shortCode}/pdf`;
  if (variant === "mobile") {
    return (
      <div className="card mx-5 mt-4 p-[22px] text-center">
        <div className="text-[28px]" aria-hidden="true">🎁</div>
        <div className="mt-1 text-[17px] font-bold leading-snug">Su reporte completo, de regalo</div>
        <div className="mb-4 mt-1 text-[13.5px] leading-snug" style={{ color: "rgba(60,60,67,0.6)" }}>
          Sin pagos ni pasos extra. Abajo también pueden verlo en línea.
        </div>
        <a
          href={href}
          className="mf-tap block rounded-[14px] px-4 py-[18px] text-center text-[18px] font-bold leading-tight text-white"
          style={{ background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)" }}
        >
          Descarga GRATIS tu reporte aquí
        </a>
      </div>
    );
  }
  return (
    <section className="mt-6 rounded-lg border border-brand-100 bg-brand-50 p-8 text-center">
      <p className="text-3xl" aria-hidden="true">🎁</p>
      <p className="heading mt-1 text-xl text-ink">Su reporte completo, de regalo</p>
      <p className="mt-1 text-sm text-stone-600">Sin pagos ni pasos extra. Más abajo también pueden verlo en línea.</p>
      <a
        href={href}
        className="mt-5 inline-block rounded-md bg-brand-gradient px-8 py-4 text-lg font-bold text-white hover:opacity-90"
      >
        Descarga GRATIS tu reporte aquí
      </a>
    </section>
  );
}
