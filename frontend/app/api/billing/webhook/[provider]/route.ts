import { NextResponse } from "next/server";

import { BillingProviderError, getBillingProvider, getConfiguredBillingProviderName } from "@/lib/billing/provider";
import { applySubscriptionUpdate, recordPaymentEvent } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params;
    const requestedProvider = provider.toLowerCase();
    const configuredProvider = getConfiguredBillingProviderName();

    if (requestedProvider !== configuredProvider) {
      return NextResponse.json({ error: "Unknown billing provider." }, { status: 404 });
    }

    const billingProvider = getBillingProvider(configuredProvider);
    const rawBody = await request.text();
    const event = await billingProvider.parseWebhook(request, rawBody);
    const subscription = event.subscriptionUpdate ? await applySubscriptionUpdate(event.subscriptionUpdate) : null;
    const paymentEvent = await recordPaymentEvent(event, subscription?.id ?? null);

    return NextResponse.json({
      ok: true,
      eventId: paymentEvent.id,
      subscriptionId: subscription?.id ?? null
    });
  } catch (error) {
    const status = error instanceof BillingProviderError ? error.status : 500;
    console.error("Billing webhook processing failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process billing webhook." },
      { status }
    );
  }
}
