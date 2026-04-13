import { LiveTicker } from "@/components/dashboard/live-ticker";
import { SignalDeck } from "@/components/dashboard/signal-deck";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function DashboardShell() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <MarketStatusBadge />
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground md:text-6xl">
            Zeta Signals - panel XAU/USD
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            Rynek złota to środowisko o wyjątkowej płynności i ponadprzeciętnej zmienności. Panel pokazuje cenę, status rynku oraz sygnały w czasie rzeczywistym, bez przeładowywania strony.
          </p>
        </div>
      </div>

      <LiveTicker />
      <SignalDeck />

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <TradingViewWidget />
        <Card className="flex flex-col justify-between border-[#1A1A1A]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Uwagi twórcy</p>
            <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">Monitoring i ochrona sygnałów</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
              <p>Tylko jeden aktywny sygnał jest dostępny w danym momencie, więc przestarzałe wpisy nigdy nie pozostają podświetlone.</p>
              <p>Gdy TP, SL albo limit czasu rozstrzygnie pozycję, backend wysyła zmianę statusu do każdego połączonego terminala.</p>
              <p>Ticker, badge rynku i historia sygnałów zostały zaprojektowane tak, aby decyzje były szybkie, czytelne i jednoznaczne.</p>
            </div>
          </div>
          <div className="mt-8 rounded-[24px] border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.04)] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Strefa EasyCart</p>
            <p className="mt-3 text-lg text-foreground">
              Miejsce jest przygotowane pod integrację płatności, walidację dostępu i przyszłe blokady dashboardu dla klientów premium.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
