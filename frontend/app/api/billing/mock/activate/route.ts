import { NextResponse } from "next/server";

import { ensureUserAccount } from "@/lib/account/server";
import { activateMockSubscription, recordPaymentEvent } from "@/lib/billing/server";
import { getConfiguredBillingProviderName, isMockBillingEnabled } from "@/lib/billing/provider";
import { recordCheckoutConsents } from "@/lib/legal/consent-audit";
import { getRequestAuditMetadata } from "@/lib/legal/request";
import { getUserFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isMockBillingEnabled()) {
    return NextResponse.json({ error: "Mock billing is disabled." }, { status: 404 });
  }

  try {
    if (getConfiguredBillingProviderName() !== "mock") {
      return NextResponse.json({ error: "Mock billing is disabled." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Mock billing is disabled." }, { status: 404 });
  }

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
    const auditMetadata = getRequestAuditMetadata(request);
    const mockReference = `mock_activate_${user.id}_${Date.now()}`;

    await recordCheckoutConsents({
      checkoutProvider: "mock",
      checkoutSessionId: mockReference,
      email: account.billing_email ?? account.email,
      ipAddress: auditMetadata.ipAddress,
      language,
      metadata: {
        mode: "mock",
        plan_code: planCode
      },
      userAgent: auditMetadata.userAgent,
      userId: user.id
    });

    const subscription = await activateMockSubscription(user.id, planCode);

    await recordPaymentEvent(
      {
        provider: "mock",
        providerEventId: mockReference,
        eventType: "subscription.mock_activated",
        userId: user.id,
        payload: {
          user_id: user.id,
          plan_code: planCode,
          status: "active"
        },
        subscriptionUpdate: {
          userId: user.id,
          provider: "mock",
          status: "active",
          planCode
        }
      },
      subscription.id
    );

    return NextResponse.json({ subscription });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to activate mock subscription." },
      { status: 500 }
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

function isSupportedPlanCode(planCode: string) {
  return planCode === "premium-monthly";
}
