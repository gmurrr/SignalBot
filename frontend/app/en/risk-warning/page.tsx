import type { Metadata } from "next";

import { LegalDocumentLinks } from "@/components/legal/legal-document-links";
import { SiteHeader } from "@/components/site-header";
import { FULL_RISK_WARNING_EN, LEGAL_LINKS, RISK_WARNING_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Risk Warning | Zeta Signals",
  description: "Market risk warning and educational-informational nature of Zeta Signals Analytical Alerts.",
  alternates: {
    canonical: "/en/risk-warning",
    languages: {
      en: "/en/risk-warning",
      pl: "/pl/ostrzezenie-o-ryzyku"
    }
  }
};

export default function EnglishRiskWarningPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] px-6 py-12 lg:px-10">
        <article className="space-y-8">
          <header className="border-b border-[#1A1A1A] pb-8">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Version {RISK_WARNING_VERSION} / Language: EN</p>
            <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">Risk Warning</h1>
          </header>

          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 text-base leading-8 text-[#f4deb0]">
            <p>{FULL_RISK_WARNING_EN}</p>
          </section>

          <LegalDocumentLinks
            links={[
              { href: LEGAL_LINKS.enTerms, label: "Terms of Service" },
              { href: LEGAL_LINKS.enPrivacy, label: "Privacy Policy" },
              { href: LEGAL_LINKS.enCookie, label: "Cookie Policy" },
              { href: LEGAL_LINKS.contact, label: "Contact" }
            ]}
          />
        </article>
      </main>
    </>
  );
}
