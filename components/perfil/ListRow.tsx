import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Piezas de las listas agrupadas estilo iOS (Ajustes) que usa Perfil:
 * <Group> es la tarjeta con esquinas redondeadas y <Row> cada renglón, de
 * mínimo 56 px de alto para que se toque cómodo con el dedo.
 */
export function Group({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-5 mb-6">
      {title && (
        <div className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(60,60,67,0.6)" }}>
          {title}
        </div>
      )}
      <div className="card overflow-hidden">{children}</div>
      {footer && (
        <div className="mt-1.5 px-1 text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
          {footer}
        </div>
      )}
    </section>
  );
}

const CHEVRON = (
  <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="rgba(60,60,67,0.3)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Row({
  href,
  icon,
  iconBg = "#8E8E93",
  title,
  detail,
  subtitle,
  last = false,
  trailing,
}: {
  href?: string;
  icon?: ReactNode;
  iconBg?: string;
  title: string;
  /** Valor corto a la derecha ("Conectada", "3 visitas"). */
  detail?: ReactNode;
  /** Renglón de apoyo debajo del título. */
  subtitle?: string;
  last?: boolean;
  /** Reemplaza al detalle/chevron (por ejemplo un botón). */
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <span
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] text-[18px] leading-none"
          style={{ background: iconBg }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "rgba(60,60,67,0.55)" }}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing ?? (
        <>
          {detail && (
            <span className="flex-shrink-0 text-[14.5px]" style={{ color: "rgba(60,60,67,0.55)" }}>
              {detail}
            </span>
          )}
          {href && CHEVRON}
        </>
      )}
    </>
  );
  const cls = "flex min-h-[56px] items-center gap-3 px-4 py-2.5";
  const style = last ? undefined : { borderBottom: "1px solid rgba(60,60,67,0.08)" };
  return href ? (
    <Link href={href} className={`${cls} mf-tap active:bg-black/5`} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
