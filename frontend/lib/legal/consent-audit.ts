import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JsonRecord, UserConsentType } from "@/types/database";

import {
  COOKIE_POLICY_VERSION,
  PRIVACY_VERSION,
  RISK_WARNING_VERSION,
  SUBSCRIPTION_RENEWAL_CONSENT_VERSION,
  TERMS_VERSION,
  WITHDRAWAL_CONSENT_VERSION
} from "./constants";

export type RegistrationConsentInput = {
  acceptedAt: string;
  email: string;
  ipAddress: string | null;
  language: "PL" | "EN";
  userAgent: string | null;
  userId: string | null;
};

export type CheckoutConsentAuditInput = {
  checkoutProvider: string;
  checkoutSessionId?: string | null;
  checkoutUrl?: string | null;
  email: string;
  ipAddress: string | null;
  language: "PL" | "EN";
  metadata?: JsonRecord;
  orderId?: string | null;
  userAgent: string | null;
  userId: string;
};

export async function recordRegistrationConsents(input: RegistrationConsentInput) {
  const supabase = getSupabaseAdminClient();
  const rows = [
    buildConsentRow({
      acceptedAt: input.acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "REGISTER",
      type: "TERMS_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: TERMS_VERSION
    }),
    buildConsentRow({
      acceptedAt: input.acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      privacyPolicyLanguage: input.language,
      privacyPolicyVersion: PRIVACY_VERSION,
      source: "REGISTER",
      type: "PRIVACY_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: PRIVACY_VERSION
    }),
    buildConsentRow({
      acceptedAt: input.acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "REGISTER",
      type: "AGE_CONFIRMATION",
      userAgent: input.userAgent,
      userId: input.userId,
      version: "18_PLUS"
    })
  ];

  const { error } = await supabase.from("user_consents").insert(rows);

  if (error) {
    throw error;
  }
}

export async function recordCheckoutConsents(input: CheckoutConsentAuditInput) {
  const supabase = getSupabaseAdminClient();
  const acceptedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("checkout_consent_audits")
    .insert({
      checkout_provider: input.checkoutProvider,
      checkout_session_id: input.checkoutSessionId ?? null,
      checkout_url: input.checkoutUrl ?? null,
      digital_service_consent_at: acceptedAt,
      email: input.email,
      ip_address: input.ipAddress,
      language: input.language,
      metadata: input.metadata ?? {},
      age_confirmation_accepted: true,
      age_confirmation_accepted_at: acceptedAt,
      accepted_cookie_policy_at: null,
      accepted_privacy_policy_at: acceptedAt,
      cookie_policy_version: COOKIE_POLICY_VERSION,
      no_investment_advice_acknowledged: true,
      no_investment_advice_acknowledged_at: acceptedAt,
      order_id: input.orderId ?? null,
      privacy_policy_language: input.language,
      privacy_policy_version: PRIVACY_VERSION,
      privacy_version: PRIVACY_VERSION,
      risk_warning_accepted: true,
      risk_accepted_at: acceptedAt,
      risk_warning_version: RISK_WARNING_VERSION,
      source: "CHECKOUT",
      subscription_renewal_accepted: true,
      subscription_renewal_accepted_at: acceptedAt,
      subscription_renewal_consent_version: SUBSCRIPTION_RENEWAL_CONSENT_VERSION,
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      user_agent: input.userAgent,
      user_id: input.userId,
      withdrawal_consent_accepted: true,
      withdrawal_consent_version: WITHDRAWAL_CONSENT_VERSION,
      withdrawal_loss_acknowledged: true,
      withdrawal_loss_acknowledged_at: acceptedAt
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const consentRows = [
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "TERMS_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: TERMS_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      privacyPolicyLanguage: input.language,
      privacyPolicyVersion: PRIVACY_VERSION,
      source: "CHECKOUT",
      type: "PRIVACY_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: PRIVACY_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "RISK_WARNING_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: RISK_WARNING_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "NO_INVESTMENT_ADVICE_ACKNOWLEDGEMENT",
      userAgent: input.userAgent,
      userId: input.userId,
      version: RISK_WARNING_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "DIGITAL_SERVICE_CONSENT",
      userAgent: input.userAgent,
      userId: input.userId,
      version: WITHDRAWAL_CONSENT_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "WITHDRAWAL_LOSS_ACKNOWLEDGEMENT",
      userAgent: input.userAgent,
      userId: input.userId,
      version: WITHDRAWAL_CONSENT_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "SUBSCRIPTION_RENEWAL_ACCEPTANCE",
      userAgent: input.userAgent,
      userId: input.userId,
      version: SUBSCRIPTION_RENEWAL_CONSENT_VERSION
    }),
    buildConsentRow({
      acceptedAt,
      email: input.email,
      ipAddress: input.ipAddress,
      language: input.language,
      source: "CHECKOUT",
      type: "AGE_CONFIRMATION",
      userAgent: input.userAgent,
      userId: input.userId,
      version: "18_PLUS"
    })
  ];

  const { error: consentError } = await supabase.from("user_consents").insert(consentRows);

  if (consentError) {
    throw consentError;
  }

  return data;
}

function buildConsentRow({
  acceptedAt,
  email,
  ipAddress,
  language,
  source,
  type,
  userAgent,
  userId,
  version,
  privacyPolicyLanguage,
  privacyPolicyVersion
}: {
  acceptedAt: string;
  email: string;
  ipAddress: string | null;
  language: "PL" | "EN";
  source: "REGISTER" | "CHECKOUT";
  type: UserConsentType;
  userAgent: string | null;
  userId: string | null;
  version: string;
  privacyPolicyLanguage?: "PL" | "EN";
  privacyPolicyVersion?: string;
}) {
  return {
    accepted_at: acceptedAt,
    email,
    ip_address: ipAddress,
    language,
    source,
    type,
    privacy_policy_language: privacyPolicyLanguage ?? null,
    privacy_policy_version: privacyPolicyVersion ?? null,
    user_agent: userAgent,
    user_id: userId,
    version
  };
}
