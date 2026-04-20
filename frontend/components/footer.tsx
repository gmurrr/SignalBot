"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n/provider";

export function Footer() {
  const { dict } = useI18n();

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
            <Link href="/terms" className="transition-colors hover:text-brass">
              {dict.common.terms}
            </Link>
            <Link href="mailto:contact@zetasignals.com" className="transition-colors hover:text-brass">
              {dict.common.contact}
            </Link>
          </nav>
        </div>
        <p className="border-t border-[#1A1A1A] pt-6 text-center text-xs leading-6 text-zinc-600">{dict.footer.riskWarning}</p>
      </div>
    </footer>
  );
}
