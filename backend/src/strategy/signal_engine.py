from __future__ import annotations

from collections import deque
from typing import Any

import pandas as pd

from src.strategy.bias import determine_session, evaluate_dxy_bias, evaluate_h1_bias
from src.strategy.execution import build_execution_setup
from src.strategy.indicators import prepare_ohlcv, safe_float
from src.strategy.liquidity import (
    advance_sweep_state,
    build_relaxed_m5_liquidity_state,
    find_tp2_target,
    identify_reference_liquidity,
)
from src.strategy.types import SweepState


class RollingSignalEngineMTF:
    """
    AlphaNode V2 engine.
    Decision order:
    1. H1 environmental bias
    2. DXY correlation and time-block gate
    3. H1 liquidity sweep validation
    4. M5 execution trigger
    """

    def __init__(
        self,
        window_size: int = 360,
        h1_window_size: int = 320,
        timezone_name: str = "Europe/Warsaw",
        pip_size: float = 0.01,
        price_decimals: int = 2,
        dxy_symbol: str = "DXY",
        signal_sl_atr_multiplier: float = 1.1,
        signal_max_stop_distance: float = 5.0,
    ) -> None:
        self._timezone_name = timezone_name
        self._pip_size = pip_size
        self._price_decimals = price_decimals
        self._dxy_symbol = dxy_symbol
        self._signal_sl_atr_multiplier = signal_sl_atr_multiplier
        self._signal_max_stop_distance = signal_max_stop_distance
        self._candles_by_timeframe: dict[str, deque[dict[str, Any]]] = {
            "M1": deque(maxlen=window_size),
            "M5": deque(maxlen=max(window_size // 5, 96)),
            "H1": deque(maxlen=h1_window_size),
            "DXY_H1": deque(maxlen=h1_window_size),
        }
        self._sweep_states: dict[str, SweepState | None] = {
            "LONG": None,
            "SHORT": None,
        }
        self._last_processed_m5_time: str | None = None
        self._last_signal_key: str | None = None

    def seed_from_m1(self, m1_df: pd.DataFrame) -> None:
        self._candles_by_timeframe["M1"].clear()
        for _, row in prepare_ohlcv(m1_df).iterrows():
            self._candles_by_timeframe["M1"].append(self._normalize_row(row))
        self._rebuild_m5_from_m1()

    def seed_from_h1(self, h1_df: pd.DataFrame) -> None:
        self._candles_by_timeframe["H1"].clear()
        for _, row in prepare_ohlcv(h1_df).iterrows():
            self._candles_by_timeframe["H1"].append(self._normalize_row(row))

    def seed_dxy_from_h1(self, dxy_h1_df: pd.DataFrame) -> None:
        self._candles_by_timeframe["DXY_H1"].clear()
        for _, row in prepare_ohlcv(dxy_h1_df).iterrows():
            self._candles_by_timeframe["DXY_H1"].append(self._normalize_row(row))

    def on_new_m1_candle(self, candle: dict[str, Any]) -> None:
        self._candles_by_timeframe["M1"].append(dict(candle))
        self._rebuild_m5_from_m1()

    def on_new_h1_candle(self, candle: dict[str, Any]) -> None:
        self._candles_by_timeframe["H1"].append(dict(candle))

    def on_new_dxy_h1_candle(self, candle: dict[str, Any]) -> None:
        self._candles_by_timeframe["DXY_H1"].append(dict(candle))

    def build_market_snapshot(
        self,
        live_price: float,
        live_dxy_price: float,
        evaluation_time: str,
        execution_profile: str = "STRICT",
    ) -> dict[str, Any]:
        relaxed = execution_profile.upper() == "RELAXED"
        h1_df = pd.DataFrame(list(self._candles_by_timeframe["H1"]))
        dxy_h1_df = pd.DataFrame(list(self._candles_by_timeframe["DXY_H1"]))

        session_context = determine_session(evaluation_time, self._timezone_name)
        dxy_context = evaluate_dxy_bias(dxy_h1_df, live_dxy_price, self._dxy_symbol)
        bias_context = evaluate_h1_bias(
            h1_df,
            live_price,
            dxy_context,
            session_context,
            ignore_dxy_block=relaxed,
        )

        reference_level = None
        if bias_context.side in {"LONG", "SHORT"}:
            reference_level = identify_reference_liquidity(h1_df, bias_context.side, live_price)

        sweep_state = self._sweep_states.get(bias_context.side) if bias_context.side in {"LONG", "SHORT"} else None
        liquidity_cleared = bool(sweep_state and sweep_state.liquidity_cleared)
        market_health_score, components = self._compute_market_health(
            bias_context.side,
            session_context.execution_enabled,
            dxy_context.blocks_longs,
            reference_level is not None,
            liquidity_cleared,
        )

        return {
            "signal": 0,
            "type": None,
            "confidence": 0.0,
            "reason": "monitoring",
            "price": round(float(live_price), self._price_decimals),
            "entry_price": round(float(live_price), self._price_decimals),
            "sl": None,
            "tp1": None,
            "tp2": None,
            "bias_side": bias_context.side,
            "trend_state": bias_context.trend_state,
            "session_name": session_context.name,
            "execution_mode": session_context.mode,
            "dxy_bias": dxy_context.bias,
            "liquidity_cleared": liquidity_cleared,
            "market_health_score": market_health_score,
            "market_health_components": components,
            "reference_liquidity": round(reference_level.price, self._price_decimals) if reference_level else None,
            "indicator_snapshot": {
                "h1_ema200": round(bias_context.ema200, self._price_decimals),
                "kumo_top": round(bias_context.kumo_top, self._price_decimals),
                "kumo_bottom": round(bias_context.kumo_bottom, self._price_decimals),
                "dxy_ema200": round(dxy_context.ema200, 4),
                "dxy_price": round(dxy_context.price, 4),
                "dxy_ema_slope": round(dxy_context.ema_slope, 6),
            },
            "metadata": {
                "bias_reasons": list(bias_context.reasons),
                "session_local_time": session_context.local_time,
                "sweep_time": sweep_state.sweep_time if sweep_state else None,
                "reclaim_time": sweep_state.reclaim_time if sweep_state else None,
                "dxy_symbol": dxy_context.symbol,
                "execution_profile": execution_profile.upper(),
            },
        }

    def evaluate_signal(
        self,
        live_price: float,
        live_dxy_price: float,
        evaluation_time: str,
        execution_profile: str = "STRICT",
    ) -> dict[str, Any]:
        profile = execution_profile.upper()
        relaxed = profile == "RELAXED"
        snapshot = self.build_market_snapshot(live_price, live_dxy_price, evaluation_time, execution_profile=profile)
        m5_df = prepare_ohlcv(pd.DataFrame(list(self._candles_by_timeframe["M5"])))
        h1_df = prepare_ohlcv(pd.DataFrame(list(self._candles_by_timeframe["H1"])))

        if m5_df.empty or len(m5_df) < 4:
            snapshot["reason"] = "waiting_for_m5_history"
            return snapshot

        if snapshot["execution_mode"] != "EXECUTION" and not relaxed:
            snapshot["reason"] = "time_block_monitoring"
            return snapshot

        if snapshot["bias_side"] not in {"LONG", "SHORT"}:
            snapshot["reason"] = "h1_bias_not_aligned"
            return snapshot

        latest_m5 = m5_df.iloc[-1]
        latest_m5_time = latest_m5["time"].isoformat()
        if latest_m5_time == self._last_processed_m5_time:
            snapshot["reason"] = "awaiting_new_m5_close"
            return snapshot

        self._last_processed_m5_time = latest_m5_time

        direction = str(snapshot["bias_side"])
        reference_level = identify_reference_liquidity(h1_df, direction, safe_float(latest_m5["close"]))
        updated_state = advance_sweep_state(
            direction,
            reference_level,
            latest_m5,
            self._sweep_states.get(direction),
            max_reclaim_candles=6 if relaxed else 3,
        )
        self._sweep_states[direction] = updated_state
        used_relaxed_m5_liquidity = False

        if updated_state is None and relaxed:
            updated_state = build_relaxed_m5_liquidity_state(direction, m5_df)
            used_relaxed_m5_liquidity = updated_state is not None

        if updated_state is None:
            snapshot["reason"] = "waiting_for_liquidity_sweep"
            snapshot["liquidity_cleared"] = False
            return snapshot

        snapshot["liquidity_cleared"] = updated_state.liquidity_cleared
        snapshot["reference_liquidity"] = round(updated_state.reference_level, self._price_decimals)
        snapshot["metadata"]["sweep_time"] = updated_state.sweep_time
        snapshot["metadata"]["reclaim_time"] = updated_state.reclaim_time
        snapshot["metadata"]["relaxed_m5_liquidity"] = used_relaxed_m5_liquidity

        if not updated_state.liquidity_cleared:
            snapshot["reason"] = "waiting_for_m5_reclaim"
            return snapshot

        tp2_target = find_tp2_target(h1_df, direction, safe_float(latest_m5["close"]))
        execution_setup, execution_reason = build_execution_setup(
            direction,
            m5_df,
            updated_state,
            tp2_target,
            self._pip_size,
            self._price_decimals,
            self._signal_sl_atr_multiplier,
            self._signal_max_stop_distance,
            relaxed=relaxed,
        )
        if execution_setup is None:
            snapshot["reason"] = execution_reason
            return snapshot

        signal_key = f"{latest_m5_time}:{execution_setup.type}:{execution_setup.reason}"
        if signal_key == self._last_signal_key:
            snapshot["reason"] = "signal_already_emitted"
            return snapshot

        self._last_signal_key = signal_key
        self._sweep_states[direction] = None

        snapshot.update(
            {
                "signal": execution_setup.signal,
                "type": execution_setup.type,
                "confidence": execution_setup.confidence,
                "reason": execution_setup.reason,
                "entry_price": execution_setup.entry_price,
                "sl": execution_setup.sl,
                "tp1": execution_setup.tp1,
                "tp2": execution_setup.tp2,
                "indicator_snapshot": {
                    **snapshot["indicator_snapshot"],
                    **execution_setup.indicator_snapshot,
                },
                "metadata": {
                    **snapshot["metadata"],
                    **execution_setup.metadata,
                },
            }
        )
        return snapshot

    def _compute_market_health(
        self,
        bias_side: str,
        session_enabled: bool,
        dxy_blocks_longs: bool,
        reference_present: bool,
        liquidity_cleared: bool,
    ) -> tuple[int, dict[str, int]]:
        components = {
            "session": 30 if session_enabled else 8,
            "bias": 28 if bias_side in {"LONG", "SHORT"} else 6,
            "dxy": 10 if (bias_side == "LONG" and dxy_blocks_longs) else 18,
            "liquidity_map": 14 if reference_present else 4,
            "execution_ready": 10 if liquidity_cleared else 2,
        }
        score = min(sum(components.values()), 100)
        return score, components

    def _rebuild_m5_from_m1(self) -> None:
        m1_candles = list(self._candles_by_timeframe["M1"])
        if not m1_candles:
            return

        m1_df = prepare_ohlcv(pd.DataFrame(m1_candles))
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
            .reset_index()
        )

        m5_deque = self._candles_by_timeframe["M5"]
        m5_deque.clear()
        for _, row in m5_df.iterrows():
            m5_deque.append(self._normalize_row(row))

    @staticmethod
    def _normalize_row(row: pd.Series) -> dict[str, Any]:
        timestamp = row["time"]
        if hasattr(timestamp, "isoformat"):
            time_value = timestamp.isoformat()
        else:
            time_value = str(timestamp)

        return {
            "time": time_value,
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row.get("volume", 0.0)),
        }
