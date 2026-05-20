"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Button } from "@/components/ui/button";
import { markPasswordRecoverySession } from "@/lib/auth/recovery-session";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const { dict, locale } = useI18n();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const signUpHref = locale === "en" ? "/en/auth/sign-up" : "/pl/auth/sign-up";
  const billingHref = locale === "en" ? "/en/billing" : "/pl/billing";

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecoverySession();
      }

      setIsAuthenticated(Boolean(session));
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    window.sessionStorage.setItem("zeta-signals-signing-out", "true");

    try {
      await supabase.auth.signOut();
    } finally {
      setIsAuthenticated(false);
      window.location.assign("/");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#1A1A1A] bg-[rgba(5,5,5,0.86)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] text-sm font-semibold text-brass">
            ZS
          </div>
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-2xl tracking-[0.16em] text-[#D4AF37]">{dict.common.brand}</p>
            <p className="-mt-1 text-[11px] uppercase tracking-[0.32em] text-muted">{dict.common.symbol}</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/#story">{dict.nav.story}</Link>
          <Link href="/#process">{dict.nav.process}</Link>
          <Link href="/cennik">{dict.nav.pricing}</Link>
          <Link href="/#faq">{dict.nav.faq}</Link>
          <Link href="/dashboard">{dict.nav.dashboard}</Link>
        </nav>
        <div className="hidden xl:block">
          <MarketStatusBadge />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={billingHref}>{dict.common.billing}</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleSignOut} aria-label={dict.common.signOut}>
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">{dict.common.signOut}</span>
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/auth/sign-in">{dict.common.auth}</Link>
            </Button>
          )}
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href={isAuthenticated ? "/dashboard" : signUpHref}>{dict.common.start}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
