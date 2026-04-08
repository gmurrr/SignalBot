from dataclasses import dataclass


@dataclass(frozen=True)
class Tick:
    symbol: str
    bid: float
    ask: float
    mid: float
    timestamp: str
