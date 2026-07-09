import type { Metadata } from "next";

import { TermsDocumentPage } from "@/components/legal/terms-document-page";
import { LEGAL_LINKS, TERMS_EFFECTIVE_DATE_EN, TERMS_VERSION } from "@/lib/legal/constants";

const prevailingLanguageNote =
  "In case of any discrepancies between the Polish and English versions of these Terms of Service, the Polish version shall prevail, to the extent permitted by mandatory provisions of applicable law.";

export const metadata: Metadata = {
  title: "Terms of Service | Zeta Signals",
  description: "Zeta Signals Terms of Service, subscription information, market risk and the educational-informational nature of Analytical Alerts.",
  alternates: {
    canonical: "/en/terms",
    languages: {
      en: "/en/terms",
      pl: "/pl/regulamin"
    }
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function EnglishTermsPage() {
  return (
    <TermsDocumentPage
      boxText="This document contains the terms for using the Service, subscription information, market risk disclosures and the educational-informational nature of the service."
      downloadLabel="Download Terms PDF"
      effectiveDateLabel={`Effective date: ${TERMS_EFFECTIVE_DATE_EN}`}
      fileName="terms-zeta-signals-en-v1-2-final.md"
      languageLabel="Language: EN"
      note={prevailingLanguageNote}
      pdfHref={LEGAL_LINKS.termsPdfEn}
      relatedLinks={[
        { href: LEGAL_LINKS.enPrivacy, label: "Privacy Policy" },
        { href: LEGAL_LINKS.enCookie, label: "Cookie Policy" },
        { href: LEGAL_LINKS.enRefund, label: "Refund Policy" },
        { href: LEGAL_LINKS.enRiskWarning, label: "Risk Warning" },
        { href: LEGAL_LINKS.contact, label: "Contact" }
      ]}
      title="Terms of Service for the provision of electronic services of the Zeta Signals service"
      versionLabel={`Version: ${TERMS_VERSION}`}
    />
  );
}
