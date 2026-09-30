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
 * width=device-width + initialScale: 1 explícito (Next ya lo infiere,
 * pero se declara para que quede claro que es intencional) y sin
 * maximumScale/userScalable: deshabilitar el pinch-zoom es mala
 * práctica de accesibilidad; el zoom automático al enfocar un input
 * se evita con font-size >= 16px en los campos, no quitando el zoom
 * del usuario. viewportFit: "cover" habilita env(safe-area-inset-*)
 * para respetar el notch / home indicator en los overlays de
 * pantalla completa (wizard, nuevo negocio).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
