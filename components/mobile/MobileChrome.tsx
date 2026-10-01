"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";
import MobileTabBar from "./MobileTabBar";

/**
 * En móvil, solo "/nueva-visita" (el cuestionario de la visita) se
 * presenta como overlay de pantalla completa sin el tab bar de abajo:
 * ahí hay que priorizar la visibilidad de las preguntas. El detalle de
 * un negocio y el de un reporte/visita puntual SÍ mantienen el dock de
 * navegación (tienen su propio header con flecha "Atrás" + logo de
 * inicio, pero no son overlays de pantalla completa).
 */
function isOverlayRoute(pathname: string) {
  if (pathname.startsWith("/nueva-visita")) return true;
  return false;
}

/**
 * Para cualquier rol con sesión (admin/agente/sibarita/cliente), todas
 * las pantallas móviles tienen su propio encabezado (título + tab bar
 * abajo), así que el AppHeader de escritorio (barra negra con nav) se
 * oculta en móvil siempre que haya sesión, igual que en las maquetas
 * (pantallas de app nativa, sin chrome de navegador).
 */
export function HeaderVisibility({
  role,
  children,
}: {
  role: Role | null;
  children: React.ReactNode;
}) {
  const hideOnMobile = Boolean(role);
  return <div className={hideOnMobile ? "hidden md:block" : ""}>{children}</div>;
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
  const showTabBar = Boolean(role && !overlay);

  return (
    <>
      <div className={showTabBar ? "pb-24 md:pb-0" : ""}>{children}</div>
      {role && !overlay && <MobileTabBar role={role} />}
    </>
  );
}
