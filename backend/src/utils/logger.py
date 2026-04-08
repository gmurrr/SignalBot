import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logger(level: str = "INFO") -> logging.Logger:
    logs_dir = Path(__file__).resolve().parents[2] / "logs"
    logs_dir.mkdir(exist_ok=True)

    logger = logging.getLogger("signalbot")
    logger.setLevel(level)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    file_handler = RotatingFileHandler(
        logs_dir / "bot.log",
        maxBytes=2_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.propagate = False

    return logger
