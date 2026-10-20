import type { CSSProperties, ReactNode } from "react";
import { PIX_SPRITES, PIX_STYLE } from "@/lib/pixSprites";

/**
 * Regla de iconos (Luis, 20 oct 2026): en la app los iconos 8-bit son SOLO blancos o negros (el que contraste
 * mejor) sobre un círculo de color; los emojis nativos quedan únicamente en los reportes de las visitas
 * (anillos de categoría, resultados y su texto para compartir).
 * Cada emoji tiene su glifo blanco en public/pix/<códigos hex>.png (sin FE0F, unidos con guiones); el color del
 * círculo y si el glifo va en blanco o negro salen de PIX_STYLE (lib/pixSprites.ts).
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

/** Un emoji como icono 8-bit: glifo blanco/negro sobre círculo de color. `size` en px es el del glifo (el sprite es de 16 px: 16, 24, 32 y 48 se ven nítidos); el círculo mide ~1.35 veces. */
export function Pix({ e, size = 20, className, style }: { e: string; size?: number; className?: string; style?: CSSProperties }) {
  const key = pixKey(e);
  const st = PIX_STYLE[key];
  if (!st) return <>{e}</>;
  const d = Math.round(size * 1.35);
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: d,
        height: d,
        borderRadius: "50%",
        background: st[0],
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/pix/${key}.png`}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ imageRendering: "pixelated", display: "block", filter: st[1] === "k" ? "brightness(0)" : undefined }}
      />
    </span>
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
