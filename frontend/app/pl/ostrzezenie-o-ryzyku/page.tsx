import type { Metadata } from "next";

import { LegalDocumentLinks } from "@/components/legal/legal-document-links";
import { SiteHeader } from "@/components/site-header";
import { FULL_RISK_WARNING_PL, LEGAL_LINKS, RISK_WARNING_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Ostrzeżenie o ryzyku | Zeta Signals",
  description: "Informacja o ryzyku rynkowym i edukacyjno-informacyjnym charakterze Alertów Analitycznych Zeta Signals.",
  alternates: {
    canonical: "/pl/ostrzezenie-o-ryzyku",
    languages: {
      en: "/en/risk-warning",
      pl: "/pl/ostrzezenie-o-ryzyku"
    }
  }
};

export default function PolishRiskWarningPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] px-6 py-12 lg:px-10">
        <article className="space-y-8">
          <header className="border-b border-[#1A1A1A] pb-8">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Wersja {RISK_WARNING_VERSION} / Język: PL</p>
            <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">Ostrzeżenie o ryzyku</h1>
          </header>

          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 text-base leading-8 text-[#f4deb0]">
            <p>{FULL_RISK_WARNING_PL}</p>
          </section>

          <LegalDocumentLinks
            links={[
              { href: LEGAL_LINKS.plTerms, label: "Regulamin" },
              { href: LEGAL_LINKS.plPrivacy, label: "Polityka prywatności" },
              { href: LEGAL_LINKS.plCookie, label: "Polityka cookies" },
              { href: LEGAL_LINKS.plRefund, label: "Polityka zwrotów" },
              { href: LEGAL_LINKS.contact, label: "Kontakt" }
            ]}
          />
        </article>
      </main>
    </>
  );
}
