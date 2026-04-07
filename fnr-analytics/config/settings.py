"""
Конфигурация проекта FNR Sales Analytics.
Загружает переменные окружения из .env файла.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Загрузка .env из корня проекта
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


# === Битрикс24 ===
BITRIX24_WEBHOOK_URL: str = os.getenv("BITRIX24_WEBHOOK_URL", "")

# === Пути ===
DATA_CACHE_DIR: Path = Path(os.getenv("DATA_CACHE_DIR", PROJECT_ROOT / "data" / "cache"))
REPORTS_OUTPUT_DIR: Path = Path(os.getenv("REPORTS_OUTPUT_DIR", PROJECT_ROOT / "reports"))

# Создаем директории если не существуют
DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# === Параметры моделей ===
CHURN_THRESHOLD_DAYS: int = int(os.getenv("CHURN_THRESHOLD_DAYS", "90"))
FORECAST_MONTHS_AHEAD: int = int(os.getenv("FORECAST_MONTHS_AHEAD", "3"))

# === Логирование ===
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# === Битрикс24 API ===
BITRIX_BATCH_SIZE: int = 50
BITRIX_MAX_RETRIES: int = 3
BITRIX_RETRY_DELAY: float = 1.0

# === Кэш ===
CACHE_TTL_SECONDS: int = 3600  # 1 час

# === Стадии сделок ===
DEAL_STAGES = {
    "NEW": "Новая",
    "PREPARATION": "Подготовка",
    "PREPAYMENT_INVOICE": "Счёт на предоплату",
    "EXECUTING": "В работе",
    "FINAL_INVOICE": "Финальный счёт",
    "WON": "Успешная",
    "LOSE": "Проигранная",
    "APOLOGY": "Отказ",
}

# === Категории продукции ===
PRODUCT_CATEGORIES = {
    "визитк": "Визитки",
    "баннер": "Баннеры",
    "флаер": "Флаеры",
    "буклет": "Буклеты",
    "наклейк": "Наклейки",
    "стикер": "Стикеры",
    "плакат": "Плакаты",
    "постер": "Постеры",
    "каталог": "Каталоги",
    "календар": "Календари",
    "блокнот": "Блокноты",
    "упаковк": "Упаковка",
    "этикетк": "Этикетки",
    "вывеск": "Вывески",
    "штенд": "Штендеры",
    "roll-up": "Roll-Up",
    "ролл-ап": "Roll-Up",
    "wide": "Широкоформатная печать",
    "широкоформат": "Широкоформатная печать",
}
