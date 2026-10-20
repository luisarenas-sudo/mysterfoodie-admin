import { PIXELS } from "@/lib/pixelIcons";

/** Combinaciones de color de la interfaz para los círculos: fondo y trazo opuestos para dar contraste. */
export const PIX_TONES = {
  dark: { bg: "#1C1C1E", fg: "#FFFFFF" },
  red: { bg: "#F24444", fg: "#FFFFFF" },
  purple: { bg: "#5856D6", fg: "#FFFFFF" },
  green: { bg: "#1E8E4E", fg: "#FFFFFF" },
  amber: { bg: "#D97706", fg: "#FFFFFF" },
  soft: { bg: "#F2F2F7", fg: "#1C1C1E" },
  redSoft: { bg: "#FFF0EE", fg: "#F24444" },
  purpleSoft: { bg: "#EEEDFB", fg: "#5856D6" },
} as const;
export type PixTone = keyof typeof PIX_TONES;

/** Icono 8-bit suelto (toma el color del texto). */
export function PixelIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const d = PIXELS[name];
  if (!d) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/** Icono 8-bit dentro de un círculo de color contrario. */
export function PixelBadge({ name, size = 32, tone = "dark", className }: { name: string; size?: number; tone?: PixTone; className?: string }) {
  const t = PIX_TONES[tone];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${className ?? ""}`} style={{ width: size, height: size, background: t.bg, color: t.fg }} aria-hidden="true">
      <PixelIcon name={name} size={Math.round(size * 0.58)} />
    </span>
  );
}
