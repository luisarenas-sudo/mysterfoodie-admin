import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import localFont from "next/font/local";
import AppHeader from "@/components/AppHeader";
import { HeaderVisibility, MobileChromeBody } from "@/components/mobile/MobileChrome";
import { getSessionProfile } from "@/lib/auth";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

// Nan Holo Gigawide: tipografía de marca, MUY ancha. Máximo UN título por página.
const nanHolo = localFont({
  src: "./fonts/nan-holo-gigawide-ultra.woff2",
  weight: "800",
  display: "swap",
  variable: "--font-nan-holo",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.mysterfoodie.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "MysterFoodie - Evaluación Mystery Shopper",
  description: "Levantamiento de evaluaciones Mystery Shopper para restaurantes y bares",
  // Tarjeta por defecto para cualquier enlace de la app que se pegue en un chat
  // (el reporte público la reemplaza con su propia tarjeta, ver app/r/[shortCode]).
  openGraph: {
    type: "website",
    siteName: "MysterFoodie",
    locale: "es_MX",
    title: "MysterFoodie · Evaluaciones Mystery Shopper",
    description: "Palabra Foodie, orgullo sibarita: visitas anónimas, 52 indicadores y un reporte claro para tu restaurante o bar.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "MysterFoodie" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MysterFoodie · Evaluaciones Mystery Shopper",
    description: "Palabra Foodie, orgullo sibarita: visitas anónimas, 52 indicadores y un reporte claro para tu restaurante o bar.",
    images: ["/og.jpg"],
  },
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
    <html lang="es" className={`${poppins.variable} ${nanHolo.variable}`}>
      <body className="font-sans">
        <HeaderVisibility role={profile?.role ?? null}>
          <AppHeader />
        </HeaderVisibility>
        <MobileChromeBody role={profile?.role ?? null}>{children}</MobileChromeBody>
      </body>
    </html>
  );
}
