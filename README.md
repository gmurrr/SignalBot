# SignalBot Backend (Python)

Backend bota sygnałowego, który:
- łączy się z lokalnym terminalem MetaTrader5,
- pobiera dane M1 oraz stale aktualizuje świecę M1 na podstawie ticków w RAM,
- zapisuje cenę do Supabase (`market_data`) z throttlingiem (max 1 upsert/s),
- wylicza sygnały lokalnie (RAM) i zapisuje je do Supabase (`signals`) jako nowe rekordy,
- działa stabilnie na VPS dzięki logowaniu do `logs/bot.log`.

## Struktura projektu

```text
SignalBot/
  src/
    clients/
      supabase_client.py
      mt5_client.py
    config/
      settings.py
    data/
      aggregators/
        candle_aggregator.py
    models/
      tick.py
    services/
      bot_runner.py
    strategy/
      signal_engine.py
    utils/
      logger.py
    main.py
  .env.example
  requirements.txt
  README.md
```

## Wymagania

- Python 3.10+
- Działający terminal MetaTrader5 na tym samym systemie
- Projekt Supabase z tabelami:
  - `market_data`
  - `signals`

## Konfiguracja `.env`

1. Skopiuj:
   - `.env.example` -> `.env`
2. Uzupełnij wartości:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `APP_MODE` (`PROD` lub `BACKTEST`)
   - `MT5_SYMBOL` (domyślnie `XAUUSD`)
   - opcjonalnie: `MT5_LOGIN`, `MT5_PASSWORD`, `MT5_SERVER` (jeśli broker wymaga loginu)
   - `MT5_TICK_POLL_INTERVAL_SEC`
   - `MARKET_DATA_THROTTLE_SEC`
   - `BACKTEST_CSV_PATH`

## Schemat bazy (Supabase)

Plik schematu:
- `supabase/schema.sql`

Jak uruchomić:
1. Otwórz Supabase SQL Editor.
2. Wklej zawartość `supabase/schema.sql`.
3. Uruchom skrypt.

Skrypt tworzy:
- `market_data` (z `upsert` po `symbol`, bez tworzenia wiersza dla każdego ticka),
- `signals` (sygnały + snapshot wskaźników i metadata),
- indeksy pod szybkie odczyty.

Jeśli korzystasz z istniejącej bazy utworzonej pod poprzedni schemat (np. unikalność po `(symbol, tick_time)`), musisz wykonać migrację/odświeżenie tabel, aby `on_conflict="symbol"` działał poprawnie.

## Instalacja

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Uruchomienie

```bash
python -m src.main
```

## Co robi bot w runtime

1. `APP_MODE=PROD`: startuje MT5 i pobiera ostatnie `200` świec M1 dla `MT5_SYMBOL`.
2. Inicjalizuje engine sygnałów w RAM i zaczyna pętlę pollingową ticków (`mt5.symbol_info_tick`).
3. `market_data`: aktualizuje Supabase maksymalnie raz na sekundę (throttling) przez `.upsert()` na kluczu `symbol`.
4. `signals`: przy zamknięciu kolejnej świecy M1 oblicza sygnał lokalnie w Pythonie i zapisuje nowy rekord przez `.insert()`.
5. Logi trafiają do:
   - konsoli,
   - `logs/bot.log` (rotacja pliku).

1. `APP_MODE=BACKTEST`: MT5 jest tylko źródłem historii M1, ale nie ma żadnych zapisów do Supabase.
2. Sygnały + prosty wynik (P/L na następnym candle) są zapisywane do CSV (`BACKTEST_CSV_PATH`) i podsumowane w logach.

## Rozszerzanie projektu

- Nowe wskaźniki/interwały:
  - rozbuduj `src/strategy/signal_engine.py`.
- Zmiany struktury danych:
  - dodawaj kolumny przez nowe migracje SQL (np. `supabase/migrations/*.sql`),
  - dla szybkich iteracji używaj pól `extra`, `indicator_snapshot`, `metadata` (`jsonb`),
  - wersjonuj strategię przez `strategy_version`.
- Inne instrumenty:
  - ustaw `MT5_SYMBOL` w `.env`.
- Frontend:
  - możesz dodać osobny katalog np. `frontend/` i korzystać z tych samych tabel Supabase.

## Uwagi produkcyjne (VPS)

- Użyj menedżera procesów (np. `systemd`, `supervisor`, `pm2`) do auto restartu.
- Regularnie sprawdzaj `logs/signalbot.log`.
- Regularnie sprawdzaj `logs/bot.log`.
- W Supabase ustaw klucz unikalny dla `market_data`:
  - rekomendacja: unikalny `symbol` (żeby `upsert(on_conflict="symbol")` działał).
