from __future__ import annotations

import threading
import datetime as dt
from typing import Any

from supabase import Client, create_client

from src.config.settings import Settings
from src.models.tick import Tick


class SupabaseRepository:
    _instance: SupabaseRepository | None = None
    _lock = threading.Lock()

    def __new__(cls, settings: Settings) -> "SupabaseRepository":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialize(settings)
        return cls._instance

    def _initialize(self, settings: Settings) -> None:
        self._client: Client = create_client(settings.supabase_url, settings.supabase_key)
        self._market_data_table = settings.market_data_table
        self._signals_table = settings.signals_table

    def upsert_market_tick(self, tick: Tick) -> None:
        payload: dict[str, Any] = {
            "symbol": tick.symbol,
            "bid": tick.bid,
            "ask": tick.ask,
            "mid": tick.mid,
            "tick_time": tick.timestamp,
            "updated_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
            "source": "mt5",
            "timeframe": "tick",
        }
        self._client.table(self._market_data_table).upsert(
            payload,
            on_conflict="symbol",
        ).execute()

    def insert_signal(self, signal_payload: dict[str, Any]) -> None:
        self._client.table(self._signals_table).insert(signal_payload).execute()
