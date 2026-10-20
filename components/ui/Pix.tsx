import type { CSSProperties, ReactNode } from "react";
import { PIX_SPRITES } from "@/lib/pixSprites";

/**
 * Regla de iconos: en toda la interfaz se usan iconos 8-bit; los emojis nativos quedan solo en los
 * resultados de visita (anillos de categoría, reportes y su texto para compartir).
 * Cada emoji tiene su sprite en public/pix/<códigos hex>.png (sin FE0F, unidos con guiones).
 */
export function pixKey(e: string): string {
  return Array.from(e)
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join("-");
}

export function hasPix(e: string): boolean {
  return PIX_SPRITES.has(pixKey(e));
}

const IMG_STYLE: CSSProperties = { imageRendering: "pixelated", display: "inline-block", verticalAlign: "-0.2em", flexShrink: 0 };

/** Un emoji como sprite 8-bit. `size` en px (el sprite es de 16 px: 16, 24, 32, 48 se ven nítidos). */
export function Pix({ e, size = 20, className, style }: { e: string; size?: number; className?: string; style?: CSSProperties }) {
  if (!hasPix(e)) return <>{e}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/pix/${pixKey(e)}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ ...IMG_STYLE, ...style }}
    />
  );
}

const EMOJI_RE = /(?:\p{Regional_Indicator}{2})|\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*(?:‍\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*)*/gu;

/** Texto con emojis incrustados: cada emoji sale como sprite (16 px por defecto). */
export function PixText({ children, size = 16 }: { children: string; size?: number }) {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of children.matchAll(EMOJI_RE)) {
    const i = m.index ?? 0;
    if (!hasPix(m[0])) continue;
    if (i > last) out.push(children.slice(last, i));
    out.push(<Pix key={n++} e={m[0]} size={size} />);
    last = i + m[0].length;
  }
  if (last < children.length) out.push(children.slice(last));
  return <>{out}</>;
}

/** Quita los emojis de un texto (para atributos como title o aria-label, que no admiten imágenes). */
export function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}
