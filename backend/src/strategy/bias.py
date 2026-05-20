from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pandas as pd

from src.strategy.indicators import atr, ema, ichimoku_cloud, prepare_ohlcv, safe_float
from src.strategy.types import BiasContext, DxyContext, SessionContext


def determine_session(evaluation_time: str, timezone_name: str) -> SessionContext:
    timestamp = dt.datetime.fromisoformat(evaluation_time.replace("Z", "+00:00")).astimezone(ZoneInfo(timezone_name))
    current_minutes = timestamp.hour * 60 + timestamp.minute

    london_start = 9 * 60
    london_end = 12 * 60
    ny_start = 14 * 60 + 30
    ny_end = 18 * 60 + 30

    if london_start <= current_minutes < london_end:
        return SessionContext(
            name="LONDON_OPEN",
            execution_enabled=True,
            mode="EXECUTION",
            local_time=timestamp.isoformat(),
        )

    if ny_start <= current_minutes < ny_end:
        return SessionContext(
            name="NY_OPEN_OVERLAP",
            execution_enabled=True,
            mode="EXECUTION",
            local_time=timestamp.isoformat(),
        )

    return SessionContext(
        name="MONITORING",
        execution_enabled=False,
        mode="MONITORING",
        local_time=timestamp.isoformat(),
    )


def evaluate_dxy_bias(dxy_h1_df: pd.DataFrame, live_price: float, dxy_symbol: str) -> DxyContext:
    working_df = prepare_ohlcv(dxy_h1_df)
    if working_df.empty or len(working_df) < 210:
        return DxyContext(
            symbol=dxy_symbol,
            bias="UNAVAILABLE",
            price=safe_float(live_price),
            ema200=0.0,
            ema_slope=0.0,
            blocks_longs=False,
        )

    working_df["ema200"] = ema(working_df["close"], 200)
    latest = working_df.iloc[-1]
    previous = working_df.iloc[-2]

    dxy_price = safe_float(latest["close"])
    dxy_ema200 = safe_float(latest["ema200"])
    ema_slope = dxy_ema200 - safe_float(previous["ema200"])
    bullish = dxy_price > dxy_ema200 and ema_slope >= 0
    bearish = dxy_price < dxy_ema200 and ema_slope <= 0

    if bullish:
        bias = "BULLISH_DXY"
    elif bearish:
        bias = "BEARISH_DXY"
    else:
        bias = "NEUTRAL_DXY"

    return DxyContext(
        symbol=dxy_symbol,
        bias=bias,
        price=dxy_price,
        ema200=dxy_ema200,
        ema_slope=ema_slope,
        blocks_longs=bullish,
    )


def evaluate_h1_bias(
    h1_df: pd.DataFrame,
    live_price: float,
    dxy_context: DxyContext,
    session_context: SessionContext,
    *,
    min_score: int = 3,
    persistence_bars: int = 2,
    max_distance_atr: float = 2.5,
    soft_max_distance_atr: float | None = None,
    ignore_dxy_block: bool = False,
) -> BiasContext:
    working_df = prepare_ohlcv(h1_df)
    required_history = max(210, persistence_bars + 5)
    if working_df.empty or len(working_df) < required_history:
        return BiasContext(
            side="NEUTRAL",
            trend_state="INSUFFICIENT_DATA",
            price=safe_float(live_price),
            ema200=0.0,
            ema_slope=0.0,
            kumo_top=0.0,
            kumo_bottom=0.0,
            tenkan=0.0,
            kijun=0.0,
            atr14=0.0,
            bias_score=0,
            bias_age_bars=0,
            distance_to_ema_atr=0.0,
            overextended=False,
            soft_overextended=False,
            session_name=session_context.name,
            reasons=("need_more_h1_history",),
        )

    cloud_df = ichimoku_cloud(working_df)
    cloud_df["ema200"] = ema(cloud_df["close"], 200)
    cloud_df["ema_slope"] = cloud_df["ema200"].diff()
    cloud_df["atr14"] = atr(cloud_df, 14)

    row_evaluations = [_evaluate_h1_row(cloud_df, index, min_score) for index in range(1, len(cloud_df))]
    latest_eval = row_evaluations[-1]

    price = safe_float(latest_eval["close"])
    ema200_value = safe_float(latest_eval["ema200"])
    ema_slope = safe_float(latest_eval["ema_slope"])
    tenkan = safe_float(latest_eval["tenkan"])
    kijun = safe_float(latest_eval["kijun"])
    kumo_top = safe_float(latest_eval["kumo_top"])
    kumo_bottom = safe_float(latest_eval["kumo_bottom"])
    atr14_value = safe_float(latest_eval["atr14"])

    reasons = list(latest_eval["reasons"])
    side = str(latest_eval["side"])
    trend_state = str(latest_eval["trend_state"])
    bias_score = int(latest_eval["score"])
    bias_age_bars = _count_consecutive_bias_bars(row_evaluations, side)
    distance_to_ema_atr = abs(float(live_price) - ema200_value) / atr14_value if atr14_value > 0 else 0.0
    overextended = side in {"LONG", "SHORT"} and distance_to_ema_atr > max_distance_atr
    soft_overextended = False

    if side in {"LONG", "SHORT"} and bias_age_bars < persistence_bars:
        reasons.append("bias_persistence_not_met")
        trend_state = f"{side}_PENDING"
        side = "NEUTRAL"

    if side in {"LONG", "SHORT"} and overextended:
        can_soften = (
            soft_max_distance_atr is not None
            and soft_max_distance_atr > max_distance_atr
            and distance_to_ema_atr <= soft_max_distance_atr
        )
        if can_soften:
            reasons.append("h1_soft_overextended")
            trend_state = f"{trend_state}_SOFT_EXT"
            overextended = False
            soft_overextended = True
        else:
            reasons.append("h1_overextended_from_ema")
            trend_state = "OVEREXTENDED"
            side = "NEUTRAL"

    if side == "LONG" and dxy_context.blocks_longs and not ignore_dxy_block:
        reasons.append("dxy_blocks_longs")
        side = "NEUTRAL"
        trend_state = "DXY_BLOCKED"
    elif side == "LONG" and dxy_context.blocks_longs:
        reasons.append("dxy_block_relaxed_for_backtest")

    if not session_context.execution_enabled:
        reasons.append("time_block_monitoring_mode")

    return BiasContext(
        side=side,
        trend_state=trend_state,
        price=price,
        ema200=ema200_value,
        ema_slope=ema_slope,
        kumo_top=kumo_top,
        kumo_bottom=kumo_bottom,
        tenkan=tenkan,
        kijun=kijun,
        atr14=atr14_value,
        bias_score=bias_score,
        bias_age_bars=bias_age_bars,
        distance_to_ema_atr=round(distance_to_ema_atr, 3),
        overextended=overextended,
        soft_overextended=soft_overextended,
        session_name=session_context.name,
        reasons=tuple(reasons),
    )


