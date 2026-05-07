from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo

from src.config.settings import Settings


@dataclass
class SignalFilterState:
    cooldown_until: dt.datetime | None = None
    seen_research_day_side_keys: set[str] = field(default_factory=set)
    seen_research_reference_keys: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class SignalFilterOptions:
    require_execution_session: bool
    include_research_signals: bool
    min_confidence: float
    cooldown_minutes: int


class SignalFilterPipeline:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._timezone = ZoneInfo(settings.trading_timezone)

    @staticmethod
    def signal_grade(signal_context: dict[str, Any]) -> str:
        metadata = dict(signal_context.get("metadata") or {})
        if bool(metadata.get("relaxed_m5_liquidity") or False):
            return "RESEARCH_M5"
        if str(metadata.get("execution_profile") or "").upper() == "RELAXED":
            return "RELAXED"
        return "STRICT"

    def apply(
        self,
        signal_context: dict[str, Any],
        *,
        current_time: dt.datetime,
        state: SignalFilterState,
        options: SignalFilterOptions,
    ) -> dict[str, Any]:
        if int(signal_context.get("signal") or 0) == 0:
            return signal_context

        signal_grade = self.signal_grade(signal_context)

        if options.require_execution_session and signal_context.get("execution_mode") != "EXECUTION":
            return self._reject(signal_context, "backtest_session_filter")

        if not options.include_research_signals and signal_grade == "RESEARCH_M5":
            return self._reject(signal_context, "research_signal_excluded")

        if signal_grade == "RESEARCH_M5":
            filtered = self._apply_research_filters(signal_context, current_time=current_time, state=state)
            if int(filtered.get("signal") or 0) == 0:
                return filtered

        confidence = float(signal_context.get("confidence") or 0.0)
        if confidence < options.min_confidence:
            return self._reject(signal_context, "below_confidence_threshold")

        if state.cooldown_until is not None and current_time < state.cooldown_until:
            return self._reject(signal_context, "backtest_cooldown")

        return signal_context

    def register_acceptance(
        self,
        signal_context: dict[str, Any],
        *,
        current_time: dt.datetime,
        state: SignalFilterState,
        options: SignalFilterOptions,
    ) -> None:
        if int(signal_context.get("signal") or 0) == 0:
            return

        signal_grade = self.signal_grade(signal_context)
        if signal_grade == "RESEARCH_M5":
            day_side_key = self._build_day_side_key(signal_context, current_time=current_time)
            reference_key = self._build_reference_key(signal_context)
            if day_side_key is not None:
                state.seen_research_day_side_keys.add(day_side_key)
            if reference_key is not None:
                state.seen_research_reference_keys.add(reference_key)

        state.cooldown_until = current_time + dt.timedelta(minutes=options.cooldown_minutes)

    def _apply_research_filters(
        self,
        signal_context: dict[str, Any],
        *,
        current_time: dt.datetime,
        state: SignalFilterState,
    ) -> dict[str, Any]:
        signal_type = str(signal_context.get("type") or "").strip()
        dxy_bias = str(signal_context.get("dxy_bias") or "").strip()
        if (
            self._settings.backtest_research_block_buy_with_bullish_dxy
            and signal_type == "Buy"
            and dxy_bias == "BULLISH_DXY"
        ):
            return self._reject(signal_context, "research_dxy_long_blocked")
        if (
            self._settings.backtest_research_block_buy_with_unavailable_dxy
            and signal_type == "Buy"
            and dxy_bias == "UNAVAILABLE"
        ):
            return self._reject(signal_context, "research_dxy_unavailable_blocked")

        bias_age_bars = int(signal_context.get("bias_age_bars") or 0)
        if (
            self._settings.backtest_research_min_bias_age_bars > 0
            and bias_age_bars < self._settings.backtest_research_min_bias_age_bars
        ):
            return self._reject(signal_context, "research_bias_too_fresh")
        if (
            self._settings.backtest_research_max_bias_age_bars > 0
            and bias_age_bars > self._settings.backtest_research_max_bias_age_bars
        ):
            return self._reject(signal_context, "research_bias_too_old")

        distance_to_ema_atr = float(signal_context.get("distance_to_ema_atr") or 0.0)
        if (
            self._settings.backtest_research_min_distance_to_ema_atr > 0
            and distance_to_ema_atr < self._settings.backtest_research_min_distance_to_ema_atr
        ):
            return self._reject(signal_context, "research_too_close_to_ema")

        if self._settings.backtest_research_first_per_day_side:
            day_side_key = self._build_day_side_key(signal_context, current_time=current_time)
            if day_side_key is not None and day_side_key in state.seen_research_day_side_keys:
                return self._reject(signal_context, "research_day_side_reentry")

        if self._settings.backtest_research_first_per_reference:
            reference_key = self._build_reference_key(signal_context)
            if reference_key is not None and reference_key in state.seen_research_reference_keys:
                return self._reject(signal_context, "research_reference_reentry")

        return signal_context

    def _build_reference_key(self, signal_context: dict[str, Any]) -> str | None:
        signal_type = str(signal_context.get("type") or "").strip()
        session_name = str(signal_context.get("session_name") or "").strip()
        reference_liquidity = signal_context.get("reference_liquidity")
        metadata = dict(signal_context.get("metadata") or {})
        session_local_time = str(metadata.get("session_local_time") or "").strip()

        if not signal_type or not session_name or reference_liquidity is None or not session_local_time:
            return None

        session_date = session_local_time[:10]
        reference_key = f"{float(reference_liquidity):.{self._settings.price_decimals}f}"
        return f"{session_date}|{session_name}|{signal_type}|{reference_key}"

    def _build_day_side_key(
        self,
        signal_context: dict[str, Any],
        *,
        current_time: dt.datetime,
    ) -> str | None:
        signal_type = str(signal_context.get("type") or "").strip()
        if not signal_type:
            return None

        local_date = current_time.astimezone(self._timezone).date().isoformat()
        return f"{local_date}|{signal_type}"

    @staticmethod
    def _reject(signal_context: dict[str, Any], reason: str) -> dict[str, Any]:
        rejected = dict(signal_context)
        metadata = dict(rejected.get("metadata") or {})
        metadata["original_reason"] = rejected.get("reason")
        rejected["metadata"] = metadata
        rejected["signal"] = 0
        rejected["reason"] = reason
        return rejected
