from __future__ import annotations

import datetime as dt


class OhlcCandleAggregator:
    """
    Aggregates ticks into OHLC candles based on timestamp buckets.
    Designed so we can later plug in tick->S10 (10-second) aggregation.
    """

    def __init__(self, timeframe_seconds: int) -> None:
        self._timeframe_seconds = timeframe_seconds
        self._current_candle: dict | None = None
        self._current_bucket_start_epoch: int | None = None

    def prime_with_existing_candle(self, candle: dict) -> None:
        """
        Used to start live aggregation from the last historical candle.
        """
        self._current_candle = dict(candle)
        base_epoch = self._iso_to_epoch_seconds(str(candle["time"]))
        self._current_bucket_start_epoch = (base_epoch // self._timeframe_seconds) * self._timeframe_seconds

    def update_from_tick(self, tick_time_iso: str, mid: float) -> dict | None:
        """
        Returns a finalized candle when the time bucket changes; otherwise None.
        """
        bucket_start_epoch = self._iso_to_epoch_seconds(tick_time_iso)
        bucket_start_epoch = (bucket_start_epoch // self._timeframe_seconds) * self._timeframe_seconds

        if self._current_candle is None or self._current_bucket_start_epoch is None:
            return self._start_new_candle(bucket_start_epoch, tick_time_iso, mid)

        if bucket_start_epoch == self._current_bucket_start_epoch:
            # Update in-progress candle.
            self._current_candle["high"] = max(float(self._current_candle["high"]), mid)
            self._current_candle["low"] = min(float(self._current_candle["low"]), mid)
            self._current_candle["close"] = mid
            # Approximate volume as tick count (required for VWAP in the strategy).
            self._current_candle["volume"] = float(self._current_candle.get("volume", 0.0)) + 1.0
            return None

        finalized = self._current_candle
        self._current_candle = self._new_candle_dict(bucket_start_epoch, tick_time_iso, mid)
        self._current_bucket_start_epoch = bucket_start_epoch
        return finalized

    def get_current_candle(self) -> dict | None:
        return self._current_candle

    def _start_new_candle(self, bucket_start_epoch: int, tick_time_iso: str, mid: float) -> dict | None:
        self._current_candle = self._new_candle_dict(bucket_start_epoch, tick_time_iso, mid)
        self._current_bucket_start_epoch = bucket_start_epoch
        return None

    @staticmethod
    def _iso_to_epoch_seconds(iso_str: str) -> int:
        parsed = dt.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return int(parsed.timestamp())

    def _new_candle_dict(self, bucket_start_epoch: int, tick_time_iso: str, mid: float) -> dict:
        # When creating from ticks, MT5 tick-volume isn't available here; approximate volume as tick count.
        return {
            "time": dt.datetime.fromtimestamp(bucket_start_epoch, tz=dt.timezone.utc).isoformat(),
            "open": mid,
            "high": mid,
            "low": mid,
            "close": mid,
            "volume": 1.0,
        }

