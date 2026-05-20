import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { LEGAL_LINKS, PRIVACY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Privacy Policy | Zeta Signals",
  description: "Privacy information for Zeta Signals users.",
  alternates: {
    canonical: "/en/privacy-policy",
    languages: {
      en: "/en/privacy-policy",
      pl: "/pl/polityka-prywatnosci"
    }
  }
};

export default function EnglishPrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] px-6 py-12 lg:px-10">
        <article className="space-y-8">
          <header className="border-b border-[#1A1A1A] pb-8">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Version {PRIVACY_VERSION} / Language: EN</p>
            <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">Privacy Policy</h1>
          </header>

          <section className="space-y-5 text-sm leading-8 text-muted">
            <p>
              TODO: Add the final Privacy Policy after confirming the data controller, processing purposes, legal bases, data categories and service providers. This placeholder prevents broken links and does not replace the final legal document.
            </p>
            <p>
              Personal data information is also referenced in{" "}
              <Link href={`${LEGAL_LINKS.enTerms}#section-17`} className="text-brass transition-colors hover:text-[#e6c55a]">
                § 17 of the Terms of Service
              </Link>
              .
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
