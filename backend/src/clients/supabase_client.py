from __future__ import annotations

import datetime as dt
import time
import threading
from typing import Any

import httpx
from postgrest.exceptions import APIError
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
    ) -> bool:
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
        return bool(
            self._execute_with_retry(
                lambda: self._client.table(self._market_data_table).upsert(payload, on_conflict="symbol").execute() or True,
                retries=3,
                suppress_transient=True,
            )
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

    def _execute_with_retry(self, operation, retries: int = 3, suppress_transient: bool = False):
        last_error: Exception | None = None

        for attempt in range(retries):
            try:
                with self._request_lock:
                    return operation()
            except APIError as exc:
                if not self._is_transient_api_error(exc):
                    raise

                last_error = exc
                self._recreate_client()
                if attempt < retries - 1:
                    self._sleep_before_retry(attempt)
            except (httpx.HTTPError, OSError) as exc:
                last_error = exc
                self._recreate_client()
                if attempt < retries - 1:
                    self._sleep_before_retry(attempt)

        assert last_error is not None
        if suppress_transient and self._is_transient_error(last_error):
            return None
        raise last_error

    @staticmethod
    def _sleep_before_retry(attempt: int) -> None:
        time.sleep(min(0.5 * (2**attempt), 5.0))

    @staticmethod
    def _is_transient_error(exc: Exception) -> bool:
        return isinstance(exc, (httpx.HTTPError, OSError)) or (
            isinstance(exc, APIError) and SupabaseRepository._is_transient_api_error(exc)
        )

    @staticmethod
    def _is_transient_api_error(exc: APIError) -> bool:
        code = str(exc.code or "")
        details = str(exc.details or "")
        message = str(exc.message or "")
        haystack = f"{message} {details}".lower()

        return (
            code in {"502", "503", "504", "520", "521", "522", "523", "524"}
            or "bad gateway" in haystack
            or "cloudflare" in haystack
            or "<!doctype html" in haystack
            or ("json could not be generated" in haystack and any(status in haystack for status in ("502", "503", "504")))
        )

    def _recreate_client(self) -> None:
        self._client = create_client(
            self._settings.supabase_url,
            self._settings.supabase_service_role_key,
        )
