import asyncio

from src.config.settings import load_settings
from src.services.bot_runner import BotRunner
from src.utils.logger import setup_logger


async def run_bot() -> None:
    settings = load_settings()
    logger = setup_logger(settings.log_level)
    runner = BotRunner(settings=settings, logger=logger)
    await runner.run()


if __name__ == "__main__":
    asyncio.run(run_bot())
