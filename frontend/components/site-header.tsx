import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(212,175,55,0.08)] bg-[rgba(5,5,5,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] text-sm font-semibold text-brass">
            SB
          </div>
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-2xl tracking-[0.16em] text-foreground">SignalBot</p>
            <p className="-mt-1 text-[11px] uppercase tracking-[0.32em] text-muted">XAU / USD Desk</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/#story">Story</Link>
          <Link href="/#process">How It Works</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/sign-in">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Open Terminal</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
