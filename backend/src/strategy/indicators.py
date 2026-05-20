from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if np.isnan(number) or np.isinf(number):
        return default
    return number


def normalize_time_column(series: pd.Series) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, utc=True, errors="coerce")

    return pd.to_datetime(
        series.astype("string"),
        utc=True,
        errors="coerce",
        format="ISO8601",
    )


def prepare_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    working_df = df.copy()
    for column_name in ["open", "high", "low", "close", "volume"]:
        if column_name in working_df.columns:
            working_df[column_name] = pd.to_numeric(working_df[column_name], errors="coerce").astype(float)
    if "time" in working_df.columns:
        working_df["time"] = normalize_time_column(working_df["time"])
        working_df = working_df.dropna(subset=["time"]).sort_values("time").reset_index(drop=True)
    return working_df


def append_live_price(df: pd.DataFrame, live_price: float) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    working_df = prepare_ohlcv(df)
    latest = working_df.iloc[-1].copy()
    latest["close"] = float(live_price)
    latest["high"] = max(safe_float(latest["high"]), float(live_price))
    latest["low"] = min(safe_float(latest["low"]), float(live_price))
    return pd.concat([working_df.iloc[:-1], pd.DataFrame([latest])], ignore_index=True)


def ema(series: pd.Series, period: int) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.ewm(span=period, adjust=False).mean()


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    working_df = prepare_ohlcv(df)
    if working_df.empty:
        return pd.Series(dtype=float)

    high = pd.to_numeric(working_df["high"], errors="coerce")
    low = pd.to_numeric(working_df["low"], errors="coerce")
    close = pd.to_numeric(working_df["close"], errors="coerce")
    previous_close = close.shift(1)

    true_range = pd.concat(
        [
            high - low,
            (high - previous_close).abs(),
            (low - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    return true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    delta = numeric.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def ichimoku_cloud(df: pd.DataFrame) -> pd.DataFrame:
    working_df = prepare_ohlcv(df)
    high = working_df["high"]
    low = working_df["low"]

    conversion = (high.rolling(9).max() + low.rolling(9).min()) / 2
    base = (high.rolling(26).max() + low.rolling(26).min()) / 2
    span_a = (conversion + base) / 2
    span_b = (high.rolling(52).max() + low.rolling(52).min()) / 2

    cloud_df = working_df.copy()
    cloud_df["tenkan"] = conversion
    cloud_df["kijun"] = base
    cloud_df["senkou_a"] = span_a
    cloud_df["senkou_b"] = span_b
    return cloud_df


def find_swings(df: pd.DataFrame) -> pd.DataFrame:
    working_df = prepare_ohlcv(df)
    if len(working_df) < 3:
        return pd.DataFrame(columns=["time", "type", "price"])

    swings: list[dict[str, Any]] = []
    for index in range(1, len(working_df) - 1):
        previous_row = working_df.iloc[index - 1]
        current_row = working_df.iloc[index]
        next_row = working_df.iloc[index + 1]

        if current_row["high"] > previous_row["high"] and current_row["high"] > next_row["high"]:
            swings.append(
                {
                    "time": current_row["time"],
                    "type": "high",
                    "price": float(current_row["high"]),
                }
            )

        if current_row["low"] < previous_row["low"] and current_row["low"] < next_row["low"]:
            swings.append(
                {
                    "time": current_row["time"],
                    "type": "low",
                    "price": float(current_row["low"]),
                }
            )

    return pd.DataFrame(swings)


def detect_bullish_fvg(df: pd.DataFrame) -> bool:
    working_df = prepare_ohlcv(df)
    if len(working_df) < 3:
        return False

    first, middle, last = working_df.iloc[-3], working_df.iloc[-2], working_df.iloc[-1]
    return bool(first["high"] < last["low"] and middle["close"] > middle["open"])


def detect_bearish_fvg(df: pd.DataFrame) -> bool:
    working_df = prepare_ohlcv(df)
    if len(working_df) < 3:
        return False

    first, middle, last = working_df.iloc[-3], working_df.iloc[-2], working_df.iloc[-1]
    return bool(first["low"] > last["high"] and middle["close"] < middle["open"])


def detect_bullish_engulfing(df: pd.DataFrame) -> bool:
    working_df = prepare_ohlcv(df)
    if len(working_df) < 2:
        return False

    previous_row = working_df.iloc[-2]
    current_row = working_df.iloc[-1]
    return bool(
        previous_row["close"] < previous_row["open"]
        and current_row["close"] > current_row["open"]
        and current_row["close"] >= previous_row["open"]
        and current_row["open"] <= previous_row["close"]
    )


def detect_bearish_engulfing(df: pd.DataFrame) -> bool:
    working_df = prepare_ohlcv(df)
    if len(working_df) < 2:
        return False

    previous_row = working_df.iloc[-2]
    current_row = working_df.iloc[-1]
    return bool(
        previous_row["close"] > previous_row["open"]
        and current_row["close"] < current_row["open"]
        and current_row["open"] >= previous_row["close"]
        and current_row["close"] <= previous_row["open"]
    )
