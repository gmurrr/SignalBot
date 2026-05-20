"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n/provider";
import { PUBLIC_RISK_DISCLAIMER, getLocalizedLegalLinks } from "@/lib/legal/constants";
import { cn } from "@/lib/utils";

export function RiskDisclaimer({ className }: { className?: string }) {
  const { dict, locale } = useI18n();
  const legalLinks = getLocalizedLegalLinks(locale === "en" ? "EN" : "PL");

  return (
    <aside
      className={cn(
        "rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-7 text-[#f4deb0]",
        className
      )}
    >
      <p>{locale === "en" ? dict.legal.publicRiskDisclaimer : PUBLIC_RISK_DISCLAIMER}</p>
      <Link href={legalLinks.riskWarning} className="mt-2 inline-flex text-brass transition-colors hover:text-[#e6c55a]">
        {dict.common.riskWarning}
      </Link>
    </aside>
  );
}
