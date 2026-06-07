export type SignalStatus = "ACTIVE" | "CLOSED" | "EXPIRED";
export type SignalType = "Buy" | "Sell";
export type AccountRole = "user" | "admin" | "support";
export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled" | "expired";
export type AccountSecurityEventType = "password_reset_requested" | "password_updated";
export type UserConsentSource = "REGISTER" | "CHECKOUT";
export type LegalLanguage = "PL" | "EN";
export type UserConsentType =
  | "TERMS_ACCEPTANCE"
  | "PRIVACY_ACCEPTANCE"
  | "COOKIE_POLICY_ACCEPTANCE"
  | "RISK_WARNING_ACCEPTANCE"
  | "NO_INVESTMENT_ADVICE_ACKNOWLEDGEMENT"
  | "DIGITAL_SERVICE_CONSENT"
  | "WITHDRAWAL_LOSS_ACKNOWLEDGEMENT"
  | "SUBSCRIPTION_RENEWAL_ACCEPTANCE"
  | "AGE_CONFIRMATION";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type JsonRecord = { [key: string]: Json | undefined };

export interface MarketDataRow {
  [key: string]: unknown;
  id: string;
  symbol: string;
  tick_time: string;
  bid: number;
  ask: number;
  mid: number;
  source: string;
  timeframe: string;
  extra: JsonRecord;
  updated_at: string;
}

export interface SignalRow {
  [key: string]: unknown;
  id: string;
  symbol: string;
  type: SignalType;
  entry_price: number;
  tp: number;
  sl: number;
  status: SignalStatus;
  timestamp: string;
  expires_at: string;
  closed_at: string | null;
  exit_price: number | null;
  result_pips: number | null;
  close_reason: string | null;
  confidence: number;
  timeframe: string;
  strategy_version: string;
  reason: string;
  dxy_bias: string;
  session_name: string;
  liquidity_cleared: boolean;
  indicator_snapshot: Record<string, number | string | null>;
  metadata: JsonRecord;
  updated_at: string;
}

export interface UserAccountRow {
  [key: string]: unknown;
  id: string;
  email: string;
  billing_email: string | null;
  full_name: string | null;
  role: AccountRole;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan_code: string;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
}

export interface PaymentEventRow {
  [key: string]: unknown;
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  user_id: string | null;
  subscription_id: string | null;
  payload: JsonRecord;
  processed_at: string | null;
  created_at: string;
}

export interface AccountSecurityEventRow {
  [key: string]: unknown;
  id: string;
  user_id: string | null;
  email: string;
  event_type: AccountSecurityEventType;
  metadata: JsonRecord;
  created_at: string;
}

export interface UserConsentRow {
  [key: string]: unknown;
  id: string;
  user_id: string | null;
  email: string;
  type: UserConsentType;
  version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  language: LegalLanguage;
  privacy_policy_version: string | null;
  privacy_policy_language: LegalLanguage | null;
  source: UserConsentSource;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
}

export interface CheckoutConsentAuditRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  email: string;
  terms_version: string;
  terms_accepted_at: string;
  privacy_version: string;
  privacy_policy_version: string;
  privacy_policy_language: LegalLanguage;
  accepted_privacy_policy_at: string;
  cookie_policy_version: string | null;
  accepted_cookie_policy_at: string | null;
  risk_warning_version: string;
  risk_warning_accepted: boolean;
  risk_accepted_at: string;
  no_investment_advice_acknowledged: boolean;
  no_investment_advice_acknowledged_at: string;
  withdrawal_consent_version: string;
  withdrawal_consent_accepted: boolean;
  digital_service_consent_at: string;
  withdrawal_loss_acknowledged: boolean;
  withdrawal_loss_acknowledged_at: string;
  subscription_renewal_consent_version: string;
  subscription_renewal_accepted: boolean;
  subscription_renewal_accepted_at: string;
  age_confirmation_accepted: boolean;
  age_confirmation_accepted_at: string | null;
  checkout_provider: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  order_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  language: LegalLanguage;
  source: "CHECKOUT";
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      market_data: {
        Row: MarketDataRow;
        Insert: Omit<MarketDataRow, "id" | "updated_at"> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<MarketDataRow>;
        Relationships: [];
      };
      signals: {
        Row: SignalRow;
        Insert: Omit<SignalRow, "id" | "timestamp" | "updated_at"> & {
          id?: string;
          timestamp?: string;
          updated_at?: string;
        };
        Update: Partial<SignalRow>;
        Relationships: [];
      };
      user_accounts: {
        Row: UserAccountRow;
        Insert: {
          id: string;
          email: string;
          billing_email?: string | null;
          full_name?: string | null;
          role?: AccountRole;
          metadata?: JsonRecord;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserAccountRow, "id" | "created_at">>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: {
          id?: string;
          user_id: string;
          status?: SubscriptionStatus;
          plan_code?: string;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          trial_ends_at?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: JsonRecord;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<SubscriptionRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      payment_events: {
        Row: PaymentEventRow;
        Insert: {
          id?: string;
          provider: string;
          provider_event_id: string;
          event_type: string;
          user_id?: string | null;
          subscription_id?: string | null;
          payload?: JsonRecord;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<PaymentEventRow, "id" | "provider" | "provider_event_id" | "created_at">>;
        Relationships: [];
      };
      account_security_events: {
        Row: AccountSecurityEventRow;
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          event_type: AccountSecurityEventType;
          metadata?: JsonRecord;
          created_at?: string;
        };
        Update: Partial<Omit<AccountSecurityEventRow, "id" | "created_at">>;
        Relationships: [];
      };
      user_consents: {
        Row: UserConsentRow;
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          type: UserConsentType;
          version: string;
          accepted_at: string;
          ip_address?: string | null;
          user_agent?: string | null;
          language?: LegalLanguage;
          privacy_policy_version?: string | null;
          privacy_policy_language?: LegalLanguage | null;
          source: UserConsentSource;
          metadata?: JsonRecord;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserConsentRow, "id" | "created_at">>;
        Relationships: [];
      };
      checkout_consent_audits: {
        Row: CheckoutConsentAuditRow;
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          terms_version: string;
          terms_accepted_at: string;
          privacy_version?: string;
          privacy_policy_version?: string;
          privacy_policy_language?: LegalLanguage;
          accepted_privacy_policy_at: string;
          cookie_policy_version?: string | null;
          accepted_cookie_policy_at?: string | null;
          risk_warning_version?: string;
          risk_warning_accepted?: boolean;
          risk_accepted_at: string;
          no_investment_advice_acknowledged?: boolean;
          no_investment_advice_acknowledged_at: string;
          withdrawal_consent_version?: string;
          withdrawal_consent_accepted?: boolean;
          digital_service_consent_at: string;
          withdrawal_loss_acknowledged?: boolean;
          withdrawal_loss_acknowledged_at: string;
          subscription_renewal_consent_version?: string;
          subscription_renewal_accepted?: boolean;
          subscription_renewal_accepted_at: string;
          age_confirmation_accepted?: boolean;
          age_confirmation_accepted_at?: string | null;
          checkout_provider: string;
          checkout_session_id?: string | null;
          checkout_url?: string | null;
          order_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          language?: LegalLanguage;
          source?: "CHECKOUT";
          metadata?: JsonRecord;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CheckoutConsentAuditRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
    };
    Functions: {
      has_active_subscription: {
        Args: {
          account_id?: string;
        };
        Returns: boolean;
      };
      is_account_admin: {
        Args: {
          account_id?: string;
        };
        Returns: boolean;
      };
      user_email_exists: {
        Args: {
          check_email: string;
        };
        Returns: boolean;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
