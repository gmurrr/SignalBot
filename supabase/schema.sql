-- SignalBot schema for Supabase (PostgreSQL)
-- This version is designed to be extendable for future indicators/timeframes.

begin;

create extension if not exists pgcrypto;

-- =========================================
-- TABLE: market_data
-- Stores raw tick-by-tick market stream data.
-- =========================================
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

-- Upsert target from backend (symbol)
-- NOTE: If you already have data with multiple rows per `symbol`, adding this unique index may fail.
drop index if exists public.market_data_symbol_tick_time_uniq;
create unique index if not exists market_data_symbol_uniq
    on public.market_data (symbol);

create index if not exists market_data_tick_time_idx
    on public.market_data (tick_time desc);

create index if not exists market_data_timeframe_idx
    on public.market_data (timeframe);


-- =========================================
-- TABLE: signals
-- Stores generated trading signals from strategy engine.
-- =========================================
create table if not exists public.signals (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    signal smallint not null check (signal in (-1, 0, 1)),
    reason text not null,
    regime text not null default 'range',
    confidence numeric(6,4) not null default 0,
    price numeric(18,8) not null,
    timeframe text not null default 'tick',
    strategy_version text not null default 'v1',
    indicator_snapshot jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    market_tick_time timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists signals_symbol_created_idx
    on public.signals (symbol, created_at desc);

create index if not exists signals_signal_idx
    on public.signals (signal);

create index if not exists signals_timeframe_idx
    on public.signals (timeframe);

create index if not exists signals_strategy_version_idx
    on public.signals (strategy_version);

commit;
