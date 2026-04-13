from __future__ import annotations

import datetime as dt
import time
import threading
from typing import Any

import httpx
from supabase import Client, create_client

from src.config.settings import Settings
from src.models.signal import SignalPosition
from src.models.tick import Tick


class SupabaseRepository:
    _instance: "SupabaseRepository | None" = None
    _lock = threading.Lock()

    def __new__(cls, settings: Settings) -> "SupabaseRepository":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialize(settings)
        return cls._instance

    def _initialize(self, settings: Settings) -> None:
        self._settings = settings
        self._request_lock = threading.Lock()
        self._client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        self._market_data_table = settings.market_data_table
        self._signals_table = settings.signals_table

    def upsert_market_tick(
        self,
        tick: Tick,
        *,
        extra: dict[str, Any] | None = None,
        source: str = "mt5",
        timeframe: str = "tick",
    ) -> None:
        payload: dict[str, Any] = {
            "symbol": tick.symbol,
            "bid": tick.bid,
            "ask": tick.ask,
            "mid": tick.mid,
            "tick_time": tick.timestamp,
            "updated_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
            "source": source,
            "timeframe": timeframe,
            "extra": extra or {},
        }
        self._execute_with_retry(
            lambda: self._client.table(self._market_data_table).upsert(payload, on_conflict="symbol").execute()
        )

    def insert_signal(self, signal: SignalPosition) -> SignalPosition:
        response = self._execute_with_retry(
            lambda: self._client.table(self._signals_table).insert(signal.to_insert_payload()).execute()
        )
        return SignalPosition.from_record(response.data[0])

    def get_latest_active_signal(self, symbol: str) -> SignalPosition | None:
        response = self._execute_with_retry(
            lambda: (
                self._client.table(self._signals_table)
                .select("*")
                .eq("symbol", symbol)
                .eq("status", "ACTIVE")
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )
        )
        if not response.data:
            return None
        return SignalPosition.from_record(response.data[0])

    def update_signal_status(
        self,
        signal_id: str,
        *,
        status: str,
        exit_price: float,
        result_pips: float,
        close_reason: str,
        closed_at: str,
    ) -> None:
        payload = {
            "status": status,
            "exit_price": exit_price,
            "result_pips": result_pips,
            "close_reason": close_reason,
            "closed_at": closed_at,
            "updated_at": closed_at,
        }
        self._execute_with_retry(
            lambda: self._client.table(self._signals_table).update(payload).eq("id", signal_id).execute()
        )

    def _execute_with_retry(self, operation, retries: int = 3):
        last_error: Exception | None = None

        for attempt in range(retries):
            try:
                with self._request_lock:
                    return operation()
            except (httpx.HTTPError, OSError) as exc:
                last_error = exc
                self._recreate_client()
                if attempt < retries - 1:
                    time.sleep(0.35 * (attempt + 1))

        assert last_error is not None
        raise last_error

    def _recreate_client(self) -> None:
        self._client = create_client(
            self._settings.supabase_url,
            self._settings.supabase_service_role_key,
        )
