import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountSecurityEventType, JsonRecord, UserAccountRow } from "@/types/database";

type SecurityEventInput = {
  email: string;
  eventType: AccountSecurityEventType;
  metadata?: JsonRecord;
  userId?: string | null;
};

export async function findAccountByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from("user_accounts")
    .select("id,email")
    .ilike("email", escapeLikePattern(normalizedEmail))
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0] as Pick<UserAccountRow, "id" | "email"> | undefined) ?? null;
}

export async function findAccountById(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("user_accounts").select("id,email").eq("id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Pick<UserAccountRow, "id" | "email"> | null) ?? null;
}

export async function recordAccountSecurityEvent({ email, eventType, metadata = {}, userId }: SecurityEventInput) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const account = userId ? await findAccountById(userId).catch(() => null) : await findAccountByEmail(normalizedEmail);

  const { error } = await supabase.from("account_security_events").insert({
    email: normalizedEmail || account?.email || "",
    event_type: eventType,
    metadata,
    user_id: account?.id ?? null
  });

  if (error) {
    throw error;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
