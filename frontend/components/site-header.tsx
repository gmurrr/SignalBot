import Link from "next/link";

import { MarketStatusBadge } from "@/components/market-status-badge";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1A1A1A] bg-[rgba(5,5,5,0.86)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] text-sm font-semibold text-brass">
            ZS
          </div>
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-2xl tracking-[0.16em] text-[#D4AF37]">Zeta Signals</p>
            <p className="-mt-1 text-[11px] uppercase tracking-[0.32em] text-muted">XAU / USD</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/#story">Historia</Link>
          <Link href="/#process">Jak to działa</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/dashboard">Panel</Link>
        </nav>
        <div className="hidden lg:block">
          <MarketStatusBadge />
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/sign-in">Logowanie / Rejestracja</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Rozpocznij</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
