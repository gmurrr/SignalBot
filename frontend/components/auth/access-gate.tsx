"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchWithSupabaseSession } from "@/lib/auth/api";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AccountOverview } from "@/lib/account/subscription";

type AccessState =
  | { status: "loading" }
  | { status: "ready"; overview: AccountOverview }
  | { status: "error"; message: string };

export function AccessGate({ children, requireSubscription = false }: { children: ReactNode; requireSubscription?: boolean }) {
  const { dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AccessState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function verifyAccess() {
      setState({ status: "loading" });

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 5000);
        if (!data.session) {
          if (consumeSignOutRedirect()) {
            return;
          }

          router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const response = await fetchWithSupabaseSession("/api/account/subscription");
        if (response.status === 401) {
          router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? dict.access.error);
        }

        const overview = (await response.json()) as AccountOverview;
        if (requireSubscription && !overview.hasAccess) {
          router.replace("/billing");
          return;
        }

        if (isMounted) {
          setState({ status: "ready", overview });
        }
      } catch (error) {
        if (isMounted) {
          setState({ status: "error", message: error instanceof Error ? error.message : dict.access.error });
        }
      }
    }

    void verifyAccess();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (consumeSignOutRedirect()) {
          return;
        }

        router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }

      void verifyAccess();
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [dict.access.error, pathname, requireSubscription, router]);

  if (state.status === "ready") {
    return children;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
      <Card className="w-full border-[#1A1A1A] p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-[rgba(212,175,55,0.18)] p-3 text-brass">
            {state.status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.access.label}</p>
            <h1 className="mt-2 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">
              {state.status === "loading" ? dict.access.loadingTitle : dict.access.errorTitle}
            </h1>
          </div>
        </div>
        <p className="mt-6 text-sm leading-7 text-muted">{state.status === "loading" ? dict.access.loadingBody : state.message}</p>
        {state.status === "error" ? (
          <Button className="mt-6" onClick={() => window.location.reload()} type="button">
            <RefreshCw className="h-4 w-4" />
            {dict.access.retry}
          </Button>
        ) : null}
      </Card>
    </main>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Session check timed out.")), timeoutMs);
    })
  ]);
}

function consumeSignOutRedirect() {
  if (window.sessionStorage.getItem("zeta-signals-signing-out") !== "true") {
    return false;
  }

  window.sessionStorage.removeItem("zeta-signals-signing-out");
  window.location.assign("/");
  return true;
}
