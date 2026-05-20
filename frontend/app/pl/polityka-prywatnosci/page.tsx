import type { Metadata } from "next";

import { PrivacyDocumentPage } from "@/components/legal/privacy-document-page";
import { LEGAL_LINKS, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Polityka prywatności | Zeta Signals",
  description: "Polityka prywatności serwisu Zeta Signals, w tym informacje o danych osobowych, cookies, Supabase i Lemon Squeezy.",
  alternates: {
    canonical: "/pl/polityka-prywatnosci",
    languages: {
      en: "/en/privacy-policy",
      pl: "/pl/polityka-prywatnosci"
    }
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function PolishPrivacyPolicyPage() {
  return (
    <PrivacyDocumentPage
      downloadLabel="Pobierz Politykę Prywatności PDF"
      effectiveDateLabel={`Data wejścia w życie: ${PRIVACY_EFFECTIVE_DATE}`}
      fileName="polityka-prywatnosci-zeta-signals-pl.md"
      languageLabel="Język: PL"
      links={{
        contact: LEGAL_LINKS.contact,
        privacyPdf: LEGAL_LINKS.privacyPdf,
        riskWarning: LEGAL_LINKS.plRiskWarning,
        terms: LEGAL_LINKS.plTerms
      }}
      navigationLabels={{
        contact: "Kontakt",
        riskWarning: "Ostrzeżenie o ryzyku",
        terms: "Regulamin"
      }}
      summary="Dokument opisuje zasady przetwarzania danych osobowych, korzystania z cookies i Local Storage, obsługi Supabase Auth oraz płatności i subskrypcji przez Lemon Squeezy."
      title="Polityka prywatności"
      versionLabel={`Wersja: ${PRIVACY_VERSION}`}
    />
  );
}
