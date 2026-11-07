import Image from "next/image";

/**
 * Logo completo de MysterFoodie para el encabezado de las pantallas principales del celular (Inicio, Negocios,
 * Visitas, Perfil). En móvil el AppHeader de escritorio se oculta, así que sin esto el logo nunca aparecía.
 * Va chico y pegado a la izquierda, sobre el título, con su proporción original (sin estirarse ni recortarse).
 */
export default function MobileBrandMark({ className = "mb-1.5" }: { className?: string }) {
  return (
    <Image
      src="/logo-wordmark.png"
      alt="MysterFoodie"
      width={900}
      height={480}
      priority
      className={`h-[34px] w-auto ${className}`}
    />
  );
}