def _evaluate_h1_row(cloud_df: pd.DataFrame, index: int, min_score: int) -> dict[str, object]:
    current = cloud_df.iloc[index]
    previous = cloud_df.iloc[index - 1]

    close = safe_float(current["close"])
    ema200_value = safe_float(current["ema200"])
    ema_slope = safe_float(current["ema_slope"])
    tenkan = safe_float(current["tenkan"])
    kijun = safe_float(current["kijun"])
    atr14_value = safe_float(current["atr14"])
    senkou_a = safe_float(current["senkou_a"])
    senkou_b = safe_float(current["senkou_b"])
    kumo_top = max(senkou_a, senkou_b)
    kumo_bottom = min(senkou_a, senkou_b)

    previous_close = safe_float(previous["close"])
    previous_low = safe_float(previous["low"])
    previous_high = safe_float(previous["high"])
    current_low = safe_float(current["low"])
    current_high = safe_float(current["high"])

    long_checks = [
        ("close_above_ema200", close > ema200_value),
        ("ema_slope_positive", ema_slope >= 0),
        ("close_above_kumo_top", close > kumo_top),
        ("tenkan_above_kijun", tenkan >= kijun),
        ("higher_low_and_close", current_low >= previous_low and close >= previous_close),
    ]
    short_checks = [
        ("close_below_ema200", close < ema200_value),
        ("ema_slope_negative", ema_slope <= 0),
        ("close_below_kumo_bottom", close < kumo_bottom),
        ("tenkan_below_kijun", tenkan <= kijun),
        ("lower_high_and_close", current_high <= previous_high and close <= previous_close),
    ]

    long_score = sum(1 for _, passed in long_checks if passed)
    short_score = sum(1 for _, passed in short_checks if passed)
    long_base = close > ema200_value and close >= kumo_bottom
    short_base = close < ema200_value and close <= kumo_top

    side = "NEUTRAL"
    trend_state = "RANGE"
    reasons: list[str] = []
    score = max(long_score, short_score)

    if long_base and long_score >= min_score and long_score > short_score:
        side = "LONG"
        trend_state = "BULLISH_STRUCTURE"
        reasons.extend(name for name, passed in long_checks if passed)
    elif short_base and short_score >= min_score and short_score > long_score:
        side = "SHORT"
        trend_state = "BEARISH_STRUCTURE"
        reasons.extend(name for name, passed in short_checks if passed)
    else:
        reasons.append("mixed_h1_structure")
        if long_base or short_base:
            reasons.append("h1_score_below_threshold")

    return {
        "time": current["time"],
        "side": side,
        "trend_state": trend_state,
        "reasons": reasons,
        "score": score,
        "close": close,
        "ema200": ema200_value,
        "ema_slope": ema_slope,
        "tenkan": tenkan,
        "kijun": kijun,
        "atr14": atr14_value,
        "kumo_top": kumo_top,
        "kumo_bottom": kumo_bottom,
    }


def _count_consecutive_bias_bars(row_evaluations: list[dict[str, object]], side: str) -> int:
    if side not in {"LONG", "SHORT"}:
        return 0

    age = 0
    for row in reversed(row_evaluations):
        if row["side"] != side:
            break
        age += 1
    return age
