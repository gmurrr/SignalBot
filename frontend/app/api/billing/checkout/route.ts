import { NextResponse } from "next/server";

import { ensureUserAccount } from "@/lib/account/server";
import { BillingProviderError, getBillingProvider } from "@/lib/billing/provider";
import { recordCheckoutConsents } from "@/lib/legal/consent-audit";
import { getRequestAuditMetadata } from "@/lib/legal/request";
import { getUserFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJsonBody(request);
    const planCode = typeof body.planCode === "string" && body.planCode ? body.planCode : "premium-monthly";
    const language = body.language === "EN" ? "EN" : "PL";
    if (!isSupportedPlanCode(planCode)) {
      return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });
    }

    if (!hasRequiredCheckoutConsents(body.consents)) {
      return NextResponse.json({ error: "All checkout consents are required." }, { status: 400 });
    }

    const { account } = await ensureUserAccount(user);
    const provider = getBillingProvider();
    const origin = getTrustedSiteOrigin(request);
    const result = await provider.createCheckoutSession({
      userId: user.id,
      email: account.billing_email ?? account.email,
      planCode,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing?checkout=cancelled`
    });
    const auditMetadata = getRequestAuditMetadata(request);

    await recordCheckoutConsents({
      checkoutProvider: provider.name === "mock" ? "mock" : "Lemon Squeezy",
      checkoutSessionId: result.externalReference,
      checkoutUrl: getAuditableCheckoutUrl(result.checkoutUrl),
      email: account.billing_email ?? account.email,
      ipAddress: auditMetadata.ipAddress,
      language,
      metadata: {
        billing_provider: provider.name,
        plan_code: planCode
      },
      userAgent: auditMetadata.userAgent,
      userId: user.id
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof BillingProviderError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create checkout session." },
      { status }
    );
  }
}

function hasRequiredCheckoutConsents(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const consents = value as Record<string, unknown>;
  return (
    consents.ageConfirmed === true &&
    consents.termsAccepted === true &&
    consents.privacyAccepted === true &&
    consents.riskAccepted === true &&
    consents.noInvestmentAdviceAccepted === true &&
    consents.digitalServiceConsent === true &&
    consents.withdrawalLossAcknowledged === true &&
    consents.subscriptionRenewalAccepted === true
  );
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getTrustedSiteOrigin(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) {
    return new URL(configuredSiteUrl).origin;
  }

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new BillingProviderError("Site URL is not configured.", 500);
  }

  return new URL(request.url).origin;
}

function getAuditableCheckoutUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isSupportedPlanCode(planCode: string) {
  return planCode === "premium-monthly";
}
