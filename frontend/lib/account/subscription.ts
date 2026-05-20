import type { SubscriptionRow, UserAccountRow } from "@/types/database";

export type AccountOverview = {
  account: UserAccountRow | null;
  subscription: SubscriptionRow | null;
  hasAccess: boolean;
  provider: string;
};

const activeStatuses = new Set<SubscriptionRow["status"]>(["active", "trialing"]);

export function isPrivilegedAccount(account: UserAccountRow | null | undefined) {
  return account?.role === "admin" || account?.role === "support";
}

export function hasActiveSubscription(subscription: SubscriptionRow | null | undefined, now = new Date()) {
  if (!subscription || !activeStatuses.has(subscription.status)) {
    return false;
  }

  if (!subscription.current_period_end) {
    return true;
  }

  return new Date(subscription.current_period_end).getTime() >= now.getTime();
}

export function hasDashboardAccess(account: UserAccountRow | null, subscription: SubscriptionRow | null) {
  return isPrivilegedAccount(account) || hasActiveSubscription(subscription);
}

export function getSubscriptionLabel(subscription: SubscriptionRow | null) {
  if (!subscription) {
    return "inactive";
  }

  return subscription.status;
}
