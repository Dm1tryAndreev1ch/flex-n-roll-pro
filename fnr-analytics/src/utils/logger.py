"""
Настройка логирования для FNR Sales Analytics.
"""

import logging
import sys
from pathlib import Path

_configured = False


def setup_logger(name: str = "fnr-analytics") -> logging.Logger:
    """
    Создаёт и настраивает логгер с выводом в консоль и файл.

    Args:
        name: Имя логгера.

    Returns:
        Настроенный экземпляр Logger.
    """
    global _configured

    logger = logging.getLogger(name)

    if _configured:
        return logger

    # Импортируем настройки здесь, чтобы избежать циклических зависимостей
    from config.settings import LOG_LEVEL, PROJECT_ROOT

    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

    # Формат логов
    formatter = logging.Formatter(
        fmt="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Консольный хендлер
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Файловый хендлер
    log_dir = PROJECT_ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "analytics.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    _configured = True
    return logger


def get_logger(module_name: str) -> logging.Logger:
    """
    Получить дочерний логгер для модуля.

    Args:
        module_name: Имя модуля (например, 'data.loader').

    Returns:
        Дочерний экземпляр Logger.
    """
    parent = setup_logger()
    return parent.getChild(module_name)
