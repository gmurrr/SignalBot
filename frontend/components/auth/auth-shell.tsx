"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isStrongPassword, isValidEmail, passwordMinLength } from "@/lib/auth/password-policy";
import { useI18n } from "@/lib/i18n/provider";
import { getLocalizedLegalLinks } from "@/lib/legal/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthShell({ mode }: { mode: "signIn" | "signUp" }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const content = dict.auth[mode];
  const isSignup = mode === "signUp";
  const legalLanguage = locale === "en" ? "EN" : "PL";
  const legalLinks = getLocalizedLegalLinks(legalLanguage);
  const footerHref = isSignup ? "/auth/sign-in" : legalLanguage === "EN" ? "/en/auth/sign-up" : "/pl/auth/sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setAcceptedTerms(false);
    setMessage(null);
    setErrorMessage(null);
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim();
    const validationError = validateAuthForm({
      acceptedTerms,
      confirmPassword,
      email: normalizedEmail,
      errors: dict.auth.errors,
      isSignup,
      password
    });

    if (validationError) {
      setErrorMessage(validationError);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isSignup) {
        const emailAvailability = await fetch("/api/auth/email-availability", {
          body: JSON.stringify({ email: normalizedEmail }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const emailAvailabilityPayload = (await emailAvailability.json().catch(() => null)) as { exists?: boolean } | null;

        if (!emailAvailability.ok) {
          throw new Error("email_availability_check_failed");
        }

        if (emailAvailabilityPayload?.exists) {
          setErrorMessage(dict.auth.errors.userAlreadyRegistered);
          return;
        }

        const signUpResponse = await fetch("/api/auth/sign-up", {
          body: JSON.stringify({
            acceptedLegal: acceptedTerms,
            email: normalizedEmail,
            language: legalLanguage,
            password
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const signUpPayload = (await signUpResponse.json().catch(() => null)) as SignUpResponse | null;

        if (!signUpResponse.ok) {
          throw new Error(signUpPayload?.error ?? "sign_up_failed");
        }

        if (signUpPayload?.session?.access_token && signUpPayload.session.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: signUpPayload.session.access_token,
            refresh_token: signUpPayload.session.refresh_token
          });

          if (sessionError) {
            throw sessionError;
          }
        }

        setMessage(dict.auth.signUpSuccess);
        if (signUpPayload?.session) {
          router.replace("/billing");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        throw error;
      }

      setMessage(dict.auth.signInSuccess);
      router.replace(getSafeNextPath() ?? "/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(translateAuthError(error, dict.auth.errors, dict.auth.errorFallback));
    } finally {
      setIsSubmitting(false);
    }
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
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.auth.easyCartLabel}</p>
            <p className="mt-3 text-lg text-foreground">{dict.auth.easyCartBody}</p>
          </div>
        </Card>

        <Card className="border-[#1A1A1A] p-8 md:p-10">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <Input
              aria-required="true"
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={dict.auth.email}
              type="email"
              value={email}
            />
            <Input
              aria-required="true"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? passwordMinLength : undefined}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={dict.auth.password}
              type="password"
              value={password}
            />
            {isSignup ? (
              <>
                <Input
                  aria-required="true"
                  autoComplete="new-password"
                  minLength={passwordMinLength}
                  name="confirm_password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={dict.auth.confirmPassword}
                  type="password"
                  value={confirmPassword}
                />
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.02)] p-4 text-sm leading-6 text-muted">
                  <input
                    checked={acceptedTerms}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#D4AF37]"
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span>
                    {dict.auth.termsPrefix}{" "}
                    <Link href={legalLinks.terms} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                      {dict.auth.termsLink}
                    </Link>
                    {` ${dict.auth.termsConnector} `}
                    <Link href={legalLinks.privacy} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                      {dict.auth.privacyLink}
                    </Link>
                    {dict.auth.termsSuffix}
                  </span>
                </label>
              </>
            ) : null}
            {isSignup ? <p className="text-xs text-muted">{dict.auth.passwordHint}</p> : null}
            {message ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
            {errorMessage ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errorMessage}</p> : null}
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? dict.auth.loading : content.cta}
            </Button>
          </form>
          <Separator className="my-8" />
          <div className="space-y-3 text-sm text-muted">
            <p>{dict.auth.helper}</p>
            {!isSignup ? (
              <p>
                <Link href="/auth/forgot-password" className="text-brass">
                  {dict.auth.passwordRecovery.forgotLink}
                </Link>
              </p>
            ) : null}
            <p>
              {content.footerLabel}{" "}
              <Link href={footerHref} className="text-brass">
                {content.footerText}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

type SignUpResponse = {
  error?: string;
  session?: {
    access_token: string;
    refresh_token: string;
  } | null;
};

function validateAuthForm({
  acceptedTerms,
  confirmPassword,
  email,
  errors,
  isSignup,
  password
}: {
  acceptedTerms: boolean;
  confirmPassword: string;
  email: string;
  errors: {
    emailRequired: string;
    invalidEmail: string;
    confirmPasswordRequired: string;
    passwordRequired: string;
    passwordRequirements: string;
    passwordMismatch: string;
    termsRequired: string;
  };
  isSignup: boolean;
  password: string;
}) {
  if (!email) {
    return errors.emailRequired;
  }

  if (!isValidEmail(email)) {
    return errors.invalidEmail;
  }

  if (!password) {
    return errors.passwordRequired;
  }

  if (isSignup && !isStrongPassword(password)) {
    return errors.passwordRequirements;
  }

  if (isSignup && password !== confirmPassword) {
    if (!confirmPassword) {
      return errors.confirmPasswordRequired;
    }

    return errors.passwordMismatch;
  }

  if (isSignup && !acceptedTerms) {
    return errors.termsRequired;
  }

  return null;
}

function translateAuthError(
  error: unknown,
  errors: {
    emailNotConfirmed: string;
    invalidCredentials: string;
    invalidEmail: string;
    passwordTooShort: string;
    passwordRequirements: string;
    rateLimited: string;
    userAlreadyRegistered: string;
  },
  fallback: string
) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return errors.invalidCredentials;
  }

  if (message.includes("email not confirmed")) {
    return errors.emailNotConfirmed;
  }

  if (message.includes("already registered") || message.includes("already been registered")) {
    return errors.userAlreadyRegistered;
  }

  if (message.includes("password should be") || message.includes("weak password")) {
    return errors.passwordRequirements;
  }

  if (message.includes("invalid email") || message.includes("validate email")) {
    return errors.invalidEmail;
  }

  if (message.includes("rate limit") || message.includes("security purposes")) {
    return errors.rateLimited;
  }

  if (message.includes("email_availability_check_failed")) {
    return fallback;
  }

  return fallback;
}

function getSafeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next");

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  return nextPath;
}
