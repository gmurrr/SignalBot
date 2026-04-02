from __future__ import annotations

import datetime as dt
import threading

import MetaTrader5 as mt5
import pandas as pd

from src.config.settings import Settings
from src.models.tick import Tick


class MT5Client:
    _instance: MT5Client | None = None
    _lock = threading.Lock()

    def __new__(cls, settings: Settings, *args, **kwargs) -> "MT5Client":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
                    cls._instance._settings = settings
        return cls._instance

    def initialize(self) -> None:
        if self._initialized:
            return

        login = self._settings.mt5_login
        password = self._settings.mt5_password
        server = self._settings.mt5_server

        if login and password and server:
            ok = mt5.initialize(login=int(login), password=password, server=server)
        else:
            ok = mt5.initialize()

        if not ok:
            raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")

        info = mt5.terminal_info()
        if info is None:
            raise RuntimeError("MT5 terminal_info() returned None")

        self._initialized = True

    def shutdown(self) -> None:
        if self._initialized:
            mt5.shutdown()
            self._initialized = False

    def get_recent_m1_candles(self, symbol: str, count: int) -> pd.DataFrame:
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, count)
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"MT5 copy_rates_from_pos returned no data for {symbol}")

        df = pd.DataFrame(rates)
        # MT5 provides: time, open, high, low, close, tick_volume, spread, real_volume
        df["time"] = df["time"].apply(self._epoch_to_iso)
        df["volume"] = df["tick_volume"].astype(float)

        return df[["time", "open", "high", "low", "close", "volume"]].copy()

    def get_latest_tick(self, symbol: str) -> Tick:
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise RuntimeError(f"MT5 symbol_info_tick returned None for {symbol}")
        if tick.bid is None or tick.ask is None:
            raise RuntimeError(f"MT5 tick missing bid/ask for {symbol}")

        bid = float(tick.bid)
        ask = float(tick.ask)
        mid = (bid + ask) / 2

        return Tick(
            symbol=symbol,
            bid=bid,
            ask=ask,
            mid=mid,
            timestamp=self._epoch_to_iso(tick.time),
        )

    @staticmethod
    def _epoch_to_iso(epoch_value: int | float) -> str:
        epoch_float = float(epoch_value)
        # Defensive: some brokers provide ms instead of seconds.
        if epoch_float > 1e12:
            epoch_float /= 1000.0

        return dt.datetime.fromtimestamp(epoch_float, tz=dt.timezone.utc).isoformat()

