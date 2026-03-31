"""
config.py — Централизованная конфигурация проекта FLEX-N-ROLL Analytics.
Параметры читаются из переменных окружения (файл .env).
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем .env из корня проекта
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")


# ---------------------------------------------------------------------------
# Битрикс24
# ---------------------------------------------------------------------------
BITRIX_WEBHOOK_URL: str = os.environ["BITRIX_WEBHOOK_URL"]
# Пример: https://yourcompany.bitrix24.ru/rest/1/abc123xyz/

# Таймаут HTTP-запросов к Б24, секунды
BITRIX_REQUEST_TIMEOUT: int = int(os.getenv("BITRIX_REQUEST_TIMEOUT", "30"))

# Размер страницы при пагинации (максимум 50 по API Б24)
BITRIX_PAGE_SIZE: int = 50

# Максимальное количество повторных попыток при ошибке сети
BITRIX_MAX_RETRIES: int = int(os.getenv("BITRIX_MAX_RETRIES", "3"))

# Задержка между повторными попытками, секунды
BITRIX_RETRY_DELAY: float = float(os.getenv("BITRIX_RETRY_DELAY", "2.0"))

# ---------------------------------------------------------------------------
# Кастомные поля сделок в Б24 (UF_CRM_*)
# ---------------------------------------------------------------------------
FIELD_WIN_PROBABILITY: str = os.getenv("FIELD_WIN_PROBABILITY", "UF_CRM_WIN_PROBABILITY")
FIELD_CHURN_RISK: str      = os.getenv("FIELD_CHURN_RISK",      "UF_CRM_CHURN_RISK")
FIELD_CROSS_SELL: str      = os.getenv("FIELD_CROSS_SELL",      "UF_CRM_CROSS_SELL")
FIELD_CONTACT_TIME: str    = os.getenv("FIELD_CONTACT_TIME",    "UF_CRM_BEST_CONTACT_TIME")

# ---------------------------------------------------------------------------
# Типы продуктов типографии (для one-hot и cross-sell)
# ---------------------------------------------------------------------------
PRODUCT_TYPES: list[str] = [
    "самоклейка",
    "термохром",
    "AR_этикетка",
    "DataMatrix",
    "sleeve",
    "гибридная_флексо_цифра",
    "флексопечать",
    "цифровая_печать",
    "офсет",
    "тиснение",
]

# Маппинг стадий сделки на порядковый номер (ordinal encoding)
STAGE_ORDER: dict[str, int] = {
    "NEW":           1,
    "PREPARATION":   2,
    "PREPAYMENT_INVOICE": 3,
    "EXECUTING":     4,
    "FINAL_INVOICE": 5,
    "WON":           6,   # успешно закрыта
    "LOSE":          0,   # проиграна
    "APOLOGY":       0,
}

# ---------------------------------------------------------------------------
# Сегменты клиентов
# ---------------------------------------------------------------------------
CUSTOMER_SEGMENTS: list[str] = ["A", "B", "C", "D"]  # A — самые ценные

# ---------------------------------------------------------------------------
# Churn-пороги
# ---------------------------------------------------------------------------
# Снижение частоты заказов за 6 мес., при котором присваивается HIGH risk
CHURN_HIGH_FREQ_DROP: float  = float(os.getenv("CHURN_HIGH_FREQ_DROP", "0.30"))
# Снижение частоты для MEDIUM risk
CHURN_MED_FREQ_DROP: float   = float(os.getenv("CHURN_MED_FREQ_DROP", "0.15"))
# Снижение среднего чека, при котором добавляется риск
CHURN_CHECK_DROP: float      = float(os.getenv("CHURN_CHECK_DROP", "0.20"))
# Дней без заказа для HIGH
CHURN_HIGH_DAYS_SILENT: int  = int(os.getenv("CHURN_HIGH_DAYS_SILENT", "180"))
# Дней без заказа для MEDIUM
CHURN_MED_DAYS_SILENT: int   = int(os.getenv("CHURN_MED_DAYS_SILENT", "90"))

# ---------------------------------------------------------------------------
# Планировщик
# ---------------------------------------------------------------------------
SCHEDULER_DAILY_PREDICT_TIME:  str = os.getenv("SCHEDULER_DAILY_PREDICT_TIME",  "07:00")
SCHEDULER_DAILY_CHURN_TIME:    str = os.getenv("SCHEDULER_DAILY_CHURN_TIME",    "08:00")
SCHEDULER_WEEKLY_CROSSSELL_DAY:str = os.getenv("SCHEDULER_WEEKLY_CROSSSELL_DAY","monday")
SCHEDULER_MONTHLY_RETRAIN_DAY: int = int(os.getenv("SCHEDULER_MONTHLY_RETRAIN_DAY", "1"))

# ---------------------------------------------------------------------------
# Пути к файлам моделей
# ---------------------------------------------------------------------------
MODELS_DIR: Path = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_DEAL_PREDICTOR: Path   = MODELS_DIR / "deal_predictor.pkl"
MODEL_CROSS_SELL: Path       = MODELS_DIR / "cross_sell_matrix.pkl"
MODEL_CHURN: Path            = MODELS_DIR / "churn_detector.pkl"
MODEL_CONTACT_OPT: Path      = MODELS_DIR / "contact_optimizer.pkl"

# ---------------------------------------------------------------------------
# Кэш
# ---------------------------------------------------------------------------
# Использовать Redis если доступен, иначе файловый fallback
USE_REDIS: bool      = os.getenv("USE_REDIS", "false").lower() == "true"
REDIS_URL: str       = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 час

CACHE_DIR: Path = BASE_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Логирование
# ---------------------------------------------------------------------------
LOG_LEVEL: str  = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE: Path  = BASE_DIR / "logs" / "analytics.log"
LOG_FILE.parent.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Отчёты / уведомления
# ---------------------------------------------------------------------------
# ID ответственного пользователя в Б24 (для постановки задач)
DEFAULT_RESPONSIBLE_ID: int = int(os.getenv("DEFAULT_RESPONSIBLE_ID", "1"))

# Группа Б24 для публикации сводного отчёта (0 = не публиковать)
REPORT_GROUP_ID: int = int(os.getenv("REPORT_GROUP_ID", "0"))
