import type { Metadata } from "next";

import { RefundDocumentPage } from "@/components/legal/refund-document-page";
import { LEGAL_LINKS, REFUND_POLICY_EFFECTIVE_DATE, REFUND_POLICY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Polityka zwrotów | Zeta Signals",
  description: "Polityka zwrotów Zeta Signals, w tym zasady odstąpienia od umowy, anulowania dostępu płatnego i rozpatrywania wniosków o zwrot.",
  alternates: {
    canonical: "/pl/polityka-zwrotow",
    languages: {
      en: "/en/refund-policy",
      pl: "/pl/polityka-zwrotow"
    }
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function PolishRefundPolicyPage() {
  return (
    <RefundDocumentPage
      downloadLabel="Pobierz Politykę Zwrotów PDF"
      effectiveDateLabel={`Data wejścia w życie: ${REFUND_POLICY_EFFECTIVE_DATE}`}
      fileName="polityka-zwrotow-zeta-signals-pl-v1-0-final.md"
      languageLabel="Język: PL"
      links={{
        contact: LEGAL_LINKS.contact,
        cookie: LEGAL_LINKS.plCookie,
        privacy: LEGAL_LINKS.plPrivacy,
        refundPdf: LEGAL_LINKS.refundPdf,
        riskWarning: LEGAL_LINKS.plRiskWarning,
        terms: LEGAL_LINKS.plTerms
      }}
      navigationLabels={{
        contact: "Kontakt",
        cookie: "Polityka cookies",
        privacy: "Polityka prywatności",
        riskWarning: "Ostrzeżenie o ryzyku",
        terms: "Regulamin"
      }}
      summary="Dokument opisuje zasady odstąpienia od umowy, anulowania Dostępu Płatnego, zwrotów płatności oraz procedury kontaktu w sprawach rozliczeniowych."
      title="Polityka zwrotów"
      versionLabel={`Wersja: ${REFUND_POLICY_VERSION}`}
    />
  );
}
