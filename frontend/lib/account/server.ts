import type { User } from "@supabase/supabase-js";

import { hasDashboardAccess } from "@/lib/account/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountOverview } from "@/lib/account/subscription";
import type { JsonRecord, SubscriptionRow, UserAccountRow } from "@/types/database";

export async function ensureUserAccount(user: User) {
  const supabase = getSupabaseAdminClient();
  const email = user.email ?? "";
  const metadata = normalizeMetadata(user.user_metadata);

  const { data: account, error: accountError } = await supabase
    .from("user_accounts")
    .upsert(
      {
        id: user.id,
        email,
        metadata
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (accountError) {
    throw accountError;
  }

  const subscription = await ensureSubscription(user.id);

  return {
    account: account as UserAccountRow,
    subscription
  };
}

export async function getAccountOverview(user: User): Promise<AccountOverview> {
  const { account, subscription } = await ensureUserAccount(user);

  return {
    account,
    subscription,
    hasAccess: hasDashboardAccess(account, subscription),
    provider: process.env.BILLING_PROVIDER || "mock"
  };
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
