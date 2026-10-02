import Link from "next/link";
import Image from "next/image";

/**
 * Barra de navegación superior usada dentro de Negocios/Visitas
 * (ver MobileNegocioDetail / MobileVisitDetail) -- se reutiliza aquí para que
 * Usuarios, Automatizaciones y Finanzas tengan la misma navegación en móvil.
 */
export default function MobileSectionHeader({
  backHref,
  backLabel,
}: {
  /** null para mostrar el texto sin link (pantalla sin "regresar"). */
  backHref?: string | null;
  backLabel: string;
}) {
  return (
    <div
      className="flex items-center px-3 py-[14px]"
      style={{ background: "rgba(249,249,251,0.92)", borderBottom: "1px solid rgba(60,60,67,0.1)" }}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="mf-tap -my-2.5 -ml-1 flex flex-1 items-center gap-1 py-2.5 pl-2 pr-4"
          style={{ color: "#F24444" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M15 6l-6 6 6 6" stroke="#F24444" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[16px]">{backLabel}</span>
        </Link>
      ) : (
        <span className="flex-1 py-2.5 pl-2 pr-4 text-[16px] font-semibold">{backLabel}</span>
      )}
      <Link href="/" className="mf-tap -my-2.5 flex items-center py-2.5 pl-2" aria-label="Inicio">
        <Image src="/icon-512.png" alt="" width={26} height={26} className="rounded-md object-contain" />
      </Link>
    </div>
  );
}
