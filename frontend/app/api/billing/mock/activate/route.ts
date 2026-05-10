import { NextResponse } from "next/server";

import { ensureUserAccount } from "@/lib/account/server";
import { activateMockSubscription, recordPaymentEvent } from "@/lib/billing/server";
import { getConfiguredBillingProviderName } from "@/lib/billing/provider";
import { getUserFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (getConfiguredBillingProviderName() !== "mock") {
    return NextResponse.json({ error: "Mock billing is disabled." }, { status: 404 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJsonBody(request);
    const planCode = typeof body.planCode === "string" && body.planCode ? body.planCode : "premium-monthly";
    await ensureUserAccount(user);
    const subscription = await activateMockSubscription(user.id, planCode);

    await recordPaymentEvent(
      {
        provider: "mock",
        providerEventId: `mock_activate_${user.id}_${Date.now()}`,
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

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
