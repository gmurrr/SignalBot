from __future__ import annotations

from typing import Iterable

import pandas as pd

from src.strategy.indicators import find_swings, prepare_ohlcv, safe_float
from src.strategy.types import LiquidityLevel, SweepState


def identify_reference_liquidity(h1_df: pd.DataFrame, direction: str) -> LiquidityLevel | None:
    working_df = prepare_ohlcv(h1_df)
    if working_df.empty:
        return None

    last_24_hours = working_df.tail(24)
    swings = find_swings(last_24_hours)
    if swings.empty:
        return None

    if direction == "LONG":
        eligible = swings[swings["type"] == "low"]
        label = "H1_SWING_LOW"
    else:
        eligible = swings[swings["type"] == "high"]
        label = "H1_SWING_HIGH"

    if eligible.empty:
        return None

    latest = eligible.iloc[-1]
    return LiquidityLevel(
        direction=direction,
        price=safe_float(latest["price"]),
        swing_time=latest["time"].isoformat(),
        label=label,
    )


def find_tp2_target(h1_df: pd.DataFrame, direction: str, entry_price: float) -> float | None:
    working_df = prepare_ohlcv(h1_df)
    if working_df.empty:
        return None

    swings = find_swings(working_df.tail(48))
    if swings.empty:
        return None

    if direction == "LONG":
        candidates = sorted(_prices_above(swings[swings["type"] == "high"]["price"], entry_price))
        return candidates[0] if candidates else None

    candidates = sorted(_prices_below(swings[swings["type"] == "low"]["price"], entry_price), reverse=True)
    return candidates[0] if candidates else None


def advance_sweep_state(
    direction: str,
    reference_level: LiquidityLevel | None,
    latest_m5_candle: pd.Series,
    current_state: SweepState | None,
) -> SweepState | None:
    if reference_level is None:
        return None

    candle_time = latest_m5_candle["time"].isoformat()
    candle_low = safe_float(latest_m5_candle["low"])
    candle_high = safe_float(latest_m5_candle["high"])
    candle_close = safe_float(latest_m5_candle["close"])

    if direction == "LONG":
        if current_state is None and candle_low < reference_level.price:
            return SweepState(
                direction=direction,
                reference_level=reference_level.price,
                swing_time=reference_level.swing_time,
                sweep_time=candle_time,
                sweep_extreme=candle_low,
                stop_anchor=candle_low,
            )

        if current_state is None:
            return None

        waited = current_state.candles_waited + 1
        if candle_close > current_state.reference_level and waited <= 3:
            return SweepState(
                direction=direction,
                reference_level=current_state.reference_level,
                swing_time=current_state.swing_time,
                sweep_time=current_state.sweep_time,
                sweep_extreme=current_state.sweep_extreme,
                stop_anchor=current_state.stop_anchor,
                reclaim_time=candle_time,
                candles_waited=waited,
                liquidity_cleared=True,
            )

        if waited >= 3:
            return None

        return SweepState(
            direction=direction,
            reference_level=current_state.reference_level,
            swing_time=current_state.swing_time,
            sweep_time=current_state.sweep_time,
            sweep_extreme=min(current_state.sweep_extreme, candle_low),
            stop_anchor=min(current_state.stop_anchor, candle_low),
            reclaim_time=current_state.reclaim_time,
            candles_waited=waited,
            liquidity_cleared=False,
        )

    if current_state is None and candle_high > reference_level.price:
        return SweepState(
            direction=direction,
            reference_level=reference_level.price,
            swing_time=reference_level.swing_time,
            sweep_time=candle_time,
            sweep_extreme=candle_high,
            stop_anchor=candle_high,
        )

    if current_state is None:
        return None

    waited = current_state.candles_waited + 1
    if candle_close < current_state.reference_level and waited <= 3:
        return SweepState(
            direction=direction,
            reference_level=current_state.reference_level,
            swing_time=current_state.swing_time,
            sweep_time=current_state.sweep_time,
            sweep_extreme=current_state.sweep_extreme,
            stop_anchor=current_state.stop_anchor,
            reclaim_time=candle_time,
            candles_waited=waited,
            liquidity_cleared=True,
        )

    if waited >= 3:
        return None

    return SweepState(
        direction=direction,
        reference_level=current_state.reference_level,
        swing_time=current_state.swing_time,
        sweep_time=current_state.sweep_time,
        sweep_extreme=max(current_state.sweep_extreme, candle_high),
        stop_anchor=max(current_state.stop_anchor, candle_high),
        reclaim_time=current_state.reclaim_time,
        candles_waited=waited,
        liquidity_cleared=False,
    )


def _prices_above(values: Iterable[float], entry_price: float) -> list[float]:
    return [safe_float(value) for value in values if safe_float(value) > entry_price]


def _prices_below(values: Iterable[float], entry_price: float) -> list[float]:
    return [safe_float(value) for value in values if safe_float(value) < entry_price]
