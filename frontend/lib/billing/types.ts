import type { JsonRecord, SubscriptionStatus } from "@/types/database";

export const PENDING_PAYMENT_OPERATOR = "pending_payment_operator";

export type CheckoutSessionInput = {
  userId: string;
  email: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = {
  provider: string;
  checkoutUrl: string;
  externalReference: string;
  metadata?: JsonRecord;
};

export type SubscriptionUpdate = {
  userId?: string | null;
  status: SubscriptionStatus;
  planCode: string;
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  metadata?: JsonRecord;
};

export type BillingWebhookEvent = {
  provider: string;
  providerEventId: string;
  eventType: string;
  userId?: string | null;
  payload: JsonRecord;
  subscriptionUpdate?: SubscriptionUpdate;
};

export interface BillingProvider {
  name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  parseWebhook(request: Request, rawBody: string): Promise<BillingWebhookEvent>;
}
