import { NextResponse } from "next/server";

import { ensureUserAccount } from "@/lib/account/server";
import { BillingProviderError, getBillingProvider } from "@/lib/billing/provider";
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
    const { account } = await ensureUserAccount(user);
    const provider = getBillingProvider();
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const result = await provider.createCheckoutSession({
      userId: user.id,
      email: account.billing_email ?? account.email,
      planCode,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing?checkout=cancelled`
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

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
