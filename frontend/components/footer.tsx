"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n/provider";
import { LEGAL_LINKS, getLocalizedLegalLinks } from "@/lib/legal/constants";

export function Footer() {
  const { dict, locale } = useI18n();
  const legalLinks = getLocalizedLegalLinks(locale === "en" ? "EN" : "PL");
  const billingHref = locale === "en" ? "/en/billing" : "/pl/billing";

  return (
    <footer className="border-t border-[#1A1A1A] bg-[rgba(5,5,5,0.82)] px-6 py-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-3xl tracking-[0.12em] text-[#D4AF37]">{dict.common.brand}</p>
            <p className="mt-2 max-w-md text-sm leading-7 text-muted">{dict.footer.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-muted md:justify-end">
            <Link href="/#faq" className="transition-colors hover:text-brass">
              {dict.common.faq}
            </Link>
            <Link href={legalLinks.terms} className="transition-colors hover:text-brass">
              {dict.common.terms}
            </Link>
            <Link href={legalLinks.privacy} className="transition-colors hover:text-brass">
              {dict.common.privacy}
            </Link>
            <Link href={legalLinks.riskWarning} className="transition-colors hover:text-brass">
              {dict.common.riskWarning}
            </Link>
            <Link href={billingHref} className="transition-colors hover:text-brass">
              {dict.common.manageSubscription}
            </Link>
            <Link href={LEGAL_LINKS.contact} className="transition-colors hover:text-brass">
              {dict.common.contact}
            </Link>
          </nav>
        </div>
        <p className="border-t border-[#1A1A1A] pt-6 text-center text-xs leading-6 text-zinc-600">{dict.footer.riskWarning}</p>
      </div>
    </footer>
  );
}
