import type { Metadata } from "next";

import { PrivacyDocumentPage } from "@/components/legal/privacy-document-page";
import { LEGAL_LINKS, PRIVACY_EFFECTIVE_DATE_EN, PRIVACY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Privacy Policy | Zeta Signals",
  description: "Zeta Signals Privacy Policy, including personal data, cookies, Local Storage, Supabase and Lemon Squeezy payment processing information.",
  alternates: {
    canonical: "/en/privacy-policy",
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

export default function EnglishPrivacyPolicyPage() {
  return (
    <PrivacyDocumentPage
      downloadLabel="Download Privacy Policy PDF"
      effectiveDateLabel={`Effective date: ${PRIVACY_EFFECTIVE_DATE_EN}`}
      fileName="privacy-policy-zeta-signals-en-v1-1.md"
      languageLabel="Language: EN"
      links={{
        contact: LEGAL_LINKS.contact,
        cookie: LEGAL_LINKS.enCookie,
        privacyPdf: LEGAL_LINKS.privacyPdfEn,
        riskWarning: LEGAL_LINKS.enRiskWarning,
        terms: LEGAL_LINKS.enTerms
      }}
      navigationLabels={{
        contact: "Contact",
        cookie: "Cookie Policy",
        riskWarning: "Risk Warning",
        terms: "Terms of Service"
      }}
      summary="This document describes personal data processing, cookies and Local Storage, Supabase Auth, and payment and subscription processing through Lemon Squeezy."
      title="Privacy Policy"
      versionLabel={`Version: ${PRIVACY_VERSION}`}
    />
  );
}
