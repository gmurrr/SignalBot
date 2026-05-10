import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingWebhookEvent, SubscriptionUpdate } from "@/lib/billing/types";
import type { JsonRecord, PaymentEventRow, SubscriptionRow } from "@/types/database";

export async function applySubscriptionUpdate(update: SubscriptionUpdate) {
  const supabase = getSupabaseAdminClient();
  const userId = update.userId ?? (await findUserIdForProviderSubscription(update));

  if (!userId) {
    throw new Error("Cannot apply subscription update without user_id or an existing provider subscription match.");
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        status: update.status,
        plan_code: update.planCode,
        provider: update.provider,
        provider_customer_id: update.providerCustomerId ?? null,
        provider_subscription_id: update.providerSubscriptionId ?? null,
        current_period_start: update.currentPeriodStart ?? null,
        current_period_end: update.currentPeriodEnd ?? null,
        trial_ends_at: update.trialEndsAt ?? null,
        cancel_at_period_end: update.cancelAtPeriodEnd ?? false,
        metadata: update.metadata ?? {}
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as SubscriptionRow;
}

export async function recordPaymentEvent(event: BillingWebhookEvent, subscriptionId?: string | null) {
  const supabase = getSupabaseAdminClient();
  const payload = normalizePayload(event.payload);

  const { data, error } = await supabase
    .from("payment_events")
    .upsert(
      {
        provider: event.provider,
        provider_event_id: event.providerEventId,
        event_type: event.eventType,
        user_id: event.userId ?? event.subscriptionUpdate?.userId ?? null,
        subscription_id: subscriptionId ?? null,
        payload,
        processed_at: new Date().toISOString()
      },
      { onConflict: "provider,provider_event_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PaymentEventRow;
}

export async function activateMockSubscription(userId: string, planCode: string) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  return applySubscriptionUpdate({
    userId,
    provider: "mock",
    status: "active",
    planCode,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    providerCustomerId: `mock_customer_${userId}`,
    providerSubscriptionId: `mock_subscription_${userId}`,
    metadata: {
      mode: "mock",
      activated_at: now.toISOString()
    }
  });
}

async function findUserIdForProviderSubscription(update: SubscriptionUpdate) {
  const supabase = getSupabaseAdminClient();

  if (update.providerSubscriptionId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("provider", update.provider)
      .eq("provider_subscription_id", update.providerSubscriptionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.user_id) {
      return data.user_id;
    }
  }

  if (update.providerCustomerId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("provider", update.provider)
      .eq("provider_customer_id", update.providerCustomerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.user_id ?? null;
  }

  return null;
}

function normalizePayload(payload: JsonRecord): JsonRecord {
  return payload;
}
