import type { Metadata } from "next";
import Link from "next/link";

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

          <p className="text-sm leading-7 text-muted">
            Detailed Service rules are described in the{" "}
            <Link href={LEGAL_LINKS.enTerms} className="text-brass transition-colors hover:text-[#e6c55a]">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </main>
    </>
  );
}
