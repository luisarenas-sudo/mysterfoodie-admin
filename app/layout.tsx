import type { Metadata, Viewport } from "next";
import { Poppins, Fredoka } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import { HeaderVisibility, MobileChromeBody } from "@/components/mobile/MobileChrome";
import { getSessionProfile } from "@/lib/auth";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fredoka",
});

export const metadata: Metadata = {
  title: "MysterFoodie - Evaluación Mystery Shopper",
  description: "Levantamiento de evaluaciones Mystery Shopper para restaurantes y bares",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

/**
 * width=device-width + initialScale: 1 explícitos, y maximumScale: 1.
 * La app se usa "Añadida a Inicio" en iPhone (modo standalone, sin la
 * barra de Safari): si iOS hace zoom al enfocar un campo (buscador de
 * Negocios, formularios) no hay forma de volver atrás y la vista se
 * descuadra. maximum-scale=1 es lo que impide ese zoom automático (el
 * font-size >= 16px solo no fue suficiente en standalone). viewportFit:
 * "cover" habilita env(safe-area-inset-*) para respetar el notch / home
 * indicator en los overlays de pantalla completa.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  return (
    <html lang="es" className={`${poppins.variable} ${fredoka.variable}`}>
      <body className="font-sans">
        <HeaderVisibility role={profile?.role ?? null}>
          <AppHeader />
        </HeaderVisibility>
        <MobileChromeBody role={profile?.role ?? null}>{children}</MobileChromeBody>
      </body>
    </html>
  );
}
