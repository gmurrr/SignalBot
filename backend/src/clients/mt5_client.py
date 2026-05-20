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
        return self.get_recent_candles(symbol, "M1", count)

    def get_recent_candles(self, symbol: str, timeframe: str, count: int) -> pd.DataFrame:
        self._ensure_symbol(symbol)
        rates = mt5.copy_rates_from_pos(symbol, self._timeframe_constant(timeframe), 0, count)
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"MT5 copy_rates_from_pos returned no data for {symbol} ({timeframe})")

        return self._rates_to_dataframe(rates)

    def get_candles_in_range(
        self,
        symbol: str,
        timeframe: str,
        start_time: dt.datetime,
        end_time: dt.datetime,
    ) -> pd.DataFrame:
        self._ensure_symbol(symbol)
        start_utc = self._ensure_utc(start_time)
        end_utc = self._ensure_utc(end_time)
        if end_utc <= start_utc:
            raise ValueError("end_time must be greater than start_time")

        rates = mt5.copy_rates_range(symbol, self._timeframe_constant(timeframe), start_utc, end_utc)
        if rates is None or len(rates) == 0:
            raise RuntimeError(
                f"MT5 copy_rates_range returned no data for {symbol} ({timeframe}) between {start_utc.isoformat()} and {end_utc.isoformat()}"
            )

        df = self._rates_to_dataframe(rates)
        timestamps = pd.to_datetime(df["time"], utc=True, errors="coerce", format="ISO8601")
        filtered = df[(timestamps >= start_utc) & (timestamps < end_utc)].copy()
        if filtered.empty:
            raise RuntimeError(
                f"MT5 returned candles for {symbol} ({timeframe}), but none remained after range filtering between {start_utc.isoformat()} and {end_utc.isoformat()}"
            )
        return filtered

    def get_latest_tick(self, symbol: str) -> Tick:
        self._ensure_symbol(symbol)
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
    def _timeframe_constant(timeframe: str) -> int:
        mapping = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "H1": mt5.TIMEFRAME_H1,
        }
        if timeframe not in mapping:
            raise ValueError(f"Unsupported timeframe: {timeframe}")
        return mapping[timeframe]

    @staticmethod
    def _ensure_symbol(symbol: str) -> None:
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            raise RuntimeError(f"MT5 symbol_info returned None for {symbol}")
        if not symbol_info.visible and not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"MT5 could not select symbol {symbol}")

    @staticmethod
    def _rates_to_dataframe(rates) -> pd.DataFrame:
        df = pd.DataFrame(rates)
        df["time"] = df["time"].apply(MT5Client._epoch_to_iso)
        df["volume"] = df["tick_volume"].astype(float)
        return df[["time", "open", "high", "low", "close", "volume"]].copy()

    @staticmethod
    def _ensure_utc(value: dt.datetime) -> dt.datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)

    @staticmethod
    def _epoch_to_iso(epoch_value: int | float) -> str:
        epoch_float = float(epoch_value)
        # Defensive: some brokers provide ms instead of seconds.
        if epoch_float > 1e12:
            epoch_float /= 1000.0

        return dt.datetime.fromtimestamp(epoch_float, tz=dt.timezone.utc).isoformat()

