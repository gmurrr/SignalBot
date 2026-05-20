"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { fetchWithSupabaseSession } from "@/lib/auth/api";
import { isStrongPassword, isValidEmail, passwordMinLength } from "@/lib/auth/password-policy";
import { exchangePasswordRecoveryParams } from "@/lib/auth/recovery-callback";
import {
  clearPasswordRecoverySession,
  getPasswordRecoveryLinkError,
  hasPasswordRecoveryLinkMarker,
  hasPasswordRecoverySessionMarker,
  markPasswordRecoverySession
} from "@/lib/auth/recovery-session";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PasswordRecoveryMode = "request" | "reset";

export function PasswordRecoveryShell({ mode }: { mode: PasswordRecoveryMode }) {
  const { dict } = useI18n();
  const content = dict.auth.passwordRecovery[mode];
  const isResetMode = mode === "reset";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(!isResetMode);
  const [isCheckingSession, setIsCheckingSession] = useState(isResetMode);
  const [recoverySessionMessage, setRecoverySessionMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isResetMode) {
      return;
    }

    let isMounted = true;
    const linkError = getPasswordRecoveryLinkError();

    if (linkError) {
      clearPasswordRecoverySession();
      setRecoverySessionMessage(getLinkErrorMessage(linkError, dict.auth.passwordRecovery.callback, dict.auth.passwordRecovery.reset.sessionMissing));
      setHasRecoverySession(false);
      setIsCheckingSession(false);
      return;
    }

    setRecoverySessionMessage(null);

    if (hasPasswordRecoveryLinkMarker()) {
      markPasswordRecoverySession();
    }

    const supabase = getSupabaseBrowserClient();

    async function detectRecoverySession() {
      const session = await prepareRecoverySession(supabase).catch((error) => {
        console.error("Password recovery session preparation failed:", error);
        return null;
      });

      if (isMounted) {
        setHasRecoverySession(Boolean(session && hasPasswordRecoverySessionMarker()));
        setIsCheckingSession(false);
      }
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(Boolean(session));
        setIsCheckingSession(false);
        return;
      }

      if (session && hasPasswordRecoverySessionMarker()) {
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    void detectRecoverySession();

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [isResetMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      if (isResetMode) {
        await handlePasswordUpdate();
      } else {
        await handlePasswordResetRequest();
      }
    } catch (error) {
      setErrorMessage(translateRecoveryError(error, dict.auth.errors, dict.auth.passwordRecovery.errorFallback, dict.auth.passwordRecovery.reset.sessionMissing));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetRequest() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage(dict.auth.errors.emailRequired);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage(dict.auth.errors.invalidEmail);
      return;
    }

    const response = await fetch("/api/auth/password-recovery/request", {
      body: JSON.stringify({ email: normalizedEmail }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (response.status === 429) {
      throw new Error("rate_limited");
    }

    if (!response.ok) {
      throw new Error("password_reset_request_failed");
    }

    setMessage(dict.auth.passwordRecovery.request.success);
  }

  async function handlePasswordUpdate() {
    const validationError = validatePasswordUpdateForm({
      confirmPassword,
      errors: dict.auth.errors,
      password
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session || !hasPasswordRecoverySessionMarker()) {
      setHasRecoverySession(false);
      throw new Error("missing_recovery_session");
    }

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      throw error;
    }

    await fetchWithSupabaseSession("/api/auth/password-recovery/complete", {
      body: JSON.stringify({}),
      method: "POST"
    }).catch((error) => {
      console.error("Password recovery completion sync failed:", error);
    });

    await supabase.auth.signOut();
    clearPasswordRecoverySession();
    setPassword("");
    setConfirmPassword("");
    setHasRecoverySession(false);
    setIsComplete(true);
    setMessage(dict.auth.passwordRecovery.reset.success);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col justify-between border-[#1A1A1A] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_50%),rgba(8,8,8,0.95)] p-8 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.auth.clientAccess}</p>
            <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{content.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{content.subtitle}</p>
          </div>
          <div className="mt-12 rounded-[28px] border border-[rgba(212,175,55,0.14)] bg-[rgba(255,255,255,0.02)] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.auth.passwordRecovery.securityLabel}</p>
            <p className="mt-3 text-lg text-foreground">{dict.auth.passwordRecovery.securityBody}</p>
          </div>
        </Card>

        <Card className="border-[#1A1A1A] p-8 md:p-10">
          {isCheckingSession ? (
            <StatusBlock body={dict.auth.passwordRecovery.reset.checkingSession} />
          ) : null}

          {!isCheckingSession && isResetMode && !hasRecoverySession && !isComplete ? (
            <div className="space-y-6">
              <StatusBlock body={recoverySessionMessage ?? dict.auth.passwordRecovery.reset.sessionMissing} />
              <Button asChild className="w-full">
                <Link href="/auth/forgot-password">{dict.auth.passwordRecovery.reset.requestAgain}</Link>
              </Button>
            </div>
          ) : null}

          {!isCheckingSession && isComplete ? (
            <div className="space-y-6">
              {message ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
              <Button asChild className="w-full">
                <Link href="/auth/sign-in">{dict.auth.passwordRecovery.backToSignIn}</Link>
              </Button>
            </div>
          ) : null}

          {!isCheckingSession && (!isResetMode || hasRecoverySession) && !isComplete ? (
            <>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                {isResetMode ? (
                  <>
                    <Input
                      aria-required="true"
                      autoComplete="new-password"
                      minLength={passwordMinLength}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={dict.auth.passwordRecovery.newPassword}
                      type="password"
                      value={password}
                    />
                    <Input
                      aria-required="true"
                      autoComplete="new-password"
                      minLength={passwordMinLength}
                      name="confirm_password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={dict.auth.passwordRecovery.confirmNewPassword}
                      type="password"
                      value={confirmPassword}
                    />
                    <p className="text-xs text-muted">{dict.auth.passwordHint}</p>
                  </>
                ) : (
                  <Input
                    aria-required="true"
                    autoComplete="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={dict.auth.email}
                    type="email"
                    value={email}
                  />
                )}
                {message ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
                {errorMessage ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errorMessage}</p> : null}
                <Button className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? dict.auth.loading : content.cta}
                </Button>
              </form>
              <Separator className="my-8" />
              <div className="space-y-3 text-sm text-muted">
                <p>{content.helper}</p>
                <p>
                  <Link href="/auth/sign-in" className="text-brass">
                    {dict.auth.passwordRecovery.backToSignIn}
                  </Link>
                </p>
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

function getLinkErrorMessage(
  linkError: { isExpired: boolean },
  callbackCopy: {
    error: string;
    expiredError: string;
  },
  fallback: string
) {
  if (linkError.isExpired) {
    return callbackCopy.expiredError;
  }

  return callbackCopy.error || fallback;
}

function StatusBlock({ body }: { body: string }) {
  return <p className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.02)] p-4 text-sm leading-6 text-muted">{body}</p>;
}

async function prepareRecoverySession(supabase: ReturnType<typeof getSupabaseBrowserClient>) {
  if (hasPasswordRecoveryLinkMarker()) {
    const exchangedSession = await exchangePasswordRecoveryParams(supabase);

    if (exchangedSession) {
      window.history.replaceState({}, "", "/auth/reset-password");
      return exchangedSession;
    }
  }

  const { data } = await supabase.auth.getSession();

  if (data.session) {
    return data.session;
  }

  await new Promise((resolve) => window.setTimeout(resolve, 500));
  const { data: retryData } = await supabase.auth.getSession();
  return retryData.session;
}

function validatePasswordUpdateForm({
  confirmPassword,
  errors,
  password
}: {
  confirmPassword: string;
  errors: {
    confirmPasswordRequired: string;
    passwordRequired: string;
    passwordRequirements: string;
    passwordMismatch: string;
  };
  password: string;
}) {
  if (!password) {
    return errors.passwordRequired;
  }

  if (!isStrongPassword(password)) {
    return errors.passwordRequirements;
  }

  if (!confirmPassword) {
    return errors.confirmPasswordRequired;
  }

  if (password !== confirmPassword) {
    return errors.passwordMismatch;
  }

  return null;
}

function translateRecoveryError(
  error: unknown,
  errors: {
    invalidEmail: string;
    passwordRequirements: string;
    rateLimited: string;
  },
  fallback: string,
  sessionMissing: string
) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid email")) {
    return errors.invalidEmail;
  }

  if (message.includes("password should be") || message.includes("weak password")) {
    return errors.passwordRequirements;
  }

  if (message.includes("rate_limited") || message.includes("rate limit") || message.includes("security purposes")) {
    return errors.rateLimited;
  }

  if (message.includes("missing_recovery_session")) {
    return sessionMissing;
  }

  return fallback;
}
