import Link from "next/link";

/**
 * Breadcrumb de "regresar" para pantallas interiores (un nivel más
 * adentro que la navegación principal) -- mismo patrón visual en toda
 * la app para que la lógica de "cómo regreso" sea siempre la misma,
 * ya sea un negocio, una visita, o una de las herramientas de admin
 * que se abren desde Perfil (Usuarios, Automatizaciones, Finanzas).
 */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-brand-500"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
