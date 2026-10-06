/**
 * Loader de la marca: el logo (sombrero + lentes) dando su vuelta. El archivo
 * es un WebP animado con fondo transparente (public/loader-logo.webp, 190x217,
 * 2 s por vuelta), así que se ve limpio sobre el gris de la app y sobre blanco.
 *
 * - Con "reducir movimiento" activado en el teléfono se muestra el logo quieto
 *   (loader-logo-static.png) en vez de la animación.
 * - Aparece con un pequeño retraso (.mf-loader-in): si la pantalla carga en un
 *   instante no hay un parpadeo del loader.
 */
const SRC_W = 190;
const SRC_H = 217;

export default function BrandLoader({
  size = 112,
  label = "Cargando…",
  showLabel = true,
}: {
  /** Alto en px con que se muestra (se muestra a ~½ de la resolución del archivo en pantallas retina). */
  size?: number;
  label?: string;
  showLabel?: boolean;
}) {
  const height = size;
  const width = Math.round((size * SRC_W) / SRC_H);

  return (
    <div className="mf-loader-in flex flex-col items-center" role="status" aria-live="polite" aria-label={label}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/loader-logo-static.png" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loader-logo.webp" alt="" width={width} height={height} draggable={false} style={{ width, height }} />
      </picture>
      {showLabel && (
        <div className="mt-1 text-[13.5px] font-semibold" style={{ color: "rgba(60,60,67,0.55)" }}>
          {label}
        </div>
      )}
    </div>
  );
}

/** Capa que cubre toda la pantalla mientras se guarda algo (visita, negocio...). */
export function BrandLoaderOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(242,242,247,0.9)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <BrandLoader label={label} />
    </div>
  );
}
