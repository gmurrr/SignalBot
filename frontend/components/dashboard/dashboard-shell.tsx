import { LiveTicker } from "@/components/dashboard/live-ticker";
import { SignalDeck } from "@/components/dashboard/signal-deck";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function DashboardShell() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge>Realtime cockpit</Badge>
          <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground md:text-6xl">
            XAU/USD Premium Signal Dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            MT5 streams the price, Python manages trade state, Supabase distributes each signal transition instantly, and the frontend turns it into a live operator view.
          </p>
        </div>
      </div>

      <LiveTicker />
      <SignalDeck />

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <TradingViewWidget />
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Operator Notes</p>
            <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">Realtime safeguards</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
              <p>Only one active signal remains tradable at a time, so stale entries never stay highlighted.</p>
              <p>When TP, SL or the 30-minute window resolves the trade, Supabase Realtime pushes the status change to every connected dashboard.</p>
              <p>The ticker, status bar and history panel are designed to make desk monitoring feel immediate and unambiguous.</p>
            </div>
          </div>
          <div className="mt-8 rounded-[24px] border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.04)] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Widget slot</p>
            <p className="mt-3 text-lg text-foreground">EasyCart placement is reserved in the auth funnel and can be extended into billing-gated dashboard access later.</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
