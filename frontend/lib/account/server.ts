import type { User } from "@supabase/supabase-js";

import { hasDashboardAccess } from "@/lib/account/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountOverview } from "@/lib/account/subscription";
import type { JsonRecord, SubscriptionRow, UserAccountRow } from "@/types/database";

export async function ensureUserAccount(user: User) {
  const supabase = getSupabaseAdminClient();
  const email = user.email ?? "";
  const metadata = normalizeMetadata(user.user_metadata);

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingAccountError) {
    throw existingAccountError;
  }

  const account = existingAccount
    ? await updateExistingAccount({
        current: existingAccount as UserAccountRow,
        email,
        metadata
      })
    : await createUserAccount({
        email,
        metadata,
        userId: user.id
      });

  const subscription = await ensureSubscription(user.id);

  return {
    account,
    subscription
  };
}

async function createUserAccount({ email, metadata, userId }: { email: string; metadata: JsonRecord; userId: string }) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_accounts")
    .insert({
      id: userId,
      email,
      metadata
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as UserAccountRow;
}

async function updateExistingAccount({ current, email, metadata }: { current: UserAccountRow; email: string; metadata: JsonRecord }) {
  const supabase = getSupabaseAdminClient();
  const mergedMetadata = mergeMissingMetadata(current.metadata, metadata);
  const updatePayload: { email?: string; metadata?: JsonRecord } = {};

  if (email && current.email !== email) {
    updatePayload.email = email;
  }

  if (hasNewMetadataKeys(current.metadata, mergedMetadata)) {
    updatePayload.metadata = mergedMetadata;
  }

  if (!updatePayload.email && !updatePayload.metadata) {
    return current;
  }

  const { data, error } = await supabase.from("user_accounts").update(updatePayload).eq("id", current.id).select("*").single();

  if (error) {
    throw error;
  }

  return data as UserAccountRow;
}

export async function getAccountOverview(user: User): Promise<AccountOverview> {
  const { account, subscription } = await ensureUserAccount(user);

  return {
    account,
    billingPortalUrl: getBillingPortalUrl(),
    subscription,
    hasAccess: hasDashboardAccess(account, subscription),
    provider: process.env.BILLING_PROVIDER || "mock"
  };
}

function getBillingPortalUrl() {
  return process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_BILLING_PORTAL_URL || null;
}

async function ensureSubscription(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as SubscriptionRow;
  }

  const { data: created, error: createError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      status: "inactive",
      plan_code: "free"
    })
    .select("*")
    .single();

  if (createError) {
    throw createError;
  }

  return created as SubscriptionRow;
}

function normalizeMetadata(metadata: User["user_metadata"]): JsonRecord {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as JsonRecord;
}

function mergeMissingMetadata(current: JsonRecord, incoming: JsonRecord) {
  return {
    ...incoming,
    ...current
  };
}

function hasNewMetadataKeys(current: JsonRecord, merged: JsonRecord) {
  return Object.keys(merged).some((key) => !(key in current));
}
