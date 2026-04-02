from __future__ import annotations

import asyncio
import csv
import time
from dataclasses import dataclass
from typing import Any

from src.clients.mt5_client import MT5Client
from src.clients.supabase_client import SupabaseRepository
from src.config.settings import Settings
from src.data.aggregators.candle_aggregator import OhlcCandleAggregator
from src.strategy.signal_engine import RollingSignalEngineMTF


@dataclass(frozen=True)
class SignalRow:
    candle_time: str
    symbol: str
    signal: int
    reason: str
    confidence: float
    price: float
    regime: str
    next_close: float | None
    pnl: float | None


class BotRunner:
    def __init__(self, settings: Settings, logger) -> None:
        self._settings = settings
        self._logger = logger

        self._mt5_client = MT5Client(settings)
        self._supabase_repository: SupabaseRepository | None = None

    async def run(self) -> None:
        if self._settings.app_mode == "BACKTEST":
            await self._run_backtest()
            return

        await self._run_prod()

    async def _run_prod(self) -> None:
        self._logger.info("Starting PROD mode with symbol=%s", self._settings.mt5_symbol)

        self._mt5_client.initialize()
        self._supabase_repository = SupabaseRepository(self._settings)

        m1_df = self._mt5_client.get_recent_m1_candles(self._settings.mt5_symbol, 200).sort_values("time")
        if len(m1_df) < 2:
            raise RuntimeError("Not enough M1 candles to start")

        last_candle = m1_df.iloc[-1].to_dict()
        seed_df = m1_df.iloc[:-1].copy()

        engine = RollingSignalEngineMTF(window_size=self._settings.signal_window_size)
        engine.seed_from_m1(seed_df)

        m1_aggregator = OhlcCandleAggregator(timeframe_seconds=60)
        m1_aggregator.prime_with_existing_candle(last_candle)

        last_market_data_update = 0.0
        last_evaluated_m1_time: str | None = None

        poll_interval = self._settings.mt5_tick_poll_interval_sec
        symbol = self._settings.mt5_symbol

        while True:
            try:
                tick = self._mt5_client.get_latest_tick(symbol)
                now = time.monotonic()

                # Throttle market_data upsert: max once per second.
                if now - last_market_data_update >= self._settings.market_data_throttle_sec:
                    await asyncio.to_thread(self._supabase_repository.upsert_market_tick, tick)
                    last_market_data_update = now

                finalized_candle = m1_aggregator.update_from_tick(tick.timestamp, tick.mid)
                if finalized_candle is None:
                    await asyncio.sleep(poll_interval)
                    continue

                engine.on_new_m1_candle(finalized_candle)
                if last_evaluated_m1_time == finalized_candle["time"]:
                    await asyncio.sleep(poll_interval)
                    continue

                signal_context = engine.evaluate()
                last_evaluated_m1_time = finalized_candle["time"]
                signal_value = int(signal_context["signal"])

                if signal_value == 0:
                    await asyncio.sleep(poll_interval)
                    continue

                payload: dict[str, Any] = {
                    "symbol": symbol,
                    "signal": signal_value,
                    "reason": signal_context["reason"],
                    "confidence": signal_context["confidence"],
                    "regime": signal_context["regime"],
                    "price": signal_context["price"],
                    "timeframe": "M1",
                    "strategy_version": "v1",
                    "indicator_snapshot": {
                        "zscore": signal_context.get("zscore"),
                        "rsi": signal_context.get("rsi"),
                        "kalman": signal_context.get("kalman"),
                    },
                    "metadata": {
                        "score_long": signal_context.get("score_long"),
                        "score_short": signal_context.get("score_short"),
                    },
                    "market_tick_time": tick.timestamp,
                }
                await asyncio.to_thread(self._supabase_repository.insert_signal, payload)
                self._logger.info(
                    "Signal inserted: %s=%s reason=%s confidence=%.2f",
                    symbol,
                    signal_value,
                    signal_context["reason"],
                    float(signal_context["confidence"]),
                )
                await asyncio.sleep(poll_interval)

            except Exception:
                self._logger.exception("PROD loop error")
                await asyncio.sleep(2.0)

    async def _run_backtest(self) -> None:
        self._logger.info("Starting BACKTEST mode with symbol=%s", self._settings.mt5_symbol)
        self._mt5_client.initialize()

        m1_df = self._mt5_client.get_recent_m1_candles(self._settings.mt5_symbol, 200).sort_values("time")
        if len(m1_df) < 3:
            raise RuntimeError("Not enough M1 candles for backtest")

        engine = RollingSignalEngineMTF(window_size=self._settings.signal_window_size)

        start_index = 60  # enough to populate rolling indicators in this strategy
        start_index = min(start_index, len(m1_df) - 2)

        engine.seed_from_m1(m1_df.iloc[:start_index].copy())

        rows: list[SignalRow] = []
        symbol = self._settings.mt5_symbol

        for i in range(start_index, len(m1_df) - 1):
            candle = m1_df.iloc[i].to_dict()
            next_close = float(m1_df.iloc[i + 1]["close"])
            current_close = float(m1_df.iloc[i]["close"])

            engine.on_new_m1_candle(candle)
            signal_context = engine.evaluate()
            signal_value = int(signal_context["signal"])

            if signal_value == 0:
                continue

            pnl: float = (next_close - current_close) if signal_value == 1 else (current_close - next_close)

            rows.append(
                SignalRow(
                    candle_time=str(candle["time"]),
                    symbol=symbol,
                    signal=signal_value,
                    reason=str(signal_context["reason"]),
                    confidence=float(signal_context["confidence"]),
                    price=float(signal_context["price"]),
                    regime=str(signal_context["regime"]),
                    next_close=next_close,
                    pnl=pnl,
                )
            )

        await asyncio.to_thread(self._write_backtest_csv, rows)
        self._print_backtest_report(rows)

        self._mt5_client.shutdown()

    def _write_backtest_csv(self, rows: list[SignalRow]) -> None:
        path = self._settings.backtest_csv_path
        if not rows:
            self._logger.warning("Backtest produced no signals; CSV will not be created.")
            return

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "candle_time",
                    "symbol",
                    "signal",
                    "reason",
                    "confidence",
                    "price",
                    "regime",
                    "next_close",
                    "pnl",
                ]
            )
            for row in rows:
                writer.writerow(
                    [
                        row.candle_time,
                        row.symbol,
                        row.signal,
                        row.reason,
                        row.confidence,
                        row.price,
                        row.regime,
                        row.next_close,
                        row.pnl,
                    ]
                )

    def _print_backtest_report(self, rows: list[SignalRow]) -> None:
        if not rows:
            return

        wins = sum(1 for r in rows if r.pnl is not None and r.pnl > 0)
        losses = sum(1 for r in rows if r.pnl is not None and r.pnl <= 0)
        total_pnl = sum(float(r.pnl or 0.0) for r in rows)

        winrate = wins / max(1, (wins + losses))
        self._logger.info(
            "BACKTEST report: signals=%d winrate=%.2f total_pnl=%.4f (wins=%d losses=%d)",
            len(rows),
            winrate,
            total_pnl,
            wins,
            losses,
        )

