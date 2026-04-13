import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Zeta Signals | Precyzyjne Sygnały XAU/USD",
  description: "Luksusowa platforma sygnałowa XAU/USD z realtime danymi rynkowymi i algorytmiczną kontrolą ryzyka."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.variable} ${cormorant.variable} bg-background font-sans text-foreground antialiased [font-family:var(--font-inter)]`}>
        {children}
      </body>
    </html>
  );
}
