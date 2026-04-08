from __future__ import annotations

import datetime as dt
import threading
from typing import Any

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
        self._client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
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
        self._client.table(self._market_data_table).upsert(payload, on_conflict="symbol").execute()

    def insert_signal(self, signal: SignalPosition) -> SignalPosition:
        response = self._client.table(self._signals_table).insert(signal.to_insert_payload()).execute()
        return SignalPosition.from_record(response.data[0])

    def get_latest_active_signal(self, symbol: str) -> SignalPosition | None:
        response = (
            self._client.table(self._signals_table)
            .select("*")
            .eq("symbol", symbol)
            .eq("status", "ACTIVE")
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
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
        self._client.table(self._signals_table).update(payload).eq("id", signal_id).execute()
