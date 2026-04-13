from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pandas as pd

from src.strategy.indicators import append_live_price, ema, ichimoku_cloud, prepare_ohlcv, safe_float
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
    working_df = append_live_price(dxy_h1_df, live_price)
    if working_df.empty or len(working_df) < 210:
        return DxyContext(
            symbol=dxy_symbol,
            bias="UNAVAILABLE",
            price=safe_float(live_price),
            ema200=0.0,
            ema_slope=0.0,
            blocks_longs=False,
        )

    working_df = prepare_ohlcv(working_df)
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
) -> BiasContext:
    working_df = append_live_price(h1_df, live_price)
    if working_df.empty or len(working_df) < 210:
        return BiasContext(
            side="NEUTRAL",
            trend_state="INSUFFICIENT_DATA",
            price=safe_float(live_price),
            ema200=0.0,
            kumo_top=0.0,
            kumo_bottom=0.0,
            session_name=session_context.name,
            reasons=("need_more_h1_history",),
        )

    cloud_df = ichimoku_cloud(working_df)
    cloud_df["ema200"] = ema(cloud_df["close"], 200)
    latest = cloud_df.iloc[-1]

    price = safe_float(latest["close"])
    ema200_value = safe_float(latest["ema200"])
    senkou_a = safe_float(latest["senkou_a"])
    senkou_b = safe_float(latest["senkou_b"])
    kumo_top = max(senkou_a, senkou_b)
    kumo_bottom = min(senkou_a, senkou_b)

    reasons: list[str] = []
    trend_state = "RANGE"
    side = "NEUTRAL"

    if price > ema200_value and price > kumo_top:
        trend_state = "BULLISH_STRUCTURE"
        side = "LONG"
        reasons.append("price_above_ema200")
        reasons.append("price_above_kumo")
    elif price < ema200_value and price < kumo_bottom:
        trend_state = "BEARISH_STRUCTURE"
        side = "SHORT"
        reasons.append("price_below_ema200")
        reasons.append("price_below_kumo")
    else:
        reasons.append("mixed_h1_structure")

    if side == "LONG" and dxy_context.blocks_longs:
        reasons.append("dxy_blocks_longs")
        side = "NEUTRAL"
        trend_state = "DXY_BLOCKED"

    if not session_context.execution_enabled:
        reasons.append("time_block_monitoring_mode")

    return BiasContext(
        side=side,
        trend_state=trend_state,
        price=price,
        ema200=ema200_value,
        kumo_top=kumo_top,
        kumo_bottom=kumo_bottom,
        session_name=session_context.name,
        reasons=tuple(reasons),
    )
