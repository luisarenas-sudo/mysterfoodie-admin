import type { CSSProperties } from "react";

/**
 * Regla de iconos (Luis, 20 oct 2026): en la app (web y móvil) se usan EMOJIS nativos; nada de iconos 8-bit
 * (esos viven solo en el sitio mysterfoodie.com). Este componente se conserva como envoltorio sencillo para no
 * tocar cada pantalla: dibuja el emoji con el tamaño pedido.
 */
export function Pix({ e, size = 20, className, style }: { e: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: "inline-block", fontSize: Math.round(size * 0.9), lineHeight: 1, verticalAlign: "-0.1em", ...style }}
    >
      {e}
    </span>
  );
}

/** Texto con emojis: se muestra tal cual (ya no se convierten a iconos 8-bit). */
export function PixText({ children }: { children: string; size?: number }) {
  return <>{children}</>;
}

/** Quita los emojis de un texto (para atributos como title o aria-label). */
export function stripEmoji(s: string): string {
  return s.replace(/(?:\p{Regional_Indicator}{2})|\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*(?:‍\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*)*/gu, "").replace(/\s{2,}/g, " ").trim();
}
