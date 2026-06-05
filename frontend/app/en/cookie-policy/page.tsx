import type { Metadata } from "next";

import { CookieDocumentPage } from "@/components/legal/cookie-document-page";
import { COOKIE_POLICY_EFFECTIVE_DATE_EN, COOKIE_POLICY_VERSION, LEGAL_LINKS } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Cookie Policy | Zeta Signals",
  description: "Zeta Signals Cookie Policy and similar technologies information, including Supabase Auth, LocalStorage and Lemon Squeezy payment-related cookies.",
  alternates: {
    canonical: "/en/cookie-policy",
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

export default function EnglishCookiePolicyPage() {
  return (
    <CookieDocumentPage
      downloadLabel="Download PDF"
      effectiveDateLabel={`Effective date: ${COOKIE_POLICY_EFFECTIVE_DATE_EN}`}
      fileName="cookie-policy-zeta-signals-en-v1-1.md"
      languageLabel="Language: EN"
      links={{
        contact: LEGAL_LINKS.contact,
        cookiePdf: LEGAL_LINKS.cookiePdfEn,
        privacy: LEGAL_LINKS.enPrivacy,
        riskWarning: LEGAL_LINKS.enRiskWarning,
        terms: LEGAL_LINKS.enTerms
      }}
      navigationLabels={{
        contact: "Contact",
        privacy: "Privacy Policy",
        riskWarning: "Risk Warning",
        terms: "Terms of Service"
      }}
      summary="This document describes cookies, LocalStorage, SessionStorage, technologies necessary for the Service, Supabase Auth, Lemon Squeezy payments and preference management."
      title="Cookie Policy"
      versionLabel={`Version: ${COOKIE_POLICY_VERSION}`}
    />
  );
}
