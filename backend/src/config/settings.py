from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    app_mode: str
    mt5_symbol: str
    dxy_symbol: str
    mt5_login: str | None
    mt5_password: str | None
    mt5_server: str | None
    mt5_tick_poll_interval_sec: float
    market_data_throttle_sec: float
    backtest_csv_path: str
    backtest_diagnostics_csv_path: str
    backtest_profile: str
    backtest_min_confidence: float
    backtest_cooldown_minutes: int
    backtest_require_execution_session: bool
    market_data_table: str
    signals_table: str
    signal_window_size: int
    signal_expiry_minutes: int
    signal_tp_atr_multiplier: float
    signal_sl_atr_multiplier: float
    pip_size: float
    price_decimals: int
    seed_candle_count: int
    h1_seed_candle_count: int
    dxy_seed_h1_count: int
    trading_timezone: str
    log_level: str


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip().strip("\"'")
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _optional_env(name: str) -> str | None:
    value = os.getenv(name, "").strip().strip("\"'")
    return value if value else None


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name, "").strip().strip("\"'").lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "y", "on"}


def load_settings() -> Settings:
    app_mode = os.getenv("APP_MODE", "PROD").strip().upper()
    if app_mode not in {"PROD", "BACKTEST"}:
        raise ValueError("APP_MODE must be either PROD or BACKTEST")

    backtest_profile = os.getenv("BACKTEST_PROFILE", "RELAXED").strip().upper()
    if backtest_profile not in {"STRICT", "RELAXED"}:
        raise ValueError("BACKTEST_PROFILE must be either STRICT or RELAXED")

    return Settings(
        supabase_url=_required_env("SUPABASE_URL"),
        supabase_service_role_key=(
            _required_env("SUPABASE_SERVICE_ROLE_KEY")
            if app_mode == "PROD"
            else os.getenv("SUPABASE_SERVICE_ROLE_KEY", "backtest-mode").strip()
        ),
        app_mode=app_mode,
        mt5_symbol=os.getenv("MT5_SYMBOL", "XAUUSD").strip().strip("\"'"),
        dxy_symbol=os.getenv("DXY_SYMBOL", "DXY").strip().strip("\"'"),
        mt5_login=_optional_env("MT5_LOGIN"),
        mt5_password=_optional_env("MT5_PASSWORD"),
        mt5_server=_optional_env("MT5_SERVER"),
        mt5_tick_poll_interval_sec=float(os.getenv("MT5_TICK_POLL_INTERVAL_SEC", "0.2")),
        market_data_throttle_sec=float(os.getenv("MARKET_DATA_THROTTLE_SEC", "1.0")),
        backtest_csv_path=os.getenv("BACKTEST_CSV_PATH", "backtest_results.csv").strip().strip("\"'"),
        backtest_diagnostics_csv_path=os.getenv("BACKTEST_DIAGNOSTICS_CSV_PATH", "backtest_diagnostics.csv").strip().strip("\"'"),
        backtest_profile=backtest_profile,
        backtest_min_confidence=float(os.getenv("BACKTEST_MIN_CONFIDENCE", "0.70")),
        backtest_cooldown_minutes=int(os.getenv("BACKTEST_COOLDOWN_MINUTES", "20")),
        backtest_require_execution_session=_bool_env("BACKTEST_REQUIRE_EXECUTION_SESSION", True),
        market_data_table=os.getenv("MARKET_DATA_TABLE", "market_data").strip().strip("\"'"),
        signals_table=os.getenv("SIGNALS_TABLE", "signals").strip().strip("\"'"),
        signal_window_size=int(os.getenv("SIGNAL_WINDOW_SIZE", "360")),
        signal_expiry_minutes=int(os.getenv("SIGNAL_EXPIRY_MINUTES", "30")),
        signal_tp_atr_multiplier=float(os.getenv("SIGNAL_TP_ATR_MULTIPLIER", "1.8")),
        signal_sl_atr_multiplier=float(os.getenv("SIGNAL_SL_ATR_MULTIPLIER", "1.1")),
        pip_size=float(os.getenv("PIP_SIZE", "0.01")),
        price_decimals=int(os.getenv("PRICE_DECIMALS", "2")),
        seed_candle_count=int(os.getenv("SEED_CANDLE_COUNT", "400")),
        h1_seed_candle_count=int(os.getenv("H1_SEED_CANDLE_COUNT", "260")),
        dxy_seed_h1_count=int(os.getenv("DXY_SEED_H1_COUNT", "260")),
        trading_timezone=os.getenv("TRADING_TIMEZONE", "Europe/Warsaw").strip().strip("\"'"),
        log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
    )
