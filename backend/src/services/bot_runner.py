from __future__ import annotations

import asyncio
import csv
import datetime as dt
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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
    regime: str
    result_pips: float | None


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

        m1_df = self._mt5_client.get_recent_m1_candles(
            self._settings.mt5_symbol,
            self._settings.seed_candle_count,
        ).sort_values("time")
        if len(m1_df) < 2:
            raise RuntimeError("Not enough M1 candles to start")

        last_candle = m1_df.iloc[-1].to_dict()
        seed_df = m1_df.iloc[:-1].copy()

        engine = RollingSignalEngineMTF(window_size=self._settings.signal_window_size)
        engine.seed_from_m1(seed_df)

        m1_aggregator = OhlcCandleAggregator(timeframe_seconds=60)
        m1_aggregator.prime_with_existing_candle(last_candle)
        s10_aggregator = OhlcCandleAggregator(timeframe_seconds=10)

        poll_interval = self._settings.mt5_tick_poll_interval_sec
        symbol = self._settings.mt5_symbol
        last_market_data_update = 0.0
        active_signal = await asyncio.to_thread(self._supabase_repository.get_latest_active_signal, symbol)

        while True:
            try:
                tick = self._mt5_client.get_latest_tick(symbol)
                now = time.monotonic()

                if now - last_market_data_update >= self._settings.market_data_throttle_sec:
                    await asyncio.to_thread(self._supabase_repository.upsert_market_tick, tick)
                    last_market_data_update = now

                finalized_s10 = s10_aggregator.update_from_tick(tick.timestamp, tick.mid)
                if finalized_s10 is not None:
                    engine.on_new_s10_candle(finalized_s10)

                if active_signal is not None:
                    resolution = self._check_signal_resolution(active_signal, tick.mid, tick.timestamp)
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

                finalized_m1 = m1_aggregator.update_from_tick(tick.timestamp, tick.mid)
                if finalized_m1 is None:
                    await asyncio.sleep(poll_interval)
                    continue

                engine.on_new_m1_candle(finalized_m1)
                if active_signal is not None:
                    await asyncio.sleep(poll_interval)
                    continue

                signal_context = engine.evaluate()
                signal_value = int(signal_context["signal"])
                if signal_value == 0:
                    await asyncio.sleep(poll_interval)
                    continue

                new_signal = self._build_signal(signal_context, symbol, finalized_m1["time"])
                active_signal = await asyncio.to_thread(self._supabase_repository.insert_signal, new_signal)
                self._logger.info(
                    "New %s signal on %s at %.2f | tp=%.2f sl=%.2f confidence=%.2f",
                    active_signal.type,
                    active_signal.symbol,
                    active_signal.entry_price,
                    active_signal.tp,
                    active_signal.sl,
                    active_signal.confidence,
                )
                await asyncio.sleep(poll_interval)

            except Exception:
                self._logger.exception("PROD loop error")
                await asyncio.sleep(2.0)

    async def _run_backtest(self) -> None:
        self._logger.info("Starting BACKTEST mode with symbol=%s", self._settings.mt5_symbol)
        self._mt5_client.initialize()

        m1_df = self._mt5_client.get_recent_m1_candles(
            self._settings.mt5_symbol,
            self._settings.seed_candle_count,
        ).sort_values("time")
        if len(m1_df) < 3:
            raise RuntimeError("Not enough M1 candles for backtest")

        engine = RollingSignalEngineMTF(window_size=self._settings.signal_window_size)
        start_index = min(60, len(m1_df) - 2)
        engine.seed_from_m1(m1_df.iloc[:start_index].copy())

        rows: list[SignalRow] = []
        symbol = self._settings.mt5_symbol

        for index in range(start_index, len(m1_df) - 1):
            candle = m1_df.iloc[index].to_dict()
            next_close = float(m1_df.iloc[index + 1]["close"])

            engine.on_new_m1_candle(candle)
            signal_context = engine.evaluate()
            signal_value = int(signal_context["signal"])
            if signal_value == 0:
                continue

            simulated_signal = self._build_signal(signal_context, symbol, str(candle["time"]))
            result_pips = self._calculate_result_pips(
                simulated_signal.type,
                simulated_signal.entry_price,
                next_close,
            )

            rows.append(
                SignalRow(
                    candle_time=str(candle["time"]),
                    symbol=symbol,
                    type=simulated_signal.type,
                    status="CLOSED",
                    reason=str(signal_context["reason"]),
                    confidence=float(signal_context["confidence"]),
                    entry_price=simulated_signal.entry_price,
                    exit_price=next_close,
                    regime=str(signal_context["regime"]),
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
        signal_type = "Buy" if int(signal_context["signal"]) == 1 else "Sell"
        entry_price = round(float(signal_context["price"]), self._settings.price_decimals)
        atr = max(float(signal_context.get("atr") or 0.0), self._settings.pip_size * 40)
        stop_distance = atr * self._settings.signal_sl_atr_multiplier
        take_distance = atr * self._settings.signal_tp_atr_multiplier

        if signal_type == "Buy":
            tp = round(entry_price + take_distance, self._settings.price_decimals)
            sl = round(entry_price - stop_distance, self._settings.price_decimals)
        else:
            tp = round(entry_price - take_distance, self._settings.price_decimals)
            sl = round(entry_price + stop_distance, self._settings.price_decimals)

        signal_timestamp = self._parse_iso(candle_time)
        expires_at = signal_timestamp + dt.timedelta(minutes=self._settings.signal_expiry_minutes)

        return SignalPosition(
            id=None,
            symbol=symbol,
            type=signal_type,
            entry_price=entry_price,
            tp=tp,
            sl=sl,
            status="ACTIVE",
            timestamp=signal_timestamp.isoformat(),
            expires_at=expires_at.isoformat(),
            confidence=float(signal_context["confidence"]),
            timeframe="M1",
            strategy_version="smart-signals-v2",
            reason=str(signal_context["reason"]),
            indicator_snapshot={
                "zscore": float(signal_context.get("zscore") or 0.0),
                "rsi": float(signal_context.get("rsi") or 0.0),
                "kalman": float(signal_context.get("kalman") or 0.0),
                "atr": float(signal_context.get("atr") or 0.0),
                "adx": float(signal_context.get("adx") or 0.0),
            },
            metadata={
                "regime": signal_context.get("regime"),
                "score_long": signal_context.get("score_long"),
                "score_short": signal_context.get("score_short"),
                "m5_ema_fast": signal_context.get("m5_ema_fast"),
                "m5_ema_slow": signal_context.get("m5_ema_slow"),
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
                return self._build_resolution(signal, "CLOSED", signal.tp, "take_profit", tick_time)
            if market_price <= signal.sl:
                return self._build_resolution(signal, "CLOSED", signal.sl, "stop_loss", tick_time)
        else:
            if market_price <= signal.tp:
                return self._build_resolution(signal, "CLOSED", signal.tp, "take_profit", tick_time)
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
                    "regime",
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
                        row.regime,
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
    def _parse_iso(value: str) -> dt.datetime:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
