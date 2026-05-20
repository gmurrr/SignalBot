import { NextResponse } from "next/server";

import { BillingProviderError, getBillingProvider } from "@/lib/billing/provider";
import { applySubscriptionUpdate, recordPaymentEvent } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;

  try {
    const billingProvider = getBillingProvider(provider.toLowerCase());
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process billing webhook." },
      { status }
    );
  }
}
