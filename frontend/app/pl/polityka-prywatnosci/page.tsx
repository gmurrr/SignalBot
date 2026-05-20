import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { LEGAL_LINKS, PRIVACY_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Polityka prywatności | Zeta Signals",
  description: "Informacje o ochronie prywatności użytkowników Zeta Signals.",
  alternates: {
    canonical: "/pl/polityka-prywatnosci",
    languages: {
      en: "/en/privacy-policy",
      pl: "/pl/polityka-prywatnosci"
    }
  }
};

export default function PolishPrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] px-6 py-12 lg:px-10">
        <article className="space-y-8">
          <header className="border-b border-[#1A1A1A] pb-8">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Wersja {PRIVACY_VERSION} / Język: PL</p>
            <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">Polityka prywatności</h1>
          </header>

          <section className="space-y-5 text-sm leading-8 text-muted">
            <p>
              TODO: Uzupełnić finalną treść Polityki Prywatności po zatwierdzeniu danych administratora, podstaw przetwarzania, zakresu danych oraz dostawców usług. Ten placeholder zapobiega martwym linkom i nie zastępuje docelowego dokumentu prawnego.
            </p>
            <p>
              Informacje o przetwarzaniu danych osobowych występują również w{" "}
              <Link href={`${LEGAL_LINKS.plTerms}#section-17`} className="text-brass transition-colors hover:text-[#e6c55a]">
                § 17 Regulaminu
              </Link>
              .
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
