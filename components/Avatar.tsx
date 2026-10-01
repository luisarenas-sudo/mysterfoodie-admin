import { initialsFor } from "@/lib/ring";

/**
 * Círculo de avatar del usuario: muestra la foto de perfil (Google, u
 * otra fuente futura) cuando existe `avatarUrl`, o las iniciales del
 * nombre sobre fondo sólido cuando no hay foto. <img> normal (no
 * next/image) porque la URL es externa (lh3.googleusercontent.com) y
 * así evitamos tener que whitelistear dominios en next.config.
 */
export default function Avatar({
  displayName,
  avatarUrl,
  sizeClass = "h-9 w-9 text-sm",
  background = "#1C1C1E",
}: {
  displayName: string;
  avatarUrl?: string | null;
  sizeClass?: string;
  background?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ background }}
    >
      {initialsFor(displayName)}
    </div>
  );
}
