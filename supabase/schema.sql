begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.market_data (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    tick_time timestamptz not null,
    bid numeric(18,8) not null,
    ask numeric(18,8) not null,
    mid numeric(18,8) not null,
    source text not null default 'mt5',
    timeframe text not null default 'tick',
    extra jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create unique index if not exists market_data_symbol_uniq
    on public.market_data (symbol);

create index if not exists market_data_tick_time_idx
    on public.market_data (tick_time desc);

create table if not exists public.signals (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    type text not null check (type in ('Buy', 'Sell')),
    entry_price numeric(18,8) not null,
    tp numeric(18,8) not null,
    sl numeric(18,8) not null,
    status text not null check (status in ('ACTIVE', 'CLOSED', 'EXPIRED')),
    "timestamp" timestamptz not null default now(),
    expires_at timestamptz not null,
    closed_at timestamptz,
    exit_price numeric(18,8),
    result_pips numeric(12,2),
    close_reason text,
    confidence numeric(6,4) not null default 0,
    timeframe text not null default 'M1',
    strategy_version text not null default 'smart-signals-v2',
    reason text not null default 'signal_generated',
    dxy_bias text not null default 'NEUTRAL_DXY',
    session_name text not null default 'MONITORING',
    liquidity_cleared boolean not null default false,
    indicator_snapshot jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists signals_symbol_timestamp_idx
    on public.signals (symbol, "timestamp" desc);

create index if not exists signals_status_idx
    on public.signals (status);

create index if not exists signals_symbol_status_idx
    on public.signals (symbol, status);

create table if not exists public.user_accounts (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    billing_email text,
    full_name text,
    role text not null default 'user'
        check (role in ('user', 'admin', 'support')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists user_accounts_email_uniq
    on public.user_accounts (lower(email))
    where email <> '';

drop trigger if exists set_user_accounts_updated_at on public.user_accounts;
create trigger set_user_accounts_updated_at
    before update on public.user_accounts
    for each row
    execute function public.set_updated_at();

create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_accounts(id) on delete cascade,
    status text not null default 'inactive'
        check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
    plan_code text not null default 'free',
    provider text,
    provider_customer_id text,
    provider_subscription_id text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    trial_ends_at timestamptz,
    cancel_at_period_end boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_uniq
    on public.subscriptions (user_id);

create index if not exists subscriptions_provider_customer_idx
    on public.subscriptions (provider, provider_customer_id)
    where provider_customer_id is not null;

create index if not exists subscriptions_provider_subscription_idx
    on public.subscriptions (provider, provider_subscription_id)
    where provider_subscription_id is not null;

create index if not exists subscriptions_status_period_idx
    on public.subscriptions (status, current_period_end desc);

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
    before update on public.subscriptions
    for each row
    execute function public.set_updated_at();

create table if not exists public.payment_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    provider_event_id text not null,
    event_type text not null,
    user_id uuid references public.user_accounts(id) on delete set null,
    subscription_id uuid references public.subscriptions(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    processed_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists payment_events_provider_event_uniq
    on public.payment_events (provider, provider_event_id);

create index if not exists payment_events_user_created_idx
    on public.payment_events (user_id, created_at desc);

create table if not exists public.account_security_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.user_accounts(id) on delete set null,
    email text not null,
    event_type text not null
        check (event_type in ('password_reset_requested', 'password_updated')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists account_security_events_user_created_idx
    on public.account_security_events (user_id, created_at desc);

create index if not exists account_security_events_email_created_idx
    on public.account_security_events (lower(email), created_at desc);

create table if not exists public.user_consents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.user_accounts(id) on delete set null,
    email text not null,
    type text not null
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
        )),
    version text not null,
    accepted_at timestamptz not null,
    ip_address text,
    user_agent text,
    language text not null default 'PL'
        check (language in ('PL', 'EN')),
    privacy_policy_version text,
    privacy_policy_language text
        check (privacy_policy_language in ('PL', 'EN')),
    source text not null
        check (source in ('REGISTER', 'CHECKOUT')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists set_user_consents_updated_at on public.user_consents;
create trigger set_user_consents_updated_at
    before update on public.user_consents
    for each row
    execute function public.set_updated_at();

create index if not exists user_consents_user_created_idx
    on public.user_consents (user_id, created_at desc);

create index if not exists user_consents_email_created_idx
    on public.user_consents (lower(email), created_at desc);

create table if not exists public.checkout_consent_audits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_accounts(id) on delete cascade,
    email text not null,
    cookie_policy_version text,
    accepted_cookie_policy_at timestamptz,
    risk_warning_version text not null default '1.0',
    risk_warning_accepted boolean not null default false,
    risk_accepted_at timestamptz not null,
    no_investment_advice_acknowledged boolean not null default false,
    no_investment_advice_acknowledged_at timestamptz not null default now(),
    withdrawal_consent_version text not null default '1.0',
    withdrawal_consent_accepted boolean not null default false,
    digital_service_consent_at timestamptz not null,
    withdrawal_loss_acknowledged boolean not null default false,
    withdrawal_loss_acknowledged_at timestamptz not null,
    subscription_renewal_consent_version text not null default '1.0',
    subscription_renewal_accepted boolean not null default false,
    subscription_renewal_accepted_at timestamptz not null,
    checkout_provider text not null,
    checkout_session_id text,
    checkout_url text,
    order_id text,
    ip_address text,
    user_agent text,
    language text not null default 'PL'
        check (language in ('PL', 'EN')),
    source text not null default 'CHECKOUT'
        check (source = 'CHECKOUT'),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists set_checkout_consent_audits_updated_at on public.checkout_consent_audits;
create trigger set_checkout_consent_audits_updated_at
    before update on public.checkout_consent_audits
    for each row
    execute function public.set_updated_at();

create index if not exists checkout_consent_audits_user_created_idx
    on public.checkout_consent_audits (user_id, created_at desc);

create index if not exists checkout_consent_audits_provider_session_idx
    on public.checkout_consent_audits (checkout_provider, checkout_session_id)
    where checkout_session_id is not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_accounts (id, email, full_name, metadata)
    values (
        new.id,
        coalesce(new.email, ''),
        nullif(new.raw_user_meta_data->>'full_name', ''),
        coalesce(new.raw_user_meta_data, '{}'::jsonb)
    )
    on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.user_accounts.full_name, excluded.full_name),
        metadata = excluded.metadata || public.user_accounts.metadata;

    insert into public.subscriptions (user_id, status, plan_code)
    values (new.id, 'inactive', 'free')
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_auth_user();

create or replace function public.is_account_admin(account_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_accounts account
        where account.id = account_id
          and account.role in ('admin', 'support')
    );
$$;

create or replace function public.has_active_subscription(account_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_account_admin(account_id)
        or exists (
            select 1
            from public.subscriptions subscription
            where subscription.user_id = account_id
              and subscription.status in ('active', 'trialing')
              and (
                  subscription.current_period_end is null
                  or subscription.current_period_end >= now()
              )
        );
$$;

create or replace function public.user_email_exists(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_accounts account
        where lower(account.email) = lower(trim(check_email))
    );
$$;

grant execute on function public.is_account_admin(uuid) to authenticated;
grant execute on function public.has_active_subscription(uuid) to authenticated;

alter table public.market_data enable row level security;
alter table public.signals enable row level security;
alter table public.user_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.account_security_events enable row level security;
alter table public.user_consents enable row level security;
alter table public.checkout_consent_audits enable row level security;

drop policy if exists "subscribers read market_data" on public.market_data;
create policy "subscribers read market_data"
    on public.market_data
    for select
    to authenticated
    using (public.has_active_subscription());

drop policy if exists "subscribers read signals" on public.signals;
create policy "subscribers read signals"
    on public.signals
    for select
    to authenticated
    using (public.has_active_subscription());

drop policy if exists "accounts read own profile" on public.user_accounts;
create policy "accounts read own profile"
    on public.user_accounts
    for select
    to authenticated
    using (id = auth.uid() or public.is_account_admin());

drop policy if exists "accounts read own subscription" on public.subscriptions;
create policy "accounts read own subscription"
    on public.subscriptions
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_account_admin());

drop policy if exists "accounts read own payment events" on public.payment_events;
create policy "accounts read own payment events"
    on public.payment_events
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_account_admin());

drop policy if exists "accounts read own security events" on public.account_security_events;
create policy "accounts read own security events"
    on public.account_security_events
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_account_admin());

drop policy if exists "accounts read own consents" on public.user_consents;
create policy "accounts read own consents"
    on public.user_consents
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_account_admin());

drop policy if exists "accounts read own checkout consent audits" on public.checkout_consent_audits;
create policy "accounts read own checkout consent audits"
    on public.checkout_consent_audits
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_account_admin());

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'market_data'
    ) then
        alter publication supabase_realtime add table public.market_data;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'signals'
    ) then
        alter publication supabase_realtime add table public.signals;
    end if;
end $$;

commit;
