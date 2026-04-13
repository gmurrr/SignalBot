# SignalBot Monorepo

Professional XAU/USD signal platform built as a monorepo:

- `backend/` - Python + MetaTrader5 + `supabase-py`
- `frontend/` - Next.js App Router + Tailwind CSS + Framer Motion
- `supabase/` - shared database schema and realtime contract

## Structure

```text
SignalBot/
  backend/
    .env.example
    requirements.txt
    src/
      clients/
      config/
      data/
      models/
      services/
      strategy/
      utils/
      main.py
  frontend/
    .env.example
    app/
    components/
    lib/
    types/
    package.json
  supabase/
    schema.sql
  README.md
```

## Runtime Flow

1. MT5 streams XAU/USD and DXY prices into the Python process.
2. Backend keeps rolling market windows in RAM and evaluates AlphaNode V2.
3. Backend writes market snapshots and signal state to Supabase.
4. Frontend listens with Supabase Realtime and updates the dashboard instantly.

## Backend Quick Start

1. Copy `backend/.env.example` to `backend/.env`
2. Fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MT5_SYMBOL`
   - `DXY_SYMBOL`
   - optional MT5 login fields
3. Run:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m src.main
```

### Important backend variables

- `SEED_CANDLE_COUNT` - M1 history used to derive M5 execution windows
- `H1_SEED_CANDLE_COUNT` - XAU H1 bias history
- `DXY_SEED_H1_COUNT` - DXY H1 bias history
- `SIGNAL_EXPIRY_MINUTES` - hard timeout for stale trades
- `TRADING_TIMEZONE` - local session clock, default `Europe/Warsaw`

## Frontend Quick Start

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run:

```bash
cd frontend
npm install
npm run dev
```

Dashboard:

- `http://localhost:3000/dashboard`

## Supabase Setup

Apply [supabase/schema.sql](C:\Users\gmdam\Documents\GitHub\SignalBot\supabase\schema.sql) in Supabase SQL Editor.

The schema provides:

- `market_data` with one live row per symbol
- `signals` with lifecycle states and AlphaNode V2 context fields
- public read policies for frontend consumption
- realtime publication for both tables

## AlphaNode V2 Strategy Handbook

AlphaNode V2 replaces the older indicator-score approach with a hierarchy based on market structure, environment filters and liquidity behavior.

### Decision Hierarchy

```mermaid
flowchart TD
    A["Time-Block Filter"] --> B["DXY Correlation Filter"]
    B --> C["H1 Bias: EMA200 + Ichimoku Kumo"]
    C --> D["H1 Liquidity Sweep"]
    D --> E["M5 Trigger: FVG or Engulfing + RSI Reversal"]
    E --> F["Risk Engine: SL under sweep, TP1 1:1.5, TP2 next H1 liquidity"]
```

Why this order matters:

- If session liquidity is poor, execution is disabled before technical signals are considered.
- If DXY is hostile for gold longs, the engine blocks long setups even when XAU looks attractive on local indicators.
- Only after environment conditions are valid does the engine look for liquidity events and M5 triggers.

### H1 Bias / M5 Execution Architecture

Layer 1: H1 Directional Bias

- XAU H1 price is evaluated against EMA 200.
- XAU H1 price must also be positioned above or below the Ichimoku cloud.
- DXY H1 is evaluated independently and can block long gold setups.
- Session windows:
  - `LONDON_OPEN`: 09:00 - 12:00 local trading time
  - `NY_OPEN_OVERLAP`: 14:30 - 18:30 local trading time
  - Outside these windows the engine stays in `MONITORING`

Layer 2: Liquidity Sweep

- The engine scans the last 24 H1 candles for swing highs and swing lows.
- A long setup requires a sweep below the tracked H1 swing low and a reclaim above that level within 3 M5 candles.
- A short setup mirrors the same logic above H1 swing highs.

Layer 3: M5 Execution Trigger

- After liquidity is cleared, the engine waits for:
  - bullish or bearish Fair Value Gap
  - or bullish / bearish engulfing
  - plus RSI reversal from exhaustion
- Stop loss is anchored beyond the candle that performed the sweep.
- TP1 is fixed at 1:1.5 RR.
- TP2 is the next H1 liquidity pool and is stored in metadata.

### Psychology of the System

AlphaNode V2 follows the Smart Money Concepts idea that the cleanest move often comes after the market first runs liquidity.

Why the system waits for the sweep:

- Retail traders often place stops around obvious highs and lows.
- Stronger players can push price through those levels to collect liquidity.
- Entering before that event often means buying directly into the trap.
- By waiting for the sweep and then a reclaim, the system looks for confirmation that the manipulation has already happened.

In practice this means AlphaNode V2 prefers:

- patience over frequency
- execution after displacement, not before
- structural confirmation over raw indicator crossover events

### Technical Stack

- Python process:
  - receives live MT5 ticks
  - maintains M1, M5, H1 and DXY H1 rolling windows in RAM
  - computes bias, sweep state, trigger and risk parameters
- MT5:
  - provides XAU/USD and DXY market data
  - remains the low-latency source of truth for live prices
- Supabase:
  - stores `market_data` snapshots and `signals`
  - distributes updates to the frontend through Realtime

## Data Contract

### `signals`

Core columns:

- `id`
- `symbol`
- `type`
- `entry_price`
- `tp`
- `sl`
- `status`
- `timestamp`
- `expires_at`

AlphaNode V2 fields:

- `dxy_bias`
- `session_name`
- `liquidity_cleared`
- `indicator_snapshot`
- `metadata`

### `market_data`

Each row contains a single live snapshot per symbol.

For XAU the `extra` field now carries:

- `market_health_score`
- `market_health_components`
- `bias_side`
- `trend_state`
- `session_name`
- `execution_mode`
- `dxy_bias`
- `liquidity_cleared`
- `reference_liquidity`

For DXY the `extra` field carries:

- `dxy_bias`
- `ema200`
- `ema_slope`
- `market_health_score`

This allows the frontend to build a Market Health Score panel without recomputing backend logic in the browser.

## Notes

- Frontend reads data with the public anon key only.
- Backend writes with the Supabase service role key.
- If your broker uses a different DXY symbol name, override `DXY_SYMBOL` in `backend/.env`.
- TradingView widget is client-side and loads an external script in the frontend.
