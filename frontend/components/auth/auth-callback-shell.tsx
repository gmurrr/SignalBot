"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exchangePasswordRecoveryParams } from "@/lib/auth/recovery-callback";
import {
  clearPasswordRecoverySession,
  getPasswordRecoveryLinkError,
  getSafeRecoveryNextPath,
  hasPasswordRecoveryLinkMarker,
  hasPasswordRecoverySessionMarker,
  markPasswordRecoverySession
} from "@/lib/auth/recovery-session";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthCallbackShell() {
  const { dict } = useI18n();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function completeCallback() {
      try {
        const linkError = getPasswordRecoveryLinkError();

        if (linkError) {
          clearPasswordRecoverySession();
          setErrorMessage(getCallbackErrorMessage(linkError, dict.auth.passwordRecovery.callback));
          return;
        }

        if (hasPasswordRecoveryLinkMarker()) {
          markPasswordRecoverySession();
        }

        const supabase = getSupabaseBrowserClient();

        if (!hasPasswordRecoverySessionMarker()) {
          throw new Error("missing_recovery_link");
        }

        await exchangePasswordRecoveryParams(supabase);

        if (isMounted) {
          router.replace(getSafeRecoveryNextPath());
        }
      } catch (error) {
        console.error("Auth callback failed:", error);

        if (isMounted) {
          setErrorMessage(getCallbackErrorMessage(null, dict.auth.passwordRecovery.callback));
        }
      }
    }

    void completeCallback();

    return () => {
      isMounted = false;
    };
  }, [dict.auth.passwordRecovery.callback.error, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-[#1A1A1A] p-8 md:p-10">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] text-brass">
            {errorMessage ? "!" : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-cormorant)] text-4xl text-foreground">{dict.auth.passwordRecovery.callback.title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{errorMessage ?? dict.auth.passwordRecovery.callback.body}</p>
          </div>
          {errorMessage ? (
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">{dict.auth.passwordRecovery.reset.requestAgain}</Link>
            </Button>
          ) : null}
        </div>
      </Card>
    </main>
  );
}

function getCallbackErrorMessage(
  linkError: { isExpired: boolean } | null,
  copy: {
    error: string;
    expiredError: string;
  }
) {
  if (linkError?.isExpired) {
    return copy.expiredError;
  }

  return copy.error;
}
