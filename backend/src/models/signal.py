from __future__ import annotations

from dataclasses import dataclass, field
import datetime as dt
from typing import Any


@dataclass(frozen=True)
class SignalPosition:
    id: str | None
    symbol: str
    type: str
    entry_price: float
    tp: float
    sl: float
    status: str
    timestamp: str
    expires_at: str
    confidence: float
    timeframe: str
    strategy_version: str
    reason: str
    indicator_snapshot: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    exit_price: float | None = None
    result_pips: float | None = None
    close_reason: str | None = None
    closed_at: str | None = None

    @property
    def expires_at_dt(self) -> dt.datetime:
        return self._parse_iso(self.expires_at)

    def to_insert_payload(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "type": self.type,
            "entry_price": self.entry_price,
            "tp": self.tp,
            "sl": self.sl,
            "status": self.status,
            "timestamp": self.timestamp,
            "expires_at": self.expires_at,
            "confidence": self.confidence,
            "timeframe": self.timeframe,
            "strategy_version": self.strategy_version,
            "reason": self.reason,
            "indicator_snapshot": self.indicator_snapshot,
            "metadata": self.metadata,
        }

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "SignalPosition":
        return cls(
            id=str(record.get("id")) if record.get("id") is not None else None,
            symbol=str(record["symbol"]),
            type=str(record["type"]),
            entry_price=float(record["entry_price"]),
            tp=float(record["tp"]),
            sl=float(record["sl"]),
            status=str(record["status"]),
            timestamp=str(record["timestamp"]),
            expires_at=str(record.get("expires_at") or record["timestamp"]),
            confidence=float(record.get("confidence") or 0.0),
            timeframe=str(record.get("timeframe") or "M1"),
            strategy_version=str(record.get("strategy_version") or "smart-signals-v2"),
            reason=str(record.get("reason") or "signal_generated"),
            indicator_snapshot=dict(record.get("indicator_snapshot") or {}),
            metadata=dict(record.get("metadata") or {}),
            exit_price=float(record["exit_price"]) if record.get("exit_price") is not None else None,
            result_pips=float(record["result_pips"]) if record.get("result_pips") is not None else None,
            close_reason=str(record["close_reason"]) if record.get("close_reason") is not None else None,
            closed_at=str(record["closed_at"]) if record.get("closed_at") is not None else None,
        )

    @staticmethod
    def _parse_iso(value: str) -> dt.datetime:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
