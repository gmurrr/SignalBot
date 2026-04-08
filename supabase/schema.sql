begin;

create extension if not exists pgcrypto;

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

alter table public.market_data enable row level security;
alter table public.signals enable row level security;

drop policy if exists "public read market_data" on public.market_data;
create policy "public read market_data"
    on public.market_data
    for select
    to anon, authenticated
    using (true);

drop policy if exists "public read signals" on public.signals;
create policy "public read signals"
    on public.signals
    for select
    to anon, authenticated
    using (true);

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
