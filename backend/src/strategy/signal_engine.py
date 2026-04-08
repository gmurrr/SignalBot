from __future__ import annotations

from collections import deque
from typing import Any

import numpy as np
import pandas as pd


def kalman_filter(
    series: pd.Series,
    process_var: float = 1e-5,
    measurement_var: float = 0.05,
) -> pd.Series:
    series = pd.to_numeric(series, errors="coerce").dropna()
    if series.empty:
        return pd.Series(dtype=float)

    n = len(series)
    xhat = np.zeros(n)
    p = np.zeros(n)
    xhat[0] = float(series.iloc[0])
    p[0] = 1.0

    for idx in range(1, n):
        xhat_minus = xhat[idx - 1]
        p_minus = p[idx - 1] + process_var
        kalman_gain = p_minus / (p_minus + measurement_var)
        xhat[idx] = xhat_minus + kalman_gain * (float(series.iloc[idx]) - xhat_minus)
        p[idx] = (1 - kalman_gain) * p_minus

    return pd.Series(xhat, index=series.index)


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = -delta.clip(upper=0).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(period).mean()


def calculate_bollinger(series: pd.Series, period: int = 20) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = series.rolling(period).mean()
    deviation = series.rolling(period).std()
    upper = middle + (2 * deviation)
    lower = middle - (2 * deviation)
    return middle, upper, lower


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    cumulative_volume = df["volume"].cumsum().replace(0, np.nan)
    cumulative_volume_price = (typical_price * df["volume"]).cumsum()
    return cumulative_volume_price / cumulative_volume


def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    plus_dm = df["high"].diff()
    minus_dm = -df["low"].diff()

    plus_dm = np.where((plus_dm > minus_dm) & (plus_dm > 0), plus_dm, 0)
    minus_dm = np.where((minus_dm > plus_dm) & (minus_dm > 0), minus_dm, 0)

    atr = calculate_atr(df, period).replace(0, np.nan)
    plus_di = 100 * (pd.Series(plus_dm, index=df.index).rolling(period).sum() / atr)
    minus_di = 100 * (pd.Series(minus_dm, index=df.index).rolling(period).sum() / atr)
    dx = (abs(plus_di - minus_di) / (plus_di + minus_di)) * 100

    return dx.rolling(period).mean()


def calculate_features(df: pd.DataFrame) -> pd.DataFrame:
    working_df = df.copy()

    for column_name in ["open", "high", "low", "close", "volume"]:
        if column_name in working_df.columns:
            working_df[column_name] = pd.to_numeric(working_df[column_name], errors="coerce").astype(float)

    working_df["returns"] = working_df["close"].pct_change()
    working_df["kalman"] = kalman_filter(working_df["close"])
    working_df["kalman_slope"] = working_df["kalman"].diff()
    working_df["residual"] = working_df["close"] - working_df["kalman"]

    residual_mean = working_df["residual"].rolling(40).mean()
    residual_std = working_df["residual"].rolling(40).std().replace(0, np.nan)
    working_df["zscore"] = (working_df["residual"] - residual_mean) / residual_std

    working_df["rsi"] = calculate_rsi(working_df["close"])
    working_df["atr"] = calculate_atr(working_df)
    working_df["volatility"] = working_df["returns"].rolling(30).std()
    working_df["ema_fast"] = working_df["close"].ewm(span=20, adjust=False).mean()
    working_df["ema_slow"] = working_df["close"].ewm(span=50, adjust=False).mean()
    working_df["vwap"] = calculate_vwap(working_df)
    working_df["adx"] = calculate_adx(working_df)

    bb_middle, bb_upper, bb_lower = calculate_bollinger(working_df["close"])
    working_df["bb_mid"] = bb_middle
    working_df["bb_upper"] = bb_upper
    working_df["bb_lower"] = bb_lower
    working_df["momentum"] = working_df["close"] - working_df["close"].shift(5)

    return working_df


def detect_market_regime(df: pd.DataFrame) -> str:
    latest = df.iloc[-1]
    adx = safe_float(latest.get("adx"))
    ema_fast = safe_float(latest.get("ema_fast"))
    ema_slow = safe_float(latest.get("ema_slow"))

    if adx > 25:
        if ema_fast > ema_slow:
            return "trend_up"
        if ema_fast < ema_slow:
            return "trend_down"

    return "range"


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if np.isnan(number) or np.isinf(number):
        return default
    return number


def micro_signal_bias(s10_df: pd.DataFrame) -> tuple[int, int]:
    if s10_df.empty or len(s10_df) < 6:
        return 0, 0

    closes = pd.to_numeric(s10_df["close"], errors="coerce").dropna()
    if len(closes) < 6:
        return 0, 0

    recent = closes.tail(6)
    current = float(recent.iloc[-1])
    average = float(recent.mean())
    momentum = float(recent.iloc[-1] - recent.iloc[0])

    score_long = 0
    score_short = 0

    if momentum > 0:
        score_long += 1
    if momentum < 0:
        score_short += 1

    if current > average:
        score_long += 1
    if current < average:
        score_short += 1

    return score_long, score_short


