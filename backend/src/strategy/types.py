from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SessionContext:
    name: str
    execution_enabled: bool
    mode: str
    local_time: str


@dataclass(frozen=True)
class DxyContext:
    symbol: str
    bias: str
    price: float
    ema200: float
    ema_slope: float
    blocks_longs: bool


@dataclass(frozen=True)
class BiasContext:
    side: str
    trend_state: str
    price: float
    ema200: float
    ema_slope: float
    kumo_top: float
    kumo_bottom: float
    tenkan: float
    kijun: float
    atr14: float
    bias_score: int
    bias_age_bars: int
    distance_to_ema_atr: float
    overextended: bool
    soft_overextended: bool
    session_name: str
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class LiquidityLevel:
    direction: str
    price: float
    swing_time: str
    label: str


@dataclass(frozen=True)
class SweepState:
    direction: str
    reference_level: float
    swing_time: str
    sweep_time: str
    sweep_extreme: float
    stop_anchor: float
    reclaim_time: str | None = None
    candles_waited: int = 0
    liquidity_cleared: bool = False


@dataclass(frozen=True)
class ExecutionSetup:
    signal: int
    type: str
    entry_price: float
    sl: float
    tp1: float
    tp2: float | None
    reason: str
    confidence: float
    indicator_snapshot: dict[str, float | str]
    metadata: dict[str, float | str | bool | None] = field(default_factory=dict)
