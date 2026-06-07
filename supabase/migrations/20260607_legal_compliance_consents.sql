begin;

alter table if exists public.user_consents
    drop constraint if exists user_consents_type_check;

alter table if exists public.user_consents
    add constraint user_consents_type_check
    check (type in (
        'TERMS_ACCEPTANCE',
        'PRIVACY_ACCEPTANCE',
        'COOKIE_POLICY_ACCEPTANCE',
        'RISK_WARNING_ACCEPTANCE',
        'NO_INVESTMENT_ADVICE_ACKNOWLEDGEMENT',
        'DIGITAL_SERVICE_CONSENT',
        'WITHDRAWAL_LOSS_ACKNOWLEDGEMENT',
        'SUBSCRIPTION_RENEWAL_ACCEPTANCE',
        'AGE_CONFIRMATION'
    ));

alter table if exists public.user_consents
    add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_user_consents_updated_at on public.user_consents;
create trigger set_user_consents_updated_at
    before update on public.user_consents
    for each row
    execute function public.set_updated_at();

alter table if exists public.checkout_consent_audits
    add column if not exists accepted_privacy_policy_at timestamptz;

alter table if exists public.checkout_consent_audits
    add column if not exists cookie_policy_version text;

alter table if exists public.checkout_consent_audits
    add column if not exists accepted_cookie_policy_at timestamptz;

alter table if exists public.checkout_consent_audits
    add column if not exists risk_warning_accepted boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists no_investment_advice_acknowledged boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists no_investment_advice_acknowledged_at timestamptz;

alter table if exists public.checkout_consent_audits
    add column if not exists withdrawal_consent_accepted boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists withdrawal_loss_acknowledged boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists subscription_renewal_accepted boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists age_confirmation_accepted boolean not null default false;

alter table if exists public.checkout_consent_audits
    add column if not exists age_confirmation_accepted_at timestamptz;

alter table if exists public.checkout_consent_audits
    add column if not exists updated_at timestamptz not null default now();

update public.checkout_consent_audits
set
    accepted_privacy_policy_at = coalesce(accepted_privacy_policy_at, terms_accepted_at),
    risk_warning_accepted = risk_warning_accepted or risk_accepted_at is not null,
    no_investment_advice_acknowledged = no_investment_advice_acknowledged or risk_accepted_at is not null,
    no_investment_advice_acknowledged_at = coalesce(no_investment_advice_acknowledged_at, risk_accepted_at),
    withdrawal_consent_accepted = withdrawal_consent_accepted or digital_service_consent_at is not null,
    withdrawal_loss_acknowledged = withdrawal_loss_acknowledged or withdrawal_loss_acknowledged_at is not null,
    subscription_renewal_accepted = subscription_renewal_accepted or subscription_renewal_accepted_at is not null,
    updated_at = now()
where accepted_privacy_policy_at is null
   or risk_warning_accepted = false
   or no_investment_advice_acknowledged = false
   or withdrawal_consent_accepted = false
   or withdrawal_loss_acknowledged = false
   or subscription_renewal_accepted = false;

alter table if exists public.checkout_consent_audits
    alter column accepted_privacy_policy_at set not null;

drop trigger if exists set_checkout_consent_audits_updated_at on public.checkout_consent_audits;
create trigger set_checkout_consent_audits_updated_at
    before update on public.checkout_consent_audits
    for each row
    execute function public.set_updated_at();

alter table if exists public.user_consents enable row level security;
alter table if exists public.checkout_consent_audits enable row level security;

commit;