def build_signal_context(
    m1_df: pd.DataFrame,
    m5_df: pd.DataFrame,
    s10_df: pd.DataFrame,
) -> dict[str, float | int | str]:
    featured_m1 = calculate_features(m1_df)
    latest_m1 = featured_m1.iloc[-1]

    featured_m5 = calculate_features(m5_df) if len(m5_df) >= 20 else featured_m1.copy()
    latest_m5 = featured_m5.iloc[-1]
    regime = detect_market_regime(featured_m5)

    score_long = 0
    score_short = 0

    if regime == "trend_up":
        score_long += 2
    if regime == "trend_down":
        score_short += 2

    if safe_float(latest_m1["zscore"]) < -1.35:
        score_long += 2
    if safe_float(latest_m1["zscore"]) > 1.35:
        score_short += 2

    if safe_float(latest_m1["rsi"]) < 38:
        score_long += 1
    if safe_float(latest_m1["rsi"]) > 62:
        score_short += 1

    if safe_float(latest_m1["close"]) < safe_float(latest_m1["vwap"]):
        score_long += 1
    if safe_float(latest_m1["close"]) > safe_float(latest_m1["vwap"]):
        score_short += 1

    if safe_float(latest_m1["close"]) < safe_float(latest_m1["bb_lower"]):
        score_long += 1
    if safe_float(latest_m1["close"]) > safe_float(latest_m1["bb_upper"]):
        score_short += 1

    if safe_float(latest_m1["momentum"]) > 0:
        score_long += 1
    if safe_float(latest_m1["momentum"]) < 0:
        score_short += 1

    if safe_float(latest_m5["ema_fast"]) > safe_float(latest_m5["ema_slow"]):
        score_long += 1
    if safe_float(latest_m5["ema_fast"]) < safe_float(latest_m5["ema_slow"]):
        score_short += 1

    micro_long, micro_short = micro_signal_bias(s10_df)
    score_long += micro_long
    score_short += micro_short

    signal = 0
    confidence = 0.0
    reason = "wait"

    if score_long >= 6 and score_long > score_short + 1:
        signal = 1
        confidence = min(score_long / 10, 0.99)
        reason = "smart_long_alignment"
    elif score_short >= 6 and score_short > score_long + 1:
        signal = -1
        confidence = min(score_short / 10, 0.99)
        reason = "smart_short_alignment"

    return {
        "signal": signal,
        "confidence": float(confidence),
        "reason": reason,
        "regime": regime,
        "score_long": score_long,
        "score_short": score_short,
        "price": safe_float(latest_m1["close"]),
        "kalman": safe_float(latest_m1["kalman"]),
        "zscore": safe_float(latest_m1["zscore"]),
        "rsi": safe_float(latest_m1["rsi"]),
        "atr": max(safe_float(latest_m1["atr"]), 0.01),
        "adx": safe_float(latest_m5.get("adx")),
        "m5_ema_fast": safe_float(latest_m5.get("ema_fast")),
        "m5_ema_slow": safe_float(latest_m5.get("ema_slow")),
    }


class RollingSignalEngineMTF:
    """
    Maintains rolling windows in RAM for M1, M5, and S10.
    M5 is derived from M1 history, while S10 is built from live ticks.
    """

    def __init__(self, window_size: int = 360) -> None:
        self._candles_by_timeframe: dict[str, deque[dict[str, Any]]] = {
            "M1": deque(maxlen=window_size),
            "M5": deque(maxlen=max(window_size // 5, 72)),
            "S10": deque(maxlen=max(window_size * 6, 180)),
        }

    def seed_from_m1(self, m1_df: pd.DataFrame) -> None:
        for frame in self._candles_by_timeframe.values():
            frame.clear()

        for _, row in m1_df.iterrows():
            self._candles_by_timeframe["M1"].append(row.to_dict())

        self._rebuild_m5_from_m1()

    def on_new_m1_candle(self, candle: dict[str, Any]) -> None:
        self._candles_by_timeframe["M1"].append(candle)
        self._rebuild_m5_from_m1()

    def on_new_s10_candle(self, candle: dict[str, Any]) -> None:
        self._candles_by_timeframe["S10"].append(candle)

    def evaluate(self) -> dict[str, float | int | str]:
        m1_candles = list(self._candles_by_timeframe["M1"])
        if len(m1_candles) < 60:
            return {
                "signal": 0,
                "confidence": 0.0,
                "reason": "not_enough_data",
                "regime": "range",
                "score_long": 0,
                "score_short": 0,
                "price": 0.0,
                "kalman": 0.0,
                "zscore": 0.0,
                "rsi": 0.0,
                "atr": 0.0,
                "adx": 0.0,
                "m5_ema_fast": 0.0,
                "m5_ema_slow": 0.0,
            }

        return build_signal_context(
            pd.DataFrame(m1_candles),
            pd.DataFrame(list(self._candles_by_timeframe["M5"])),
            pd.DataFrame(list(self._candles_by_timeframe["S10"])),
        )

    def _rebuild_m5_from_m1(self) -> None:
        m1_candles = list(self._candles_by_timeframe["M1"])
        if not m1_candles:
            return

        m1_df = pd.DataFrame(m1_candles)
        if "time" not in m1_df.columns:
            return

        m1_df["time"] = pd.to_datetime(m1_df["time"], utc=True, errors="coerce")
        m1_df = m1_df.dropna(subset=["time"]).sort_values("time")
        if m1_df.empty:
            return

        m1_df = m1_df.set_index("time")
        m5_df = (
            m1_df.resample("5min")
            .agg(
                {
                    "open": "first",
                    "high": "max",
                    "low": "min",
                    "close": "last",
                    "volume": "sum",
                }
            )
            .dropna(subset=["open", "high", "low", "close"])
        )

        m5_deque = self._candles_by_timeframe["M5"]
        m5_deque.clear()
        for tstamp, row in m5_df.iterrows():
            m5_deque.append(
                {
                    "time": tstamp.isoformat(),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                }
            )
