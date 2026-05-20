from __future__ import annotations

import asyncio
from collections import Counter
import csv
import datetime as dt
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

import pandas as pd

from src.clients.mt5_client import MT5Client
from src.clients.supabase_client import SupabaseRepository
from src.config.settings import Settings
from src.data.aggregators.candle_aggregator import OhlcCandleAggregator
from src.models.signal import SignalPosition
from src.services.signal_filters import SignalFilterOptions, SignalFilterPipeline, SignalFilterState
from src.strategy.signal_engine import RollingSignalEngineMTF


@dataclass(frozen=True)
class SignalRow:
    candle_time: str
    symbol: str
    type: str
    status: str
    reason: str
    confidence: float
    signal_grade: str
    entry_price: float
    tp: float
    sl: float
    exit_price: float | None
    closed_at: str | None
    close_reason: str | None
    dxy_bias: str
    session_name: str
    liquidity_cleared: bool
    relaxed_m5_liquidity: bool
    max_favorable_pips: float | None
    max_adverse_pips: float | None
    minutes_in_trade: float | None
    result_pips: float | None


@dataclass(frozen=True)
class BacktestDiagnosticRow:
    candle_time: str
    reason: str
    bias_side: str
    trend_state: str
    bias_score: int
    bias_age_bars: int
    distance_to_ema_atr: float
    overextended: bool
    soft_overextended: bool
    execution_mode: str
    session_name: str
    dxy_bias: str
    liquidity_cleared: bool
    relaxed_m5_liquidity: bool
    confidence: float
    signal_grade: str
    reference_liquidity: float | None
    market_health_score: int


@dataclass(frozen=True)
class BacktestTradeResult:
    status: str
    exit_price: float
    closed_at: str
    close_reason: str
    result_pips: float
    max_favorable_pips: float
    max_adverse_pips: float
    minutes_in_trade: float


@dataclass
class LiveRuntime:
    engine: RollingSignalEngineMTF
    m1_aggregator: OhlcCandleAggregator
    h1_aggregator: OhlcCandleAggregator
    dxy_h1_aggregator: OhlcCandleAggregator


@dataclass
class ActiveShadowSignal:
    signal: SignalPosition
    signal_grade: str
    max_favorable_pips: float = 0.0
    max_adverse_pips: float = 0.0


