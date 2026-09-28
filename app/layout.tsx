import type { Metadata } from "next";
import { Poppins, Fredoka } from "next/font/google";
import AppHeader from "@/components/AppHeader";
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
  title: "MysterFoodie - Evaluacion Mystery Shopper",
  description: "Levantamiento de evaluaciones Mystery Shopper para restaurantes y bares",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${poppins.variable} ${fredoka.variable}`}>
      <body className="font-sans">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
