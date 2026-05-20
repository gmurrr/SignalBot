"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck, Zap } from "lucide-react";

import { RiskDisclaimer } from "@/components/legal/risk-disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchWithSupabaseSession } from "@/lib/auth/api";
import { getSubscriptionLabel, type AccountOverview } from "@/lib/account/subscription";
import { useI18n } from "@/lib/i18n/provider";
import { CHECKOUT_CONSENT_TEXT, CHECKOUT_CONSENT_TEXT_EN, SUBSCRIPTION_RENEWAL_NOTICE, getLocalizedLegalLinks } from "@/lib/legal/constants";
import type { SubscriptionStatus } from "@/types/database";

type BillingState =
  | { status: "loading" }
  | { status: "ready"; overview: AccountOverview }
  | { status: "error"; message: string };

type CheckoutResponse = {
  checkoutUrl: string;
  provider: string;
};

const planCode = "premium-monthly";
const initialCheckoutConsents = {
  digitalServiceConsent: false,
  riskAccepted: false,
  subscriptionRenewalAccepted: false,
  termsAccepted: false
};

export function BillingShell() {
  const { dict, locale } = useI18n();
  const legalLanguage = locale === "en" ? "EN" : "PL";
  const legalLinks = getLocalizedLegalLinks(legalLanguage);
  const checkoutConsentText = legalLanguage === "EN" ? CHECKOUT_CONSENT_TEXT_EN : CHECKOUT_CONSENT_TEXT;
  const [state, setState] = useState<BillingState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const [isMockPending, setIsMockPending] = useState(false);
  const [checkoutConsents, setCheckoutConsents] = useState(initialCheckoutConsents);

  const statusLabel = useMemo(() => {
    if (state.status !== "ready") {
      return dict.billing.status.inactive;
    }

    const status = getSubscriptionLabel(state.overview.subscription) as SubscriptionStatus;
    return dict.billing.status[status] ?? status;
  }, [dict.billing.status, state]);

  const allCheckoutConsentsAccepted = Object.values(checkoutConsents).every(Boolean);

  async function loadOverview() {
    setState({ status: "loading" });
    try {
      const response = await fetchWithSupabaseSession("/api/account/subscription");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? dict.billing.loadError);
      }

      setState({ status: "ready", overview: (await response.json()) as AccountOverview });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : dict.billing.loadError });
    }
  }

  useEffect(() => {
    void loadOverview();

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setNotice(dict.billing.checkoutSuccess);
    }
    if (checkout === "cancelled") {
      setNotice(dict.billing.checkoutCancelled);
    }
  }, []);

  async function startCheckout() {
    if (!allCheckoutConsentsAccepted) {
      setNotice(dict.billing.consentsRequired);
      return;
    }

    setIsCheckoutPending(true);
    setNotice(null);

    try {
      const response = await fetchWithSupabaseSession("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          consents: checkoutConsents,
          language: legalLanguage,
          planCode
        })
      });
      const payload = (await response.json()) as Partial<CheckoutResponse> & { error?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? dict.billing.checkoutError);
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : dict.billing.checkoutError);
    } finally {
      setIsCheckoutPending(false);
    }
  }

  async function activateMock() {
    if (!allCheckoutConsentsAccepted) {
      setNotice(dict.billing.consentsRequired);
      return;
    }

    setIsMockPending(true);
    setNotice(null);

    try {
      const response = await fetchWithSupabaseSession("/api/billing/mock/activate", {
        method: "POST",
        body: JSON.stringify({
          consents: checkoutConsents,
          language: legalLanguage,
          planCode
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? dict.billing.mockError);
      }

      setNotice(dict.billing.mockActivated);
      await loadOverview();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : dict.billing.mockError);
    } finally {
      setIsMockPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            {dict.billing.badge}
          </Badge>
          <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground md:text-6xl">{dict.billing.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{dict.billing.body}</p>
        </div>
        <Button type="button" variant="outline" onClick={loadOverview} disabled={state.status === "loading"}>
          <RefreshCw className="h-4 w-4" />
          {dict.billing.refresh}
        </Button>
      </section>

      <RiskDisclaimer />

      {notice ? <p className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] p-4 text-sm text-foreground">{notice}</p> : null}

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-[#1A1A1A]">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.billing.accountLabel}</p>
          {state.status === "loading" ? (
            <div className="mt-8 flex items-center gap-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-brass" />
              {dict.billing.loading}
            </div>
          ) : null}
          {state.status === "error" ? <p className="mt-8 text-sm leading-7 text-red-200">{state.message}</p> : null}
          {state.status === "ready" ? (
            <div className="mt-8 space-y-6">
              <Metric label={dict.billing.emailLabel} value={state.overview.account?.email ?? "-"} />
              <Metric label={dict.billing.statusLabel} value={statusLabel} />
              <Metric label={dict.billing.planLabel} value={state.overview.subscription?.plan_code ?? "free"} />
              <Metric label={dict.billing.providerLabel} value={state.overview.subscription?.provider ?? state.overview.provider} />
              <Metric label={dict.billing.periodEndLabel} value={formatDate(state.overview.subscription?.current_period_end, locale)} />
            </div>
          ) : null}
          <Separator className="my-8" />
          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.billing.subscriptionSectionTitle}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{dict.billing.subscriptionSectionBody}</p>
            </div>
            {state.status === "ready" && state.overview.billingPortalUrl ? (
              <Button asChild variant="outline" size="sm">
                <Link href={state.overview.billingPortalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {dict.billing.manageSubscription}
                </Link>
              </Button>
            ) : (
              <p className="text-xs leading-6 text-muted">{dict.billing.portalUnavailable}</p>
            )}
          </section>
        </Card>

        <Card className="gold-glow border-[#1A1A1A] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.14),transparent_55%),rgba(8,8,8,0.92)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-brass">{dict.billing.planEyebrow}</p>
              <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">{dict.billing.planTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{dict.billing.planBody}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(212,175,55,0.16)] px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">{dict.billing.planCodeLabel}</p>
              <p className="mt-2 text-lg text-brass">{planCode}</p>
            </div>
          </div>
          <Separator className="my-8" />
          <div className="grid gap-4 md:grid-cols-3">
            {dict.billing.features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[rgba(255,255,255,0.02)] p-4 text-sm leading-7 text-muted">
                <Zap className="mb-3 h-4 w-4 text-brass" />
                {feature}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-[#1A1A1A] bg-[rgba(255,255,255,0.02)] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-brass">{dict.billing.consentsTitle}</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              {dict.billing.consentsIntro}{" "}
              <Link href={legalLinks.terms} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                {dict.common.terms}
              </Link>
              {" / "}
              <Link href={legalLinks.riskWarning} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                {dict.common.riskWarning}
              </Link>
            </p>
            <div className="mt-5 space-y-3">
              <CheckoutConsentCheckbox
                checked={checkoutConsents.termsAccepted}
                onChange={(checked) => setCheckoutConsents((current) => ({ ...current, termsAccepted: checked }))}
              >
                {checkoutConsentText.terms}{" "}
                <Link href={legalLinks.terms} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                  {dict.common.terms}
                </Link>
              </CheckoutConsentCheckbox>
              <CheckoutConsentCheckbox
                checked={checkoutConsents.riskAccepted}
                onChange={(checked) => setCheckoutConsents((current) => ({ ...current, riskAccepted: checked }))}
              >
                {checkoutConsentText.risk}{" "}
                <Link href={legalLinks.riskWarning} target="_blank" rel="noreferrer" className="text-brass transition-colors hover:text-[#e6c55a]">
                  {dict.common.riskWarning}
                </Link>
              </CheckoutConsentCheckbox>
              <CheckoutConsentCheckbox
                checked={checkoutConsents.digitalServiceConsent}
                onChange={(checked) => setCheckoutConsents((current) => ({ ...current, digitalServiceConsent: checked }))}
              >
                {checkoutConsentText.digitalService}
              </CheckoutConsentCheckbox>
              <CheckoutConsentCheckbox
                checked={checkoutConsents.subscriptionRenewalAccepted}
                onChange={(checked) => setCheckoutConsents((current) => ({ ...current, subscriptionRenewalAccepted: checked }))}
              >
                {checkoutConsentText.renewal}
              </CheckoutConsentCheckbox>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-muted">{SUBSCRIPTION_RENEWAL_NOTICE}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={startCheckout} disabled={isCheckoutPending || !allCheckoutConsentsAccepted}>
              {isCheckoutPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {dict.billing.checkoutCta}
            </Button>
            {state.status === "ready" && state.overview.provider === "mock" ? (
              <Button type="button" variant="outline" onClick={activateMock} disabled={isMockPending || !allCheckoutConsentsAccepted}>
                {isMockPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {dict.billing.mockCta}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}

function CheckoutConsentCheckbox({ checked, children, onChange }: { checked: boolean; children: React.ReactNode; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(255,255,255,0.02)] p-4 text-sm leading-7 text-muted">
      <input checked={checked} className="mt-1 h-4 w-4 shrink-0 accent-[#D4AF37]" onChange={(event) => onChange(event.target.checked)} required type="checkbox" />
      <span>{children}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.26em] text-muted">{label}</p>
      <p className="mt-2 break-words text-lg text-foreground">{value}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
