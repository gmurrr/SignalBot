from __future__ import annotations

from collections import deque
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
    xhat[0] = series.iloc[0]
    p[0] = 1.0

    for idx in range(1, n):
        xhat_minus = xhat[idx - 1]
        p_minus = p[idx - 1] + process_var
        kalman_gain = p_minus / (p_minus + measurement_var)
        xhat[idx] = xhat_minus + kalman_gain * (series.iloc[idx] - xhat_minus)
        p[idx] = (1 - kalman_gain) * p_minus

    return pd.Series(xhat, index=series.index)


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = -delta.clip(upper=0).rolling(period).mean()
    rs = gain / loss
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
    cumulative_volume = df["volume"].cumsum()
    cumulative_volume_price = (typical_price * df["volume"]).cumsum()
    return cumulative_volume_price / cumulative_volume


def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    plus_dm = df["high"].diff()
    minus_dm = -df["low"].diff()

    plus_dm = np.where((plus_dm > minus_dm) & (plus_dm > 0), plus_dm, 0)
    minus_dm = np.where((minus_dm > plus_dm) & (minus_dm > 0), minus_dm, 0)

    atr = calculate_atr(df, period)
    plus_di = 100 * (pd.Series(plus_dm).rolling(period).sum() / atr)
    minus_di = 100 * (pd.Series(minus_dm).rolling(period).sum() / atr)
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

    rolling_mean = working_df["residual"].rolling(40).mean()
    rolling_std = working_df["residual"].rolling(40).std()
    working_df["zscore"] = (working_df["residual"] - rolling_mean) / rolling_std

    working_df["rsi"] = calculate_rsi(working_df["close"])
    working_df["atr"] = calculate_atr(working_df)
    working_df["volatility"] = working_df["returns"].rolling(30).std()
    working_df["ema_fast"] = working_df["close"].ewm(span=20).mean()
    working_df["ema_slow"] = working_df["close"].ewm(span=50).mean()
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

    if latest["adx"] > 25:
        if latest["ema_fast"] > latest["ema_slow"]:
            return "trend_up"
        if latest["ema_fast"] < latest["ema_slow"]:
            return "trend_down"

    return "range"


def build_signal_context(df: pd.DataFrame) -> dict[str, float | int | str]:
    featured_df = calculate_features(df)
    latest = featured_df.iloc[-1]
    regime = detect_market_regime(featured_df)

    score_long = 0
    score_short = 0

    if regime == "trend_up":
        score_long += 2
    if regime == "trend_down":
        score_short += 2

    if latest["zscore"] < -1.5:
        score_long += 2
    if latest["zscore"] > 1.5:
        score_short += 2

    if latest["rsi"] < 35:
        score_long += 1
    if latest["rsi"] > 65:
        score_short += 1

    if latest["close"] < latest["vwap"]:
        score_long += 1
    if latest["close"] > latest["vwap"]:
        score_short += 1

    if latest["close"] < latest["bb_lower"]:
        score_long += 1
    if latest["close"] > latest["bb_upper"]:
        score_short += 1

    if latest["momentum"] > 0:
        score_long += 1
    if latest["momentum"] < 0:
        score_short += 1

    signal = 0
    confidence = 0.0
    reason = "wait"

    if score_long >= 5 and score_long > score_short:
        signal = 1
        confidence = score_long / 8
        reason = "long_setup"
    elif score_short >= 5 and score_short > score_long:
        signal = -1
        confidence = score_short / 8
        reason = "short_setup"

    return {
        "signal": signal,
        "confidence": float(confidence),
        "reason": reason,
        "regime": regime,
        "score_long": score_long,
        "score_short": score_short,
        "price": float(latest["close"]),
        "kalman": float(latest["kalman"]),
        "zscore": float(latest["zscore"]),
        "rsi": float(latest["rsi"]),
    }


def generate_signal(df: pd.DataFrame) -> int:
    return int(build_signal_context(df)["signal"])


class RollingSignalEngineMTF:
    """
    Stores candles in RAM and evaluates signals locally.
    Currently evaluates only on M1 features, but keeps the structure ready
    for adding M5/S10 aggregation and multi-timeframe indicator logic.
    """

    def __init__(
        self,
        window_size: int = 250,
        enabled_timeframes: tuple[str, ...] = ("M1", "M5", "S10"),
    ) -> None:
        self._window_size = window_size
        self._enabled_timeframes = enabled_timeframes
        self._candles_by_timeframe: dict[str, deque[dict]] = {
            tf: deque(maxlen=window_size) for tf in enabled_timeframes
        }
        self._last_evaluated_m1_time: str | None = None

    def seed_from_m1(self, m1_df: pd.DataFrame) -> None:
        self._candles_by_timeframe["M1"].clear()
        self._candles_by_timeframe["M5"].clear()
        self._candles_by_timeframe["S10"].clear()

        for _, row in m1_df.iterrows():
            self._candles_by_timeframe["M1"].append(row.to_dict())

        # Derived M5 is optional; keep it computed for future use.
        self._rebuild_m5_from_m1()

    def on_new_m1_candle(self, candle: dict) -> None:
        self._candles_by_timeframe["M1"].append(candle)
        self._rebuild_m5_from_m1()

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
                "price": float("nan"),
                "kalman": float("nan"),
                "zscore": float("nan"),
                "rsi": float("nan"),
            }

        df = pd.DataFrame(m1_candles)
        result = build_signal_context(df)

        return result

    def _rebuild_m5_from_m1(self) -> None:
        """
        Re-derive M5 candles from the current M1 rolling window.
        S10 is intentionally left empty (to be added later with tick aggregation).
        """
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

        ohlc_dict = {
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }
        m5_df = m1_df.resample("5min").agg(ohlc_dict).dropna(subset=["open", "high", "low", "close"])

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
