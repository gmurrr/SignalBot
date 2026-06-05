"use client";

import Link from "next/link";

import { DashboardDataProvider } from "@/components/dashboard/dashboard-data-provider";
import { LiveTicker } from "@/components/dashboard/live-ticker";
import { SignalDeck } from "@/components/dashboard/signal-deck";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import { getLocalizedLegalLinks } from "@/lib/legal/constants";

export function DashboardShell() {
  const { dict, locale } = useI18n();
  const legalLinks = getLocalizedLegalLinks(locale === "en" ? "EN" : "PL");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <MarketStatusBadge />
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground md:text-6xl">{dict.dashboard.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{dict.dashboard.body}</p>
        </div>
      </div>

      <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-7 text-[#f4deb0]">
        {dict.dashboard.riskBanner}{" "}
        <Link href={legalLinks.riskWarning} className="text-brass transition-colors hover:text-[#e6c55a]">
          {dict.common.riskWarning}
        </Link>
      </aside>

      <DashboardDataProvider>
        <LiveTicker />
        <SignalDeck />
      </DashboardDataProvider>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <TradingViewWidget />
        <Card className="flex flex-col justify-between border-[#1A1A1A]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.dashboard.notesLabel}</p>
            <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">{dict.dashboard.notesTitle}</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
              {dict.dashboard.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
          <div className="mt-8 rounded-[24px] border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.04)] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.dashboard.easyCartLabel}</p>
            <p className="mt-3 text-lg text-foreground">{dict.dashboard.easyCartBody}</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
