/**
 * Crédito/respaldo de Flanco Izquierdo, enlazado a flancoizquierdo.com.
 * Se usa en pantallas públicas donde se lee información importante o
 * se hace un pago/acción (reporte, agenda), para reforzar confianza y
 * veracidad. Un solo lugar para el link -> cambia en un sitio y aplica
 * a toda la app.
 */
export default function FlancoCredit({
  label = "Con el respaldo de Flanco Izquierdo",
  className = "text-[11px]",
  color = "rgba(60,60,67,0.35)",
}: {
  label?: string;
  className?: string;
  color?: string;
}) {
  return (
    <a
      href="https://flancoizquierdo.com/"
      target="_blank"
      rel="noreferrer"
      className={className}
      style={{ color }}
    >
      {label}
    </a>
  );
}
