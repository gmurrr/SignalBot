import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Footer } from "@/components/footer";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { I18nProvider } from "@/lib/i18n/provider";

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
  title: "Zeta Signals | Alerty Analityczne XAU/USD",
  description: "Oprogramowanie analityczne XAU/USD z danymi realtime i edukacyjno-informacyjnymi Alertami Analitycznymi."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.variable} ${cormorant.variable} bg-background font-sans text-foreground antialiased [font-family:var(--font-inter)]`}>
        <I18nProvider>
          {children}
          <Footer />
          <CookieConsentBanner />
        </I18nProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
