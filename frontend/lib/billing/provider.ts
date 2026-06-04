import "server-only";

import type { BillingProvider, BillingWebhookEvent, CheckoutSessionInput, CheckoutSessionResult } from "@/lib/billing/types";
import type { JsonRecord, SubscriptionStatus } from "@/types/database";

const defaultPlanCode = "premium-monthly";

export class BillingProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isMockBillingEnabled() {
  if (isProductionRuntime()) {
    return false;
  }

  return readBooleanEnv("ENABLE_MOCK_BILLING", true);
}

export function getConfiguredBillingProviderName() {
  const providerName = (process.env.BILLING_PROVIDER || "").trim().toLowerCase();

  if (!providerName) {
    if (isProductionRuntime()) {
      throw new BillingProviderError("Billing provider is not configured.", 500);
    }

    return "mock";
  }

  if (providerName === "mock" && !isMockBillingEnabled()) {
    throw new BillingProviderError("Mock billing is disabled.", isProductionRuntime() ? 500 : 404);
  }

  return providerName;
}

export function getBillingProvider(providerName = getConfiguredBillingProviderName()): BillingProvider {
  if (providerName === "mock") {
    if (!isMockBillingEnabled()) {
      throw new BillingProviderError("Mock billing is disabled.", isProductionRuntime() ? 500 : 404);
    }

    return new MockBillingProvider();
  }

  return new StandardBillingProvider(providerName);
}

class MockBillingProvider implements BillingProvider {
  name = "mock";

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const reference = `mock_${crypto.randomUUID()}`;
    const checkoutUrl = appendQuery(input.successUrl, {
      checkout: "mock",
      reference,
      plan: input.planCode
    });

    return {
      provider: this.name,
      checkoutUrl,
      externalReference: reference,
      metadata: {
        mode: "mock"
      }
    };
  }

  async parseWebhook(request: Request, rawBody: string): Promise<BillingWebhookEvent> {
    assertWebhookSecret(request);

    const payload = parseJsonPayload(rawBody);
    const eventId = readString(payload.provider_event_id) ?? readString(payload.event_id) ?? `mock_${crypto.randomUUID()}`;
    const eventType = readString(payload.event_type) ?? "subscription.updated";
    const userId = readString(payload.user_id);
    const status = readSubscriptionStatus(payload.status) ?? "active";
    const planCode = readString(payload.plan_code) ?? defaultPlanCode;

    return {
      provider: this.name,
      providerEventId: eventId,
      eventType,
      userId,
      payload,
      subscriptionUpdate: userId
        ? {
            userId,
            status,
            planCode,
            provider: this.name,
            providerCustomerId: readString(payload.provider_customer_id),
            providerSubscriptionId: readString(payload.provider_subscription_id),
            currentPeriodStart: readString(payload.current_period_start),
            currentPeriodEnd: readString(payload.current_period_end),
            trialEndsAt: readString(payload.trial_ends_at),
            cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
            metadata: {
              source: "mock_webhook"
            }
          }
        : undefined
    };
  }
}

class StandardBillingProvider implements BillingProvider {
  constructor(public readonly name: string) {}

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const checkoutBaseUrl = process.env.BILLING_CHECKOUT_URL;
    if (!checkoutBaseUrl) {
      throw new BillingProviderError(
        `Billing provider "${this.name}" does not have a checkout adapter yet. Set BILLING_CHECKOUT_URL or add a provider implementation.`,
        501
      );
    }

    const reference = `${this.name}_${crypto.randomUUID()}`;
    const checkoutUrl = appendQuery(checkoutBaseUrl, {
      user_id: input.userId,
      email: input.email,
      plan_code: input.planCode,
      reference,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    });

    return {
      provider: this.name,
      checkoutUrl,
      externalReference: reference
    };
  }

  async parseWebhook(request: Request, rawBody: string): Promise<BillingWebhookEvent> {
    assertWebhookSecret(request);

    const payload = parseJsonPayload(rawBody);
    const subscriptionPayload = isRecord(payload.subscription) ? payload.subscription : payload;
    const eventId = readString(payload.provider_event_id) ?? readString(payload.event_id) ?? readString(payload.id);
    const eventType = readString(payload.event_type) ?? readString(payload.type);
    const userId = readString(subscriptionPayload.user_id) ?? readString(payload.user_id);
    const status = readSubscriptionStatus(subscriptionPayload.status);

    if (!eventId || !eventType) {
      throw new BillingProviderError("Webhook payload must include provider_event_id/event_id and event_type/type.", 400);
    }

    return {
      provider: this.name,
      providerEventId: eventId,
      eventType,
      userId,
      payload,
      subscriptionUpdate: status
        ? {
            userId,
            status,
            planCode: readString(subscriptionPayload.plan_code) ?? defaultPlanCode,
            provider: this.name,
            providerCustomerId: readString(subscriptionPayload.provider_customer_id),
            providerSubscriptionId: readString(subscriptionPayload.provider_subscription_id),
            currentPeriodStart: readString(subscriptionPayload.current_period_start),
            currentPeriodEnd: readString(subscriptionPayload.current_period_end),
            trialEndsAt: readString(subscriptionPayload.trial_ends_at),
            cancelAtPeriodEnd: Boolean(subscriptionPayload.cancel_at_period_end),
            metadata: {
              source: "standard_webhook"
            }
          }
        : undefined
    };
  }
}

function assertWebhookSecret(request: Request) {
  const expectedSecret = process.env.BILLING_WEBHOOK_SECRET;
  if (!expectedSecret) {
    throw new BillingProviderError("Billing webhook secret is not configured.", 500);
  }

  const actualSecret = request.headers.get("x-billing-webhook-secret");
  if (actualSecret !== expectedSecret) {
    throw new BillingProviderError("Invalid billing webhook secret.", 401);
  }
}

function parseJsonPayload(rawBody: string): JsonRecord {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("Webhook payload must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new BillingProviderError(error.message, 400);
    }
    throw new BillingProviderError("Invalid JSON payload.", 400);
  }
}

function appendQuery(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readBooleanEnv(name: string, defaultValue: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return defaultValue;
  }

  return ["1", "true", "yes", "y", "on"].includes(value);
}

function readSubscriptionStatus(value: unknown): SubscriptionStatus | null {
  if (
    value === "inactive" ||
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "expired"
  ) {
    return value;
  }

  return null;
}
