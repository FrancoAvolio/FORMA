import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AppHeader } from "@/components/layout/app-header";
import { BottomNavigation } from "@/components/layout/bottom-navigation";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FORMA — Rutinas claras, hechas para vos",
    template: "%s — FORMA",
  },
  description:
    "Creá una rutina de fuerza clara, editable y explicable según tus objetivos, tiempo y equipamiento.",
  applicationName: "FORMA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-AR"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <AppHeader />
        <main id="contenido" className="site-main">
          {children}
        </main>
        <BottomNavigation />
      </body>
    </html>
  );
}
