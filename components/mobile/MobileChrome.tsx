"use client";

import { useEffect } from "react";
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

/**
 * Como la app corre "Añadida a Inicio" (modo standalone, sin la barra
 * de Safari), si iOS llega a hacer zoom automático al enfocar un
 * input, no hay forma de que la persona lo quite con el gesto normal
 * (no hay chrome de navegador ni doble-tap para reset) y el zoom se
 * queda pegado en TODAS las pantallas de ahí en adelante.
 *
 * El font-size >= 16px en los campos (ver globals.css) debería evitar
 * que ese zoom se dispare, pero en standalone iOS a veces igual ocurre
 * (p. ej. si el campo se enfoca mientras la pantalla todavía está en
 * la animación de entrada). Esta protección adicional sube
 * `maximum-scale=1` en el <meta name="viewport"> SOLO mientras hay un
 * campo de texto enfocado -- eso evita que WebKit pueda hacer zoom al
 * enfocar y, de paso, fuerza a WebKit a recalcular el viewport y
 * "soltar" cualquier zoom que ya se hubiera quedado pegado. Al salir
 * del campo se quita el límite, así el pinch-zoom normal del usuario
 * sigue funcionando el resto del tiempo (no se desactiva por
 * accesibilidad).
 */
function useViewportZoomGuard() {
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return;

    const baseContent =
      viewportMeta.getAttribute("content") || "width=device-width, initial-scale=1";

    const isTextEntryField = (target: EventTarget | null): target is HTMLElement => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLInputElement) {
        const nonTextTypes = ["checkbox", "radio", "range", "button", "submit", "file", "color", "image"];
        return !nonTextTypes.includes(target.type);
      }
      return false;
    };

    let restoreTimeout: number | undefined;

    const lockZoom = (event: FocusEvent) => {
      if (!isTextEntryField(event.target)) return;
      window.clearTimeout(restoreTimeout);
      viewportMeta.setAttribute("content", `${baseContent}, maximum-scale=1`);
    };

    const unlockZoom = (event: FocusEvent) => {
      if (!isTextEntryField(event.target)) return;
      // Pequeño delay: si se quita el límite antes de que el teclado
      // termine de cerrarse, el zoom se puede volver a quedar pegado.
      restoreTimeout = window.setTimeout(() => {
        viewportMeta.setAttribute("content", baseContent);
      }, 200);
    };

    document.addEventListener("focusin", lockZoom);
    document.addEventListener("focusout", unlockZoom);
    return () => {
      document.removeEventListener("focusin", lockZoom);
      document.removeEventListener("focusout", unlockZoom);
      window.clearTimeout(restoreTimeout);
    };
  }, []);
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
  useViewportZoomGuard();

  return (
    <>
      <div className={showTabBar ? "pb-24 md:pb-0" : ""}>{children}</div>
      {role && !overlay && <MobileTabBar role={role} />}
    </>
  );
}
