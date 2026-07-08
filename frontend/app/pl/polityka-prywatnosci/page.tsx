import type { Metadata } from "next";

import { PrivacyDocumentPage } from "@/components/legal/privacy-document-page";
import { LEGAL_LINKS, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Polityka prywatności | Zeta Signals",
  description: "Polityka prywatności serwisu Zeta Signals, w tym informacje o danych osobowych, cookies, Supabase i operatorze płatności.",
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
      fileName="polityka-prywatnosci-zeta-signals-pl-v1-3-final.md"
      languageLabel="Język: PL"
      links={{
        contact: LEGAL_LINKS.contact,
        cookie: LEGAL_LINKS.plCookie,
        privacyPdf: LEGAL_LINKS.privacyPdf,
        riskWarning: LEGAL_LINKS.plRiskWarning,
        terms: LEGAL_LINKS.plTerms
      }}
      navigationLabels={{
        contact: "Kontakt",
        cookie: "Polityka cookies",
        riskWarning: "Ostrzeżenie o ryzyku",
        terms: "Regulamin"
      }}
      summary="Dokument opisuje zasady przetwarzania danych osobowych, korzystania z cookies i Local Storage, obsługi Supabase Auth oraz płatności i subskrypcji przez wybranego operatora płatności."
      title="Polityka prywatności"
      versionLabel={`Wersja: ${PRIVACY_VERSION}`}
    />
  );
}
