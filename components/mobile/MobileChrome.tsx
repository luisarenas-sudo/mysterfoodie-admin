"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";
import MobileTabBar from "./MobileTabBar";

/**
 * En móvil, "/nueva-visita" y "/negocios/[id]" se presentan como
 * overlays de pantalla completa (con su propio header de flecha
 * "Atrás"), igual que en las maquetas: ahí se oculta el AppHeader y
 * el tab bar de abajo para que ocupen toda la pantalla.
 */
function isOverlayRoute(pathname: string) {
  if (pathname.startsWith("/nueva-visita")) return true;
  if (/^\/negocios\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function HeaderVisibility({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={isOverlayRoute(pathname) ? "hidden md:block" : ""}>{children}</div>;
}

export function MobileChromeBody({
  role,
  children,
}: {
  role: Role | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const overlay = isOverlayRoute(pathname);
  const showTabBar = Boolean(role && (role === "admin" || role === "agente") && !overlay);

  return (
    <>
      <div className={showTabBar ? "pb-24 md:pb-0" : ""}>{children}</div>
      {role && (role === "admin" || role === "agente") && !overlay && <MobileTabBar role={role} />}
    </>
  );
}
