from __future__ import annotations

import asyncio
import csv
import datetime as dt
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import pandas as pd

from src.clients.mt5_client import MT5Client
from src.clients.supabase_client import SupabaseRepository
from src.config.settings import Settings
from src.data.aggregators.candle_aggregator import OhlcCandleAggregator
from src.models.signal import SignalPosition
from src.strategy.signal_engine import RollingSignalEngineMTF


@dataclass(frozen=True)
class SignalRow:
    candle_time: str
    symbol: str
    type: str
    status: str
    reason: str
    confidence: float
    entry_price: float
    exit_price: float | None
    dxy_bias: str
    session_name: str
    liquidity_cleared: bool
    result_pips: float | None


class BotRunner:
    def __init__(self, settings: Settings, logger) -> None:
        self._settings = settings
        self._logger = logger
        self._mt5_client = MT5Client(settings)
        self._supabase_repository: SupabaseRepository | None = None

    async def run(self) -> None:
        try:
            if self._settings.app_mode == "BACKTEST":
                await self._run_backtest()
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

                finalized_xau_h1 = h1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_xau_h1 is not None:
                    engine.on_new_h1_candle(finalized_xau_h1)

                finalized_dxy_h1 = dxy_h1_aggregator.update_from_tick(dxy_tick.timestamp, dxy_tick.mid)
                if finalized_dxy_h1 is not None:
                    engine.on_new_dxy_h1_candle(finalized_dxy_h1)

                market_snapshot = engine.build_market_snapshot(
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

                finalized_m1 = m1_aggregator.update_from_tick(xau_tick.timestamp, xau_tick.mid)
                if finalized_m1 is None:
                    await asyncio.sleep(poll_interval)
                    continue

                engine.on_new_m1_candle(finalized_m1)
                if active_signal is not None:
                    await asyncio.sleep(poll_interval)
                    continue

                signal_context = engine.evaluate_signal(xau_tick.mid, dxy_tick.mid, xau_tick.timestamp)
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

    async def _run_backtest(self) -> None:
        self._logger.info(
            "Starting BACKTEST mode | symbol=%s dxy=%s",
            self._settings.mt5_symbol,
            self._settings.dxy_symbol,
        )
        self._mt5_client.initialize()

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

        if len(xau_m1_df) < 120:
            raise RuntimeError("Not enough M1 candles for backtest")

        engine = RollingSignalEngineMTF(
            window_size=self._settings.signal_window_size,
            h1_window_size=self._settings.h1_seed_candle_count,
            timezone_name=self._settings.trading_timezone,
            pip_size=self._settings.pip_size,
            price_decimals=self._settings.price_decimals,
            dxy_symbol=self._settings.dxy_symbol,
        )

        start_index = min(120, len(xau_m1_df) - 2)
        engine.seed_from_m1(xau_m1_df.iloc[:start_index].copy())

        first_eval_time = self._parse_iso(str(xau_m1_df.iloc[start_index]["time"]))
        xau_h1_seed = xau_h1_df[pd.to_datetime(xau_h1_df["time"], utc=True) < first_eval_time]
        dxy_h1_seed = dxy_h1_df[pd.to_datetime(dxy_h1_df["time"], utc=True) < first_eval_time]

        engine.seed_from_h1(xau_h1_seed.copy())
        engine.seed_dxy_from_h1(dxy_h1_seed.copy())

        rows: list[SignalRow] = []
        xau_h1_pointer = len(xau_h1_seed)
        dxy_h1_pointer = len(dxy_h1_seed)
        current_dxy_price = self._latest_close(dxy_h1_seed) or self._latest_close(dxy_h1_df) or 0.0

        for index in range(start_index, len(xau_m1_df) - 1):
            candle = xau_m1_df.iloc[index].to_dict()
            next_close = float(xau_m1_df.iloc[index + 1]["close"])
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
            signal_context = engine.evaluate_signal(float(candle["close"]), current_dxy_price, str(candle["time"]))
            if int(signal_context["signal"]) == 0:
                continue

            simulated_signal = self._build_signal(signal_context, self._settings.mt5_symbol, str(candle["time"]))
            result_pips = self._calculate_result_pips(
                simulated_signal.type,
                simulated_signal.entry_price,
                next_close,
            )
            rows.append(
                SignalRow(
                    candle_time=str(candle["time"]),
                    symbol=self._settings.mt5_symbol,
                    type=simulated_signal.type,
                    status="CLOSED",
                    reason=str(signal_context["reason"]),
                    confidence=float(signal_context["confidence"]),
                    entry_price=simulated_signal.entry_price,
                    exit_price=next_close,
                    dxy_bias=simulated_signal.dxy_bias,
                    session_name=simulated_signal.session_name,
                    liquidity_cleared=simulated_signal.liquidity_cleared,
                    result_pips=result_pips,
                )
            )

        await asyncio.to_thread(self._write_backtest_csv, rows)
        self._print_backtest_report(rows)
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
        self._supabase_repository.upsert_market_tick(
            xau_tick,
            extra=self._build_xau_market_extra(market_snapshot),
            source="mt5",
            timeframe="tick",
        )
        self._supabase_repository.upsert_market_tick(
            dxy_tick,
            extra=self._build_dxy_market_extra(market_snapshot),
            source="mt5_dxy",
            timeframe="H1",
        )

    def _write_backtest_csv(self, rows: list[SignalRow]) -> None:
        path = Path(self._settings.backtest_csv_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / path

        if not rows:
            self._logger.warning("Backtest produced no signals; CSV will not be created.")
            return

        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "candle_time",
                    "symbol",
                    "type",
                    "status",
                    "reason",
                    "confidence",
                    "entry_price",
                    "exit_price",
                    "dxy_bias",
                    "session_name",
                    "liquidity_cleared",
                    "result_pips",
                ]
            )
            for row in rows:
                writer.writerow(
                    [
                        row.candle_time,
                        row.symbol,
                        row.type,
                        row.status,
                        row.reason,
                        row.confidence,
                        row.entry_price,
                        row.exit_price,
                        row.dxy_bias,
                        row.session_name,
                        row.liquidity_cleared,
                        row.result_pips,
                    ]
                )

    def _print_backtest_report(self, rows: list[SignalRow]) -> None:
        if not rows:
            return

        wins = sum(1 for row in rows if row.result_pips is not None and row.result_pips > 0)
        losses = sum(1 for row in rows if row.result_pips is not None and row.result_pips <= 0)
        total_pips = sum(float(row.result_pips or 0.0) for row in rows)
        winrate = wins / max(1, wins + losses)

        self._logger.info(
            "BACKTEST report: signals=%d winrate=%.2f total_pips=%.1f (wins=%d losses=%d)",
            len(rows),
            winrate,
            total_pips,
            wins,
            losses,
        )

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
