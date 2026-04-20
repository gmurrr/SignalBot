from __future__ import annotations

import pandas as pd

from src.strategy.indicators import (
    detect_bearish_engulfing,
    detect_bearish_fvg,
    detect_bullish_engulfing,
    detect_bullish_fvg,
    prepare_ohlcv,
    rsi,
    safe_float,
)
from src.strategy.types import ExecutionSetup, SweepState


def build_execution_setup(
    direction: str,
    m5_df: pd.DataFrame,
    sweep_state: SweepState,
    tp2_target: float | None,
    pip_size: float,
    price_decimals: int,
    relaxed: bool = False,
) -> ExecutionSetup | None:
    working_df = prepare_ohlcv(m5_df)
    if len(working_df) < 4:
        return None

    working_df["rsi"] = rsi(working_df["close"], 14)
    latest = working_df.iloc[-1]
    previous = working_df.iloc[-2]
    entry_price = round(safe_float(latest["close"]), price_decimals)
    current_rsi = safe_float(latest["rsi"])
    previous_rsi = safe_float(previous["rsi"])

    if direction == "LONG":
        has_pattern = detect_bullish_fvg(working_df) or detect_bullish_engulfing(working_df)
        strict_rsi_reversal = previous_rsi < 30 and current_rsi > previous_rsi and current_rsi >= 30
        relaxed_rsi_reversal = previous_rsi < 45 and current_rsi > previous_rsi
        rsi_reversal = relaxed_rsi_reversal if relaxed else strict_rsi_reversal
        momentum_reclaim = safe_float(latest["close"]) > safe_float(latest["open"]) and safe_float(latest["close"]) > safe_float(previous["high"])
        stop_loss = round(sweep_state.stop_anchor - pip_size, price_decimals)
        risk = entry_price - stop_loss
        trigger_confirmed = (has_pattern or rsi_reversal or momentum_reclaim) if relaxed else (has_pattern and rsi_reversal)
        if not trigger_confirmed or risk <= pip_size:
            return None

        tp1 = round(entry_price + (risk * 1.5), price_decimals)
        confidence = _build_confidence(has_pattern, rsi_reversal, current_rsi, sweep_state.candles_waited)
        return ExecutionSetup(
            signal=1,
            type="Buy",
            entry_price=entry_price,
            sl=stop_loss,
            tp1=tp1,
            tp2=round(tp2_target, price_decimals) if tp2_target is not None else None,
            reason="h1_bias_m5_reclaim_long_relaxed" if relaxed else "h1_bias_m5_reclaim_long",
            confidence=confidence,
            indicator_snapshot={
                "m5_rsi": round(current_rsi, 2),
                "previous_rsi": round(previous_rsi, 2),
                "reclaim_level": round(sweep_state.reference_level, price_decimals),
            },
            metadata={
                "trigger": "bullish_fvg_or_engulfing_or_rsi_reversal" if relaxed else "bullish_fvg_or_engulfing_with_rsi_reversal",
                "backtest_relaxed": relaxed,
                "momentum_reclaim": momentum_reclaim,
                "sweep_time": sweep_state.sweep_time,
                "reclaim_time": sweep_state.reclaim_time,
                "candles_waited": sweep_state.candles_waited,
                "tp2": round(tp2_target, price_decimals) if tp2_target is not None else None,
            },
        )

    has_pattern = detect_bearish_fvg(working_df) or detect_bearish_engulfing(working_df)
    strict_rsi_reversal = previous_rsi > 70 and current_rsi < previous_rsi and current_rsi <= 70
    relaxed_rsi_reversal = previous_rsi > 55 and current_rsi < previous_rsi
    rsi_reversal = relaxed_rsi_reversal if relaxed else strict_rsi_reversal
    momentum_reclaim = safe_float(latest["close"]) < safe_float(latest["open"]) and safe_float(latest["close"]) < safe_float(previous["low"])
    stop_loss = round(sweep_state.stop_anchor + pip_size, price_decimals)
    risk = stop_loss - entry_price
    trigger_confirmed = (has_pattern or rsi_reversal or momentum_reclaim) if relaxed else (has_pattern and rsi_reversal)
    if not trigger_confirmed or risk <= pip_size:
        return None

    tp1 = round(entry_price - (risk * 1.5), price_decimals)
    confidence = _build_confidence(has_pattern, rsi_reversal, current_rsi, sweep_state.candles_waited)
    return ExecutionSetup(
        signal=-1,
        type="Sell",
        entry_price=entry_price,
        sl=stop_loss,
        tp1=tp1,
        tp2=round(tp2_target, price_decimals) if tp2_target is not None else None,
        reason="h1_bias_m5_reclaim_short_relaxed" if relaxed else "h1_bias_m5_reclaim_short",
        confidence=confidence,
        indicator_snapshot={
            "m5_rsi": round(current_rsi, 2),
            "previous_rsi": round(previous_rsi, 2),
            "reclaim_level": round(sweep_state.reference_level, price_decimals),
        },
        metadata={
            "trigger": "bearish_fvg_or_engulfing_or_rsi_reversal" if relaxed else "bearish_fvg_or_engulfing_with_rsi_reversal",
            "backtest_relaxed": relaxed,
            "momentum_reclaim": momentum_reclaim,
            "sweep_time": sweep_state.sweep_time,
            "reclaim_time": sweep_state.reclaim_time,
            "candles_waited": sweep_state.candles_waited,
            "tp2": round(tp2_target, price_decimals) if tp2_target is not None else None,
        },
    )


def _build_confidence(has_pattern: bool, rsi_reversal: bool, current_rsi: float, waited: int) -> float:
    confidence = 0.5
    if has_pattern:
        confidence += 0.15
    if rsi_reversal:
        confidence += 0.15
    if 35 <= current_rsi <= 65:
        confidence += 0.05
    if waited <= 2:
        confidence += 0.05
    return round(min(confidence, 0.95), 2)
