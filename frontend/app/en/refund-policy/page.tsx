import type { Metadata } from "next";

import { RefundDocumentPage } from "@/components/legal/refund-document-page";
import { LEGAL_LINKS, REFUND_POLICY_EFFECTIVE_DATE_EN, REFUND_POLICY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Refund Policy | Zeta Signals",
  description: "Zeta Signals Refund Policy, including withdrawal rules, paid access cancellation and refund request handling.",
  alternates: {
    canonical: "/en/refund-policy",
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

export default function EnglishRefundPolicyPage() {
  return (
    <RefundDocumentPage
      downloadLabel="Download Refund Policy PDF"
      effectiveDateLabel={`Effective date: ${REFUND_POLICY_EFFECTIVE_DATE_EN}`}
      fileName="refund-policy-zeta-signals-en-v1-0-final.md"
      languageLabel="Language: EN"
      links={{
        contact: LEGAL_LINKS.contact,
        cookie: LEGAL_LINKS.enCookie,
        privacy: LEGAL_LINKS.enPrivacy,
        refundPdf: LEGAL_LINKS.refundPdfEn,
        riskWarning: LEGAL_LINKS.enRiskWarning,
        terms: LEGAL_LINKS.enTerms
      }}
      navigationLabels={{
        contact: "Contact",
        cookie: "Cookie Policy",
        privacy: "Privacy Policy",
        riskWarning: "Risk Warning",
        terms: "Terms of Service"
      }}
      summary="This document describes withdrawal rules, Paid Access cancellation, payment refunds and the contact procedure for settlement matters."
      title="Refund Policy"
      versionLabel={`Version: ${REFUND_POLICY_VERSION}`}
    />
  );
}
