import type { Metadata } from "next";

import { CookieDocumentPage } from "@/components/legal/cookie-document-page";
import { COOKIE_POLICY_EFFECTIVE_DATE, COOKIE_POLICY_VERSION, LEGAL_LINKS } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Polityka plików cookies | Zeta Signals",
  description: "Polityka plików cookies i technologii pokrewnych serwisu Zeta Signals, w tym informacje o Supabase Auth, LocalStorage i Lemon Squeezy.",
  alternates: {
    canonical: "/pl/polityka-cookies",
    languages: {
      en: "/en/cookie-policy",
      pl: "/pl/polityka-cookies"
    }
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function PolishCookiePolicyPage() {
  return (
    <CookieDocumentPage
      downloadLabel="Pobierz PDF"
      effectiveDateLabel={`Data wejścia w życie: ${COOKIE_POLICY_EFFECTIVE_DATE}`}
      fileName="polityka-cookies-zeta-signals-pl-v1-1.md"
      languageLabel="Język: PL"
      links={{
        contact: LEGAL_LINKS.contact,
        cookiePdf: LEGAL_LINKS.cookiePdf,
        privacy: LEGAL_LINKS.plPrivacy,
        riskWarning: LEGAL_LINKS.plRiskWarning,
        terms: LEGAL_LINKS.plTerms
      }}
      navigationLabels={{
        contact: "Kontakt",
        privacy: "Polityka prywatności",
        riskWarning: "Ostrzeżenie o ryzyku",
        terms: "Regulamin"
      }}
      summary="Dokument opisuje pliki cookies, LocalStorage, SessionStorage, technologie niezbędne do działania Serwisu, obsługę Supabase Auth, płatności Lemon Squeezy oraz zasady zarządzania preferencjami."
      title="Polityka plików cookies"
      versionLabel={`Wersja: ${COOKIE_POLICY_VERSION}`}
    />
  );
}
