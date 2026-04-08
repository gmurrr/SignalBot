# SignalBot Monorepo

Profesjonalna platforma sygnałowa XAU/USD z architekturą:

- `backend/` - Python + MetaTrader5 + `supabase-py`
- `frontend/` - Next.js App Router + Tailwind CSS + Framer Motion + komponenty w stylu shadcn/ui
- `supabase/` - współdzielony schemat SQL dla `market_data` i `signals`

## Struktura

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

## Co zmieniło się w architekturze

- Backend działa jako silnik sygnałów i monitor pozycji.
- Frontend tylko odczytuje dane przez klucz `anon`.
- Supabase jest warstwą synchronizacji i realtime pomiędzy obiema częściami.
- Tabela `signals` przechowuje pełny stan pozycji: `ACTIVE`, `CLOSED`, `EXPIRED`.
- Bot utrzymuje rolling windows w RAM dla `S10`, `M1` i `M5`.

## Backend

### Odpowiedzialność

- pobieranie ticków z MetaTrader5,
- agregacja świec `S10`, `M1`, `M5` w pamięci,
- generowanie nowych sygnałów XAU/USD,
- zapis nowych sygnałów do Supabase ze statusem `ACTIVE`,
- monitorowanie aktywnej pozycji do TP, SL albo wygaśnięcia po `30` minutach,
- aktualizacja statusu rekordu na `CLOSED` lub `EXPIRED`.

### Konfiguracja

1. Skopiuj:
   - `backend/.env.example` -> `backend/.env`
2. Uzupełnij:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - dane MT5

Najważniejsze zmienne:

- `SIGNAL_EXPIRY_MINUTES=30`
- `SIGNAL_TP_ATR_MULTIPLIER=1.8`
- `SIGNAL_SL_ATR_MULTIPLIER=1.1`
- `PIP_SIZE=0.01`

### Instalacja i start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m src.main
```

### Backtest

```bash
cd backend
python -m src.main
```

Ustaw wcześniej `APP_MODE=BACKTEST` w `backend/.env`.

## Frontend

### Odpowiedzialność

- landing page w stylu Dark Premium Classic,
- dashboard z live tickerem i historią sygnałów,
- realtime subskrypcje Supabase dla `signals` i `market_data`,
- animacje wejścia, glow aktywnego sygnału i przejścia do historii,
- gotowe ekrany auth z miejscem pod EasyCart,
- osadzony widget TradingView dla XAU/USD.

### Konfiguracja

1. Skopiuj:
   - `frontend/.env.example` -> `frontend/.env.local`
2. Uzupełnij:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Instalacja i start

```bash
cd frontend
npm install
npm run dev
```

Domyślnie dashboard będzie dostępny pod:

- `http://localhost:3000/dashboard`

## Supabase

Plik schematu:

- `supabase/schema.sql`

Skrypt tworzy:

- `market_data` z upsertem po `symbol`,
- `signals` z polami pozycji i statusami `ACTIVE/CLOSED/EXPIRED`,
- indeksy pod szybkie odczyty,
- polityki RLS tylko do odczytu dla frontendu,
- wpisy do `supabase_realtime` dla obu tabel.

### Jak wdrożyć schemat

1. Otwórz Supabase SQL Editor.
2. Wklej zawartość `supabase/schema.sql`.
3. Uruchom skrypt.

## Realtime flow

1. Backend zapisuje tick do `market_data` maksymalnie raz na sekundę.
2. Backend zapisuje nowy rekord w `signals` jako `ACTIVE`.
3. Frontend subskrybuje zmiany w `signals` i `market_data`.
4. Gdy TP, SL lub timeout zamkną pozycję, backend robi `UPDATE`.
5. Frontend natychmiast zmienia kartę sygnału i przenosi ją do historii.

## Design system

- Tło: `#050505`
- Akcent: mosiężne złoto `#D4AF37`
- Nagłówki: font szeryfowy
- Dane: `Inter`
- Ruch: Framer Motion, reveal-on-scroll, glow aktywnych sygnałów

## Uwagi

- Frontend korzysta z klucza `anon`, więc nie ma uprawnień do zapisu.
- Backend powinien korzystać z `service_role`, ponieważ wykonuje `insert` i `update`.
- Widget TradingView ładuje skrypt zewnętrzny po stronie przeglądarki.
- Jeżeli w bazie istnieje stary schemat `signals`, przed wdrożeniem nowego SQL warto wykonać migrację albo odświeżenie tabel.
