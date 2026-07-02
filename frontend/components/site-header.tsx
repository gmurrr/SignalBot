"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Button } from "@/components/ui/button";
import { markPasswordRecoverySession } from "@/lib/auth/recovery-session";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const { dict, locale } = useI18n();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();
  const signUpHref = locale === "en" ? "/en/auth/sign-up" : "/pl/auth/sign-up";
  const billingHref = locale === "en" ? "/en/billing" : "/pl/billing";
  const menuLabel = locale === "en" ? (isMenuOpen ? "Close menu" : "Open menu") : isMenuOpen ? "Zamknij menu" : "Otworz menu";
  const navLinks = [
    { href: "/#story", label: dict.nav.story },
    { href: "/#process", label: dict.nav.process },
    { href: "/cennik", label: dict.nav.pricing },
    { href: "/#faq", label: dict.nav.faq },
    { href: "/dashboard", label: dict.nav.dashboard }
  ];

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

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    window.sessionStorage.setItem("zeta-signals-signing-out", "true");

    try {
      await supabase.auth.signOut();
    } finally {
      setIsMenuOpen(false);
      setIsAuthenticated(false);
      window.location.assign("/");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-[60] border-b border-[#1A1A1A] bg-[rgba(5,5,5,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-6 lg:gap-5 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 lg:w-[190px] lg:flex-none lg:gap-0 xl:w-[205px]">
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.22)] bg-[rgba(212,175,55,0.08)] text-brass shadow-[0_0_22px_rgba(212,175,55,0.08)] transition hover:border-brass hover:bg-[rgba(212,175,55,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass lg:hidden"
              aria-controls="mobile-site-menu"
              aria-expanded={isMenuOpen}
              aria-label={menuLabel}
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="min-w-0 shrink-0">
              <p className="truncate font-[family-name:var(--font-cormorant)] text-xl tracking-[0.14em] text-[#D4AF37] sm:text-2xl md:tracking-[0.16em]">
                {dict.common.brand}
              </p>
              <p className="-mt-1 hidden text-[11px] uppercase tracking-[0.32em] text-muted sm:block">{dict.common.symbol}</p>
            </Link>
          </div>

          <nav className="hidden flex-1 items-center justify-start gap-6 text-sm text-muted lg:flex xl:gap-8 2xl:gap-10">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="whitespace-nowrap transition-colors hover:text-brass">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden xl:block">
            <MarketStatusBadge />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher className="scale-[0.92] sm:scale-100" />
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
            {!isAuthenticated ? (
              <Button asChild size="sm" className="hidden lg:inline-flex">
                <Link href={signUpHref}>{dict.common.start}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {hasMounted
        ? createPortal(
            <AnimatePresence>
              {isMenuOpen ? (
                <motion.div
                  id="mobile-site-menu"
                  className="pointer-events-none fixed inset-x-0 top-[76px] z-[70] px-4 pt-3 lg:hidden"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="pointer-events-auto mx-auto w-full max-w-md rounded-[24px] border border-[rgba(212,175,55,0.16)] bg-[rgba(8,8,7,0.84)] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:max-w-lg sm:p-5">
                    <div className="mb-5">
                      <MarketStatusBadge className="w-full justify-center" />
                    </div>
                    <nav className="grid gap-2">
                      {navLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsMenuOpen(false)}
                          className="group flex items-center justify-between rounded-2xl border border-transparent bg-[rgba(255,255,255,0.025)] px-4 py-3 text-sm text-muted transition hover:border-[rgba(212,175,55,0.18)] hover:bg-[rgba(212,175,55,0.08)] hover:text-foreground"
                        >
                          <span>{link.label}</span>
                          <span className="h-px w-8 bg-[rgba(212,175,55,0.24)] transition group-hover:w-12 group-hover:bg-brass" />
                        </Link>
                      ))}
                    </nav>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[rgba(212,175,55,0.1)] pt-5">
                      {isAuthenticated ? (
                        <>
                          <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href={billingHref} onClick={() => setIsMenuOpen(false)}>
                              {dict.common.billing}
                            </Link>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={handleSignOut}>
                            <LogOut className="h-4 w-4" />
                            {dict.common.signOut}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href="/auth/sign-in" onClick={() => setIsMenuOpen(false)}>
                              {dict.common.auth}
                            </Link>
                          </Button>
                          <Button asChild size="sm" className="w-full">
                            <Link href={signUpHref} onClick={() => setIsMenuOpen(false)}>
                              {dict.common.start}
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}