class BotRunner:
    def __init__(self, settings: Settings, logger) -> None:
        self._settings = settings
        self._logger = logger
        self._mt5_client = MT5Client(settings)
        self._supabase_repository: SupabaseRepository | None = None
        self._signal_filter_pipeline = SignalFilterPipeline(settings)
        self._last_supabase_market_warning = 0.0

    async def run(self) -> None:
        try:
            if self._settings.app_mode == "BACKTEST":
                await self._run_backtest()
                return
            if self._settings.app_mode == "SHADOW":
                await self._run_shadow()
                return
            await self._run_prod()
        finally:
            self.shutdown()

    def shutdown(self) -> None:
        try:
            self._mt5_client.shutdown()
        except Exception:
            self._logger.exception("MT5 shutdown error")

    async def _run_prod(self) -> None:
        self._logger.info(
            "Starting PROD mode | symbol=%s dxy=%s",
            self._settings.mt5_symbol,
            self._settings.dxy_symbol,
        )

        self._mt5_client.initialize()
        self._supabase_repository = SupabaseRepository(self._settings)
        runtime = self._bootstrap_live_runtime()

        poll_interval = self._settings.mt5_tick_poll_interval_sec
        symbol = self._settings.mt5_symbol
        dxy_symbol = self._settings.dxy_symbol
        last_market_data_update = 0.0
        active_signal = await asyncio.to_thread(self._supabase_repository.get_latest_active_signal, symbol)

        while True:
            try:
                xau_tick = self._mt5_client.get_latest_tick(symbol)
                dxy_tick = self._mt5_client.get_latest_tick(dxy_symbol)
                now = time.monotonic()

                finalized_xau_h1 = runtime.h1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_xau_h1 is not None:
                    runtime.engine.on_new_h1_candle(finalized_xau_h1)

                finalized_dxy_h1 = runtime.dxy_h1_aggregator.update_from_tick(dxy_tick.timestamp, dxy_tick.mid)
                if finalized_dxy_h1 is not None:
                    runtime.engine.on_new_dxy_h1_candle(finalized_dxy_h1)

                market_snapshot = runtime.engine.build_market_snapshot(
                    xau_tick.mid,
                    dxy_tick.mid,
                    xau_tick.timestamp,
                )

                if now - last_market_data_update >= self._settings.market_data_throttle_sec:
                    await asyncio.to_thread(
                        self._publish_market_ticks,
                        xau_tick,
                        dxy_tick,
                        market_snapshot,
                    )
                    last_market_data_update = now

                if active_signal is not None:
                    resolution = self._check_signal_resolution(active_signal, xau_tick.mid, xau_tick.timestamp)
                    if resolution is not None:
                        await asyncio.to_thread(
                            self._supabase_repository.update_signal_status,
                            active_signal.id,
                            **resolution,
                        )
                        self._logger.info(
                            "Signal %s %s at %.2f (%s, %.1f pips)",
                            active_signal.id,
                            resolution["status"],
                            resolution["exit_price"],
                            resolution["close_reason"],
                            resolution["result_pips"],
                        )
                        active_signal = None

                finalized_m1 = runtime.m1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_m1 is None:
                    await asyncio.sleep(poll_interval)
                    continue

                runtime.engine.on_new_m1_candle(finalized_m1)
                if active_signal is not None:
                    await asyncio.sleep(poll_interval)
                    continue

                signal_context = runtime.engine.evaluate_signal(xau_tick.mid, dxy_tick.mid, xau_tick.timestamp)
                if int(signal_context["signal"]) == 0:
                    await asyncio.sleep(poll_interval)
                    continue

                new_signal = self._build_signal(signal_context, symbol, finalized_m1["time"])
                active_signal = await asyncio.to_thread(self._supabase_repository.insert_signal, new_signal)
                self._logger.info(
                    "AlphaNode V2 %s | entry=%.2f sl=%.2f tp1=%.2f tp2=%s session=%s dxy=%s",
                    active_signal.type,
                    active_signal.entry_price,
                    active_signal.sl,
                    active_signal.tp,
                    new_signal.metadata.get("tp2"),
                    active_signal.session_name,
                    active_signal.dxy_bias,
                )
                await asyncio.sleep(poll_interval)

            except Exception:
                self._logger.exception("PROD loop error")
                await asyncio.sleep(2.0)

    async def _run_shadow(self) -> None:
        self._logger.info(
            "Starting SHADOW mode | symbol=%s dxy=%s profile=%s",
            self._settings.mt5_symbol,
            self._settings.dxy_symbol,
            self._settings.shadow_profile,
        )

        self._mt5_client.initialize()
        self._supabase_repository = SupabaseRepository(self._settings)
        runtime = self._bootstrap_live_runtime()
        filter_state = SignalFilterState()
        filter_options = self._build_runtime_filter_options(include_research_signals=True)

        poll_interval = self._settings.mt5_tick_poll_interval_sec
        symbol = self._settings.mt5_symbol
        dxy_symbol = self._settings.dxy_symbol
        last_market_data_update = 0.0
        active_shadow_signal: ActiveShadowSignal | None = None

        while True:
            try:
                xau_tick = self._mt5_client.get_latest_tick(symbol)
                dxy_tick = self._mt5_client.get_latest_tick(dxy_symbol)
                now = time.monotonic()

                finalized_xau_h1 = runtime.h1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_xau_h1 is not None:
                    runtime.engine.on_new_h1_candle(finalized_xau_h1)

                finalized_dxy_h1 = runtime.dxy_h1_aggregator.update_from_tick(dxy_tick.timestamp, dxy_tick.mid)
                if finalized_dxy_h1 is not None:
                    runtime.engine.on_new_dxy_h1_candle(finalized_dxy_h1)

                market_snapshot = runtime.engine.build_market_snapshot(
                    xau_tick.mid,
                    dxy_tick.mid,
                    xau_tick.timestamp,
                )

                if now - last_market_data_update >= self._settings.market_data_throttle_sec:
                    await asyncio.to_thread(
                        self._publish_market_ticks,
                        xau_tick,
                        dxy_tick,
                        market_snapshot,
                    )
                    last_market_data_update = now

                if active_shadow_signal is not None:
                    self._update_shadow_excursions(active_shadow_signal, xau_tick.mid)
                    resolution = self._check_signal_resolution(
                        active_shadow_signal.signal,
                        xau_tick.mid,
                        xau_tick.timestamp,
                    )
                    if resolution is not None:
                        await asyncio.to_thread(
                            self._append_shadow_signal_row,
                            self._build_shadow_signal_row(active_shadow_signal, resolution),
                        )
                        self._logger.info(
                            "SHADOW %s %s at %.2f (%s, %.1f pips)",
                            active_shadow_signal.signal.type,
                            resolution["status"],
                            resolution["exit_price"],
                            resolution["close_reason"],
                            resolution["result_pips"],
                        )
                        active_shadow_signal = None

                finalized_m1 = runtime.m1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_m1 is None:
                    await asyncio.sleep(poll_interval)
                    continue

                runtime.engine.on_new_m1_candle(finalized_m1)
                if active_shadow_signal is not None:
                    await asyncio.sleep(poll_interval)
                    continue

                signal_context = runtime.engine.evaluate_signal(
                    xau_tick.mid,
                    dxy_tick.mid,
                    xau_tick.timestamp,
                    execution_profile=self._settings.shadow_profile,
                )
                if int(signal_context["signal"]) == 0:
                    await asyncio.sleep(poll_interval)
                    continue

                current_time = self._parse_iso(str(finalized_m1["time"]))
                filtered_signal = self._signal_filter_pipeline.apply(
                    signal_context,
                    current_time=current_time,
                    state=filter_state,
                    options=filter_options,
                )
                await asyncio.to_thread(
                    self._append_shadow_diagnostic_row,
                    self._build_backtest_diagnostic(finalized_m1["time"], filtered_signal),
                )
                if int(filtered_signal["signal"]) == 0:
                    await asyncio.sleep(poll_interval)
                    continue

                self._signal_filter_pipeline.register_acceptance(
                    filtered_signal,
                    current_time=current_time,
                    state=filter_state,
                    options=filter_options,
                )
                shadow_signal = self._build_signal(filtered_signal, symbol, finalized_m1["time"])
                active_shadow_signal = ActiveShadowSignal(
                    signal=shadow_signal,
                    signal_grade=self._signal_filter_pipeline.signal_grade(filtered_signal),
                )
                self._logger.info(
                    "SHADOW accepted %s | grade=%s entry=%.2f sl=%.2f tp1=%.2f session=%s dxy=%s",
                    shadow_signal.type,
                    active_shadow_signal.signal_grade,
                    shadow_signal.entry_price,
                    shadow_signal.sl,
                    shadow_signal.tp,
                    shadow_signal.session_name,
                    shadow_signal.dxy_bias,
                )
                await asyncio.sleep(poll_interval)

            except Exception:
                self._logger.exception("SHADOW loop error")
                await asyncio.sleep(2.0)

    def _bootstrap_live_runtime(self) -> LiveRuntime:
        xau_m1_df = self._mt5_client.get_recent_candles(
            self._settings.mt5_symbol,
            "M1",
            self._settings.seed_candle_count,
        ).sort_values("time")
        xau_h1_df = self._mt5_client.get_recent_candles(
            self._settings.mt5_symbol,
            "H1",
            self._settings.h1_seed_candle_count,
        ).sort_values("time")
        dxy_h1_df = self._mt5_client.get_recent_candles(
            self._settings.dxy_symbol,
            "H1",
            self._settings.dxy_seed_h1_count,
        ).sort_values("time")

        if len(xau_m1_df) < 10 or len(xau_h1_df) < 60 or len(dxy_h1_df) < 60:
            raise RuntimeError("Not enough historical candles to initialize AlphaNode V2")

        engine = RollingSignalEngineMTF(
            window_size=self._settings.signal_window_size,
            h1_window_size=self._settings.h1_seed_candle_count,
            timezone_name=self._settings.trading_timezone,
            pip_size=self._settings.pip_size,
            price_decimals=self._settings.price_decimals,
            dxy_symbol=self._settings.dxy_symbol,
            signal_sl_atr_multiplier=self._settings.signal_sl_atr_multiplier,
            signal_max_stop_distance=self._settings.signal_max_stop_distance,
            h1_bias_min_score=self._settings.h1_bias_min_score,
            h1_bias_persistence_bars=self._settings.h1_bias_persistence_bars,
            h1_bias_max_distance_atr=self._settings.h1_bias_max_distance_atr,
            h1_bias_soft_max_distance_atr=0.0,
        )

        last_m1_candle = xau_m1_df.iloc[-1].to_dict()
        last_h1_candle = xau_h1_df.iloc[-1].to_dict()
        last_dxy_h1_candle = dxy_h1_df.iloc[-1].to_dict()

        engine.seed_from_m1(xau_m1_df.iloc[:-1].copy())
        engine.seed_from_h1(xau_h1_df.iloc[:-1].copy())
        engine.seed_dxy_from_h1(dxy_h1_df.iloc[:-1].copy())

        m1_aggregator = OhlcCandleAggregator(timeframe_seconds=60)
        m1_aggregator.prime_with_existing_candle(last_m1_candle)

        h1_aggregator = OhlcCandleAggregator(timeframe_seconds=3600)
        h1_aggregator.prime_with_existing_candle(last_h1_candle)

        dxy_h1_aggregator = OhlcCandleAggregator(timeframe_seconds=3600)
        dxy_h1_aggregator.prime_with_existing_candle(last_dxy_h1_candle)

        return LiveRuntime(
            engine=engine,
            m1_aggregator=m1_aggregator,
            h1_aggregator=h1_aggregator,
            dxy_h1_aggregator=dxy_h1_aggregator,
        )

    async def _run_backtest(self) -> None:
        backtest_from, backtest_to = self._resolve_backtest_range()
        if backtest_from is None or backtest_to is None:
            self._logger.info(
                "Starting BACKTEST mode | symbol=%s dxy=%s profile=%s lookback_days=%d include_research=%s",
                self._settings.mt5_symbol,
                self._settings.dxy_symbol,
                self._settings.backtest_profile,
                self._settings.backtest_lookback_days,
                self._settings.backtest_include_research_signals,
            )
        else:
            self._logger.info(
                "Starting BACKTEST mode | symbol=%s dxy=%s profile=%s range=%s -> %s include_research=%s",
                self._settings.mt5_symbol,
                self._settings.dxy_symbol,
                self._settings.backtest_profile,
                backtest_from.isoformat(),
                backtest_to.isoformat(),
                self._settings.backtest_include_research_signals,
            )
        self._mt5_client.initialize()
        if backtest_from is None or backtest_to is None:
            m1_count, h1_count, dxy_h1_count = self._resolve_backtest_history_counts()
            xau_m1_df = self._mt5_client.get_recent_candles(
                self._settings.mt5_symbol,
                "M1",
                m1_count,
            ).sort_values("time")
            xau_h1_df = self._mt5_client.get_recent_candles(
                self._settings.mt5_symbol,
                "H1",
                h1_count,
            ).sort_values("time")
            dxy_h1_df = self._mt5_client.get_recent_candles(
                self._settings.dxy_symbol,
                "H1",
                dxy_h1_count,
            ).sort_values("time")
            start_index = min(120, len(xau_m1_df) - 2)
        else:
            xau_m1_df, xau_h1_df, dxy_h1_df, start_index = self._load_backtest_history_by_range(
                backtest_from,
                backtest_to,
            )

        if len(xau_m1_df) < 120:
            raise RuntimeError("Not enough M1 candles for backtest")

        engine = RollingSignalEngineMTF(
            window_size=self._settings.signal_window_size,
            h1_window_size=self._settings.h1_seed_candle_count,
            timezone_name=self._settings.trading_timezone,
            pip_size=self._settings.pip_size,
            price_decimals=self._settings.price_decimals,
            dxy_symbol=self._settings.dxy_symbol,
            signal_sl_atr_multiplier=self._settings.signal_sl_atr_multiplier,
            signal_max_stop_distance=self._settings.signal_max_stop_distance,
            h1_bias_min_score=self._settings.backtest_h1_bias_min_score,
            h1_bias_persistence_bars=self._settings.backtest_h1_bias_persistence_bars,
            h1_bias_max_distance_atr=self._settings.backtest_h1_bias_max_distance_atr,
            h1_bias_soft_max_distance_atr=self._settings.backtest_h1_soft_overextended_atr,
        )

        engine.seed_from_m1(xau_m1_df.iloc[:start_index].copy())

        first_eval_time = self._parse_iso(str(xau_m1_df.iloc[start_index]["time"]))
        xau_h1_seed = xau_h1_df[
            pd.to_datetime(xau_h1_df["time"], utc=True, errors="coerce", format="ISO8601") < first_eval_time
        ]
        dxy_h1_seed = dxy_h1_df[
            pd.to_datetime(dxy_h1_df["time"], utc=True, errors="coerce", format="ISO8601") < first_eval_time
        ]

        engine.seed_from_h1(xau_h1_seed.copy())
        engine.seed_dxy_from_h1(dxy_h1_seed.copy())

        rows: list[SignalRow] = []
        diagnostics: list[BacktestDiagnosticRow] = []
        xau_h1_pointer = len(xau_h1_seed)
        dxy_h1_pointer = len(dxy_h1_seed)
        current_dxy_price = self._latest_close(dxy_h1_seed) or self._latest_close(dxy_h1_df) or 0.0
        filter_state = SignalFilterState()
        filter_options = self._build_runtime_filter_options(
            include_research_signals=self._settings.backtest_include_research_signals,
        )

        for index in range(start_index, len(xau_m1_df) - 1):
            candle = xau_m1_df.iloc[index].to_dict()
            current_time = self._parse_iso(str(candle["time"]))

            xau_h1_pointer = self._advance_history_pointer(
                engine.on_new_h1_candle,
                xau_h1_df,
                xau_h1_pointer,
                current_time,
            )
            dxy_h1_pointer = self._advance_history_pointer(
                engine.on_new_dxy_h1_candle,
                dxy_h1_df,
                dxy_h1_pointer,
                current_time,
            )

            if dxy_h1_pointer > 0:
                current_dxy_price = float(dxy_h1_df.iloc[dxy_h1_pointer - 1]["close"])

            engine.on_new_m1_candle(candle)
            signal_context = engine.evaluate_signal(
                float(candle["close"]),
                current_dxy_price,
                str(candle["time"]),
                execution_profile=self._settings.backtest_profile,
            )
            signal_context = self._signal_filter_pipeline.apply(
                signal_context,
                current_time=current_time,
                state=filter_state,
                options=filter_options,
            )
            diagnostics.append(self._build_backtest_diagnostic(str(candle["time"]), signal_context))
            if int(signal_context["signal"]) == 0:
                continue

            self._signal_filter_pipeline.register_acceptance(
                signal_context,
                current_time=current_time,
                state=filter_state,
                options=filter_options,
            )
            simulated_signal = self._build_signal(signal_context, self._settings.mt5_symbol, str(candle["time"]))
            trade_result = self._simulate_backtest_trade(simulated_signal, xau_m1_df, index)
            metadata = dict(signal_context.get("metadata") or {})
            rows.append(
                SignalRow(
                    candle_time=str(candle["time"]),
                    symbol=self._settings.mt5_symbol,
                    type=simulated_signal.type,
                    status=trade_result.status,
                    reason=str(signal_context["reason"]),
                    confidence=float(signal_context["confidence"]),
                    signal_grade=self._build_backtest_signal_grade(signal_context),
                    entry_price=simulated_signal.entry_price,
                    tp=simulated_signal.tp,
                    sl=simulated_signal.sl,
                    exit_price=trade_result.exit_price,
                    closed_at=trade_result.closed_at,
                    close_reason=trade_result.close_reason,
                    dxy_bias=simulated_signal.dxy_bias,
                    session_name=simulated_signal.session_name,
                    liquidity_cleared=simulated_signal.liquidity_cleared,
                    relaxed_m5_liquidity=bool(metadata.get("relaxed_m5_liquidity") or False),
                    max_favorable_pips=trade_result.max_favorable_pips,
                    max_adverse_pips=trade_result.max_adverse_pips,
                    minutes_in_trade=trade_result.minutes_in_trade,
                    result_pips=trade_result.result_pips,
                )
            )

        await asyncio.to_thread(self._write_backtest_csv, rows)
        await asyncio.to_thread(self._write_backtest_diagnostics_csv, diagnostics)
        self._print_backtest_report(rows, diagnostics)
        self._mt5_client.shutdown()

    def _build_signal(
        self,
        signal_context: dict[str, Any],
        symbol: str,
        candle_time: str,
    ) -> SignalPosition:
        signal_timestamp = self._parse_iso(candle_time)
        expires_at = signal_timestamp + dt.timedelta(minutes=self._settings.signal_expiry_minutes)

        return SignalPosition(
            id=None,
            symbol=symbol,
            type=str(signal_context["type"]),
            entry_price=round(float(signal_context["entry_price"]), self._settings.price_decimals),
            tp=round(float(signal_context["tp1"]), self._settings.price_decimals),
            sl=round(float(signal_context["sl"]), self._settings.price_decimals),
            status="ACTIVE",
            timestamp=signal_timestamp.isoformat(),
            expires_at=expires_at.isoformat(),
            confidence=float(signal_context["confidence"]),
            timeframe="M5",
            strategy_version="AlphaNode-V2",
            reason=str(signal_context["reason"]),
            dxy_bias=str(signal_context["dxy_bias"]),
            session_name=str(signal_context["session_name"]),
            liquidity_cleared=bool(signal_context["liquidity_cleared"]),
            indicator_snapshot=dict(signal_context.get("indicator_snapshot") or {}),
            metadata={
                **dict(signal_context.get("metadata") or {}),
                "market_health_score": signal_context.get("market_health_score"),
                "market_health_components": signal_context.get("market_health_components"),
                "reference_liquidity": signal_context.get("reference_liquidity"),
            },
        )

    def _check_signal_resolution(
        self,
        signal: SignalPosition,
        market_price: float,
        tick_timestamp: str,
    ) -> dict[str, Any] | None:
        tick_time = self._parse_iso(tick_timestamp)

        if signal.type == "Buy":
            if market_price >= signal.tp:
                return self._build_resolution(signal, "CLOSED", signal.tp, "tp1_hit", tick_time)
            if market_price <= signal.sl:
                return self._build_resolution(signal, "CLOSED", signal.sl, "stop_loss", tick_time)
        else:
            if market_price <= signal.tp:
                return self._build_resolution(signal, "CLOSED", signal.tp, "tp1_hit", tick_time)
            if market_price >= signal.sl:
                return self._build_resolution(signal, "CLOSED", signal.sl, "stop_loss", tick_time)

        if tick_time >= signal.expires_at_dt:
            exit_price = round(float(market_price), self._settings.price_decimals)
            return self._build_resolution(signal, "EXPIRED", exit_price, "time_expired", tick_time)

        return None

    def _build_resolution(
        self,
        signal: SignalPosition,
        status: str,
        exit_price: float,
        close_reason: str,
        closed_at: dt.datetime,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "exit_price": round(exit_price, self._settings.price_decimals),
            "result_pips": self._calculate_result_pips(signal.type, signal.entry_price, exit_price),
            "close_reason": close_reason,
            "closed_at": closed_at.isoformat(),
        }

    def _calculate_result_pips(self, signal_type: str, entry_price: float, exit_price: float) -> float:
        delta = exit_price - entry_price if signal_type == "Buy" else entry_price - exit_price
        return round(delta / self._settings.pip_size, 1)

    def _build_runtime_filter_options(self, *, include_research_signals: bool) -> SignalFilterOptions:
        return SignalFilterOptions(
            require_execution_session=self._settings.backtest_require_execution_session,
            include_research_signals=include_research_signals,
            min_confidence=self._settings.backtest_min_confidence,
            cooldown_minutes=self._settings.backtest_cooldown_minutes,
        )

    def _simulate_backtest_trade(
        self,
        signal: SignalPosition,
        history_df: pd.DataFrame,
        signal_index: int,
    ) -> BacktestTradeResult:
        entry_time = self._parse_iso(signal.timestamp)
        expiry_time = signal.expires_at_dt
        max_favorable_pips = 0.0
        max_adverse_pips = 0.0
        last_seen_row = history_df.iloc[signal_index]

        for index in range(signal_index + 1, len(history_df)):
            row = history_df.iloc[index]
            row_time = self._parse_iso(str(row["time"]))
            high = float(row["high"])
            low = float(row["low"])
            close = float(row["close"])
            last_seen_row = row

            favorable, adverse = self._calculate_excursion_pips(signal.type, signal.entry_price, high, low)
            max_favorable_pips = max(max_favorable_pips, favorable)
            max_adverse_pips = min(max_adverse_pips, adverse)

            resolution = self._resolve_backtest_candle(signal, high, low)
            if resolution is not None:
                close_reason, exit_price = resolution
                return BacktestTradeResult(
                    status="CLOSED",
                    exit_price=round(exit_price, self._settings.price_decimals),
                    closed_at=row_time.isoformat(),
                    close_reason=close_reason,
                    result_pips=self._calculate_result_pips(signal.type, signal.entry_price, exit_price),
                    max_favorable_pips=round(max_favorable_pips, 1),
                    max_adverse_pips=round(max_adverse_pips, 1),
                    minutes_in_trade=self._minutes_between(entry_time, row_time),
                )

            if row_time >= expiry_time:
                return BacktestTradeResult(
                    status="EXPIRED",
                    exit_price=round(close, self._settings.price_decimals),
                    closed_at=row_time.isoformat(),
                    close_reason="time_expired",
                    result_pips=self._calculate_result_pips(signal.type, signal.entry_price, close),
                    max_favorable_pips=round(max_favorable_pips, 1),
                    max_adverse_pips=round(max_adverse_pips, 1),
                    minutes_in_trade=self._minutes_between(entry_time, row_time),
                )

        fallback_time = self._parse_iso(str(last_seen_row["time"]))
        fallback_close = float(last_seen_row["close"])
        return BacktestTradeResult(
            status="EXPIRED",
            exit_price=round(fallback_close, self._settings.price_decimals),
            closed_at=fallback_time.isoformat(),
            close_reason="history_ended",
            result_pips=self._calculate_result_pips(signal.type, signal.entry_price, fallback_close),
            max_favorable_pips=round(max_favorable_pips, 1),
            max_adverse_pips=round(max_adverse_pips, 1),
            minutes_in_trade=self._minutes_between(entry_time, fallback_time),
        )

    def _resolve_backtest_candle(self, signal: SignalPosition, high: float, low: float) -> tuple[str, float] | None:
        if signal.type == "Buy":
            tp_hit = high >= signal.tp
            sl_hit = low <= signal.sl
            if tp_hit and sl_hit:
                return "ambiguous_stop_loss_first", signal.sl
            if sl_hit:
                return "stop_loss", signal.sl
            if tp_hit:
                return "tp1_hit", signal.tp
            return None

        tp_hit = low <= signal.tp
        sl_hit = high >= signal.sl
        if tp_hit and sl_hit:
            return "ambiguous_stop_loss_first", signal.sl
        if sl_hit:
            return "stop_loss", signal.sl
        if tp_hit:
            return "tp1_hit", signal.tp
        return None

    def _calculate_excursion_pips(
        self,
        signal_type: str,
        entry_price: float,
        high: float,
        low: float,
    ) -> tuple[float, float]:
        if signal_type == "Buy":
            favorable = (high - entry_price) / self._settings.pip_size
            adverse = (low - entry_price) / self._settings.pip_size
        else:
            favorable = (entry_price - low) / self._settings.pip_size
            adverse = (entry_price - high) / self._settings.pip_size
        return round(max(0.0, favorable), 1), round(min(0.0, adverse), 1)

    @staticmethod
    def _minutes_between(start: dt.datetime, end: dt.datetime) -> float:
        return round(max((end - start).total_seconds() / 60.0, 0.0), 1)

    def _update_shadow_excursions(self, active_shadow_signal: ActiveShadowSignal, market_price: float) -> None:
        favorable, adverse = self._calculate_excursion_pips(
            active_shadow_signal.signal.type,
            active_shadow_signal.signal.entry_price,
            market_price,
            market_price,
        )
        active_shadow_signal.max_favorable_pips = max(active_shadow_signal.max_favorable_pips, favorable)
        active_shadow_signal.max_adverse_pips = min(active_shadow_signal.max_adverse_pips, adverse)

    def _build_shadow_signal_row(
        self,
        active_shadow_signal: ActiveShadowSignal,
        resolution: dict[str, Any],
    ) -> SignalRow:
        signal = active_shadow_signal.signal
        closed_at = str(resolution["closed_at"])
        return SignalRow(
            candle_time=signal.timestamp,
            symbol=signal.symbol,
            type=signal.type,
            status=str(resolution["status"]),
            reason=signal.reason,
            confidence=signal.confidence,
            signal_grade=active_shadow_signal.signal_grade,
            entry_price=signal.entry_price,
            tp=signal.tp,
            sl=signal.sl,
            exit_price=float(resolution["exit_price"]),
            closed_at=closed_at,
            close_reason=str(resolution["close_reason"]),
            dxy_bias=signal.dxy_bias,
            session_name=signal.session_name,
            liquidity_cleared=signal.liquidity_cleared,
            relaxed_m5_liquidity=bool(signal.metadata.get("relaxed_m5_liquidity") or False),
            max_favorable_pips=round(active_shadow_signal.max_favorable_pips, 1),
            max_adverse_pips=round(active_shadow_signal.max_adverse_pips, 1),
            minutes_in_trade=self._minutes_between(
                self._parse_iso(signal.timestamp),
                self._parse_iso(closed_at),
            ),
            result_pips=float(resolution["result_pips"]),
        )

    def _append_shadow_signal_row(self, row: SignalRow) -> None:
        self._append_signal_row(self._settings.shadow_csv_path, row)

    def _append_shadow_diagnostic_row(self, row: BacktestDiagnosticRow) -> None:
        self._append_diagnostic_row(self._settings.shadow_diagnostics_csv_path, row)

    def _build_backtest_signal_grade(self, signal_context: dict[str, Any]) -> str:
        return self._signal_filter_pipeline.signal_grade(signal_context)

    def _resolve_backtest_history_counts(self) -> tuple[int, int, int]:
        if self._settings.backtest_lookback_days <= 0:
            return (
                self._settings.seed_candle_count,
                self._settings.h1_seed_candle_count,
                self._settings.dxy_seed_h1_count,
            )

        m1_count = max(self._settings.seed_candle_count, self._settings.backtest_lookback_days * 24 * 60)
        h1_count = max(self._settings.h1_seed_candle_count, (self._settings.backtest_lookback_days * 24) + 260)
        dxy_h1_count = max(self._settings.dxy_seed_h1_count, (self._settings.backtest_lookback_days * 24) + 260)
        return m1_count, h1_count, dxy_h1_count

    def _resolve_backtest_range(self) -> tuple[dt.datetime | None, dt.datetime | None]:
        start_raw = self._settings.backtest_from
        end_raw = self._settings.backtest_to
        if start_raw is None and end_raw is None:
            return None, None
        if start_raw is None or end_raw is None:
            raise ValueError("BACKTEST_FROM and BACKTEST_TO must be provided together")

        start_time = self._parse_backtest_boundary(start_raw, is_end=False)
        end_time = self._parse_backtest_boundary(end_raw, is_end=True)
        if end_time <= start_time:
            raise ValueError("BACKTEST_TO must be later than BACKTEST_FROM")
        return start_time, end_time

    def _parse_backtest_boundary(self, value: str, *, is_end: bool) -> dt.datetime:
        normalized = value.strip()
        timezone = ZoneInfo(self._settings.trading_timezone)
        if "T" not in normalized and " " not in normalized:
            local_date = dt.date.fromisoformat(normalized)
            if is_end:
                local_date += dt.timedelta(days=1)
            local_dt = dt.datetime.combine(local_date, dt.time.min, tzinfo=timezone)
            return local_dt.astimezone(dt.timezone.utc)

        normalized = normalized.replace("Z", "+00:00")
        parsed = dt.datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone)
        return parsed.astimezone(dt.timezone.utc)

    def _load_backtest_history_by_range(
        self,
        backtest_from: dt.datetime,
        backtest_to: dt.datetime,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, int]:
        m1_fetch_start = backtest_from - dt.timedelta(
            minutes=max(self._settings.seed_candle_count, 5 * 24 * 60)
        )
        h1_fetch_start = backtest_from - dt.timedelta(
            hours=max(self._settings.h1_seed_candle_count, 14 * 24)
        )
        dxy_h1_fetch_start = backtest_from - dt.timedelta(
            hours=max(self._settings.dxy_seed_h1_count, 14 * 24)
        )

        xau_m1_df = self._mt5_client.get_candles_in_range(
            self._settings.mt5_symbol,
            "M1",
            m1_fetch_start,
            backtest_to,
        ).sort_values("time").reset_index(drop=True)
        xau_h1_df = self._mt5_client.get_candles_in_range(
            self._settings.mt5_symbol,
            "H1",
            h1_fetch_start,
            backtest_to,
        ).sort_values("time").reset_index(drop=True)
        dxy_h1_df = self._mt5_client.get_candles_in_range(
            self._settings.dxy_symbol,
            "H1",
            dxy_h1_fetch_start,
            backtest_to,
        ).sort_values("time").reset_index(drop=True)

        m1_timestamps = pd.to_datetime(xau_m1_df["time"], utc=True, errors="coerce", format="ISO8601")
        candidate_indices = xau_m1_df.index[m1_timestamps >= backtest_from].tolist()
        if not candidate_indices:
            raise RuntimeError("BACKTEST_FROM is outside the available M1 history returned by MT5")

        start_index = int(candidate_indices[0])
        if start_index < 120:
            raise RuntimeError(
                "Not enough buffered M1 candles before BACKTEST_FROM. Move BACKTEST_FROM later or widen the range."
            )
        if start_index >= len(xau_m1_df) - 1:
            raise RuntimeError("BACKTEST range is too narrow; there are not enough M1 candles to evaluate")

        return xau_m1_df, xau_h1_df, dxy_h1_df, start_index

    def _build_xau_market_extra(self, market_snapshot: dict[str, Any]) -> dict[str, Any]:
        return {
            "role": "primary_market",
            "strategy": "AlphaNode-V2",
            "market_health_score": market_snapshot["market_health_score"],
            "market_health_components": market_snapshot["market_health_components"],
            "bias_side": market_snapshot["bias_side"],
            "trend_state": market_snapshot["trend_state"],
            "session_name": market_snapshot["session_name"],
            "execution_mode": market_snapshot["execution_mode"],
            "dxy_bias": market_snapshot["dxy_bias"],
            "bias_score": market_snapshot["bias_score"],
            "bias_age_bars": market_snapshot["bias_age_bars"],
            "distance_to_ema_atr": market_snapshot["distance_to_ema_atr"],
            "overextended": market_snapshot["overextended"],
            "soft_overextended": market_snapshot["soft_overextended"],
            "liquidity_cleared": market_snapshot["liquidity_cleared"],
            "reference_liquidity": market_snapshot["reference_liquidity"],
            "indicator_snapshot": market_snapshot["indicator_snapshot"],
        }

    def _build_dxy_market_extra(self, market_snapshot: dict[str, Any]) -> dict[str, Any]:
        indicator_snapshot = market_snapshot["indicator_snapshot"]
        return {
            "role": "correlation_index",
            "linked_symbol": self._settings.mt5_symbol,
            "dxy_bias": market_snapshot["dxy_bias"],
            "session_name": market_snapshot["session_name"],
            "market_health_score": market_snapshot["market_health_score"],
            "ema200": indicator_snapshot.get("dxy_ema200"),
            "ema_slope": indicator_snapshot.get("dxy_ema_slope"),
            "price": indicator_snapshot.get("dxy_price"),
        }

    def _publish_market_ticks(
        self,
        xau_tick,
        dxy_tick,
        market_snapshot: dict[str, Any],
    ) -> None:
        xau_written = self._supabase_repository.upsert_market_tick(
            xau_tick,
            extra=self._build_xau_market_extra(market_snapshot),
            source="mt5",
            timeframe="tick",
        )
        dxy_written = self._supabase_repository.upsert_market_tick(
            dxy_tick,
            extra=self._build_dxy_market_extra(market_snapshot),
            source="mt5_dxy",
            timeframe="H1",
        )
        if not xau_written or not dxy_written:
            self._log_transient_market_data_drop(xau_written=xau_written, dxy_written=dxy_written)

    def _log_transient_market_data_drop(self, *, xau_written: bool, dxy_written: bool) -> None:
        now = time.monotonic()
        if now - self._last_supabase_market_warning < 60.0:
            return

        self._last_supabase_market_warning = now
        self._logger.warning(
            "Transient Supabase market_data write failed after retries; dropped tick snapshot (xau_written=%s, dxy_written=%s).",
            xau_written,
            dxy_written,
        )

    @staticmethod
    def _signal_row_headers() -> list[str]:
        return [
            "candle_time",
            "symbol",
            "type",
            "status",
            "reason",
            "confidence",
            "signal_grade",
            "entry_price",
            "tp",
            "sl",
            "exit_price",
            "closed_at",
            "close_reason",
            "dxy_bias",
            "session_name",
            "liquidity_cleared",
            "relaxed_m5_liquidity",
            "max_favorable_pips",
            "max_adverse_pips",
            "minutes_in_trade",
            "result_pips",
        ]

    @staticmethod
    def _signal_row_values(row: SignalRow) -> list[Any]:
        return [
            row.candle_time,
            row.symbol,
            row.type,
            row.status,
            row.reason,
            row.confidence,
            row.signal_grade,
            row.entry_price,
            row.tp,
            row.sl,
            row.exit_price,
            row.closed_at,
            row.close_reason,
            row.dxy_bias,
            row.session_name,
            row.liquidity_cleared,
            row.relaxed_m5_liquidity,
            row.max_favorable_pips,
            row.max_adverse_pips,
            row.minutes_in_trade,
            row.result_pips,
        ]

    @staticmethod
    def _diagnostic_row_headers() -> list[str]:
        return [
            "candle_time",
            "reason",
            "bias_side",
            "trend_state",
            "bias_score",
            "bias_age_bars",
            "distance_to_ema_atr",
            "overextended",
            "soft_overextended",
            "execution_mode",
            "session_name",
            "dxy_bias",
            "liquidity_cleared",
            "relaxed_m5_liquidity",
            "confidence",
            "signal_grade",
            "reference_liquidity",
            "market_health_score",
        ]

    @staticmethod
    def _diagnostic_row_values(row: BacktestDiagnosticRow) -> list[Any]:
        return [
            row.candle_time,
            row.reason,
            row.bias_side,
            row.trend_state,
            row.bias_score,
            row.bias_age_bars,
            row.distance_to_ema_atr,
            row.overextended,
            row.soft_overextended,
            row.execution_mode,
            row.session_name,
            row.dxy_bias,
            row.liquidity_cleared,
            row.relaxed_m5_liquidity,
            row.confidence,
            row.signal_grade,
            row.reference_liquidity,
            row.market_health_score,
        ]

    def _append_signal_row(self, path_value: str, row: SignalRow) -> None:
        path = self._resolve_output_path(path_value)
        write_header = not path.exists()
        with path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if write_header:
                writer.writerow(self._signal_row_headers())
            writer.writerow(self._signal_row_values(row))

    def _append_diagnostic_row(self, path_value: str, row: BacktestDiagnosticRow) -> None:
        path = self._resolve_output_path(path_value)
        write_header = not path.exists()
        with path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if write_header:
                writer.writerow(self._diagnostic_row_headers())
            writer.writerow(self._diagnostic_row_values(row))

    def _resolve_output_path(self, path_value: str) -> Path:
        path = Path(path_value)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / path
        return path

    def _write_backtest_csv(self, rows: list[SignalRow]) -> None:
        path = self._resolve_output_path(self._settings.backtest_csv_path)

        if not rows:
            self._logger.warning("Backtest produced no signals; CSV will not be created.")
            return

        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(self._signal_row_headers())
            for row in rows:
                writer.writerow(self._signal_row_values(row))

    def _build_backtest_diagnostic(self, candle_time: str, signal_context: dict[str, Any]) -> BacktestDiagnosticRow:
        metadata = dict(signal_context.get("metadata") or {})
        return BacktestDiagnosticRow(
            candle_time=candle_time,
            reason=str(signal_context.get("reason") or "unknown"),
            bias_side=str(signal_context.get("bias_side") or "UNKNOWN"),
            trend_state=str(signal_context.get("trend_state") or "UNKNOWN"),
            bias_score=int(signal_context.get("bias_score") or 0),
            bias_age_bars=int(signal_context.get("bias_age_bars") or 0),
            distance_to_ema_atr=float(signal_context.get("distance_to_ema_atr") or 0.0),
            overextended=bool(signal_context.get("overextended") or False),
            soft_overextended=bool(signal_context.get("soft_overextended") or False),
            execution_mode=str(signal_context.get("execution_mode") or "UNKNOWN"),
            session_name=str(signal_context.get("session_name") or "UNKNOWN"),
            dxy_bias=str(signal_context.get("dxy_bias") or "UNKNOWN"),
            liquidity_cleared=bool(signal_context.get("liquidity_cleared") or False),
            relaxed_m5_liquidity=bool(metadata.get("relaxed_m5_liquidity") or False),
            confidence=float(signal_context.get("confidence") or 0.0),
            signal_grade=self._build_backtest_signal_grade(signal_context),
            reference_liquidity=(
                float(signal_context["reference_liquidity"])
                if signal_context.get("reference_liquidity") is not None
                else None
            ),
            market_health_score=int(signal_context.get("market_health_score") or 0),
        )

    def _write_backtest_diagnostics_csv(self, rows: list[BacktestDiagnosticRow]) -> None:
        path = self._resolve_output_path(self._settings.backtest_diagnostics_csv_path)

        if not rows:
            return

        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(self._diagnostic_row_headers())
            for row in rows:
                writer.writerow(self._diagnostic_row_values(row))

        self._logger.info("BACKTEST diagnostics written: %s", path)

    def _print_backtest_report(self, rows: list[SignalRow], diagnostics: list[BacktestDiagnosticRow]) -> None:
        reason_counts = Counter(row.reason for row in diagnostics)
        if reason_counts:
            self._logger.info("BACKTEST top rejection reasons: %s", dict(reason_counts.most_common(8)))

        if not rows:
            return

        wins = sum(1 for row in rows if row.result_pips is not None and row.result_pips > 0)
        losses = sum(1 for row in rows if row.result_pips is not None and row.result_pips <= 0)
        total_pips = sum(float(row.result_pips or 0.0) for row in rows)
        winrate = wins / max(1, wins + losses)
        avg_mfe = sum(float(row.max_favorable_pips or 0.0) for row in rows) / max(1, len(rows))
        avg_mae = sum(float(row.max_adverse_pips or 0.0) for row in rows) / max(1, len(rows))

        self._logger.info(
            "BACKTEST report: signals=%d winrate=%.2f total_pips=%.1f avg_mfe=%.1f avg_mae=%.1f (wins=%d losses=%d)",
            len(rows),
            winrate,
            total_pips,
            avg_mfe,
            avg_mae,
            wins,
            losses,
        )
        self._logger.info("BACKTEST close reasons: %s", dict(Counter(row.close_reason or "unknown" for row in rows)))
        self._logger.info("BACKTEST signal grades: %s", dict(Counter(row.signal_grade for row in rows)))

        tradeable_rows = [row for row in rows if row.signal_grade != "RESEARCH_M5"]
        if tradeable_rows:
            tradeable_wins = sum(1 for row in tradeable_rows if row.result_pips is not None and row.result_pips > 0)
            tradeable_losses = sum(1 for row in tradeable_rows if row.result_pips is not None and row.result_pips <= 0)
            tradeable_total_pips = sum(float(row.result_pips or 0.0) for row in tradeable_rows)
            tradeable_winrate = tradeable_wins / max(1, tradeable_wins + tradeable_losses)
            self._logger.info(
                "BACKTEST tradeable-only report: signals=%d winrate=%.2f total_pips=%.1f (wins=%d losses=%d)",
                len(tradeable_rows),
                tradeable_winrate,
                tradeable_total_pips,
                tradeable_wins,
                tradeable_losses,
            )
        else:
            self._logger.info("BACKTEST tradeable-only report: no STRICT/RELAXED signals, only RESEARCH_M5 samples.")

    @staticmethod
    def _advance_history_pointer(
        callback: Callable[[dict[str, Any]], None],
        history_df: pd.DataFrame,
        pointer: int,
        current_time: dt.datetime,
    ) -> int:
        while pointer < len(history_df):
            row = history_df.iloc[pointer]
            row_time = dt.datetime.fromisoformat(str(row["time"]).replace("Z", "+00:00")).astimezone(dt.timezone.utc)
            if row_time > current_time:
                break
            callback(row.to_dict())
            pointer += 1
        return pointer

    @staticmethod
    def _latest_close(history_df: pd.DataFrame) -> float | None:
        if history_df.empty:
            return None
        return float(history_df.iloc[-1]["close"])

    @staticmethod
    def _parse_iso(value: str) -> dt.datetime:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
