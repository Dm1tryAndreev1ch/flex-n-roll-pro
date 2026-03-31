"""
main.py — Точка входа и планировщик задач FLEX-N-ROLL Analytics.

Расписание:
  - Ежедневно 07:00  → Прогноз закрытия сделок
  - Ежедневно 08:00  → Churn detection
  - Ежедневно 09:00  → Оптимальное время контакта
  - Еженедельно Пн   → Cross-sell рекомендации
  - Ежемесячно 1-е   → Полное переобучение всех моделей
"""

import logging
import logging.handlers
import sys
import time
from datetime import datetime
from pathlib import Path

import schedule

import config


def _setup_logging() -> None:
    """Настраивает форматированное логирование в файл и консоль."""
    try:
        from colorlog import ColoredFormatter
        console_fmt = ColoredFormatter(
            "%(log_color)s%(asctime)s [%(levelname)-8s] %(name)s: %(message)s%(reset)s",
            datefmt="%H:%M:%S",
            log_colors={
                "DEBUG":    "cyan",
                "INFO":     "green",
                "WARNING":  "yellow",
                "ERROR":    "red",
                "CRITICAL": "bold_red",
            },
        )
    except ImportError:
        console_fmt = logging.Formatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )

    file_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(config.LOG_LEVEL)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_fmt)
    root.addHandler(console_handler)

    # Ротируемый файл (10 МБ × 5 файлов)
    file_handler = logging.handlers.RotatingFileHandler(
        config.LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(file_fmt)
    root.addHandler(file_handler)


logger = logging.getLogger(__name__)


def _init_components():
    """Создаёт все компоненты аналитики."""
    from modules.bitrix_client import BitrixClient
    from modules.deal_predictor import DealPredictor
    from modules.cross_sell import CrossSellEngine
    from modules.churn_detector import ChurnDetector
    from modules.contact_optimizer import ContactOptimizer
    from modules.report_sender import ReportSender

    client    = BitrixClient()
    predictor = DealPredictor(client)
    cross_sell = CrossSellEngine(client)
    churn     = ChurnDetector(client)
    optimizer = ContactOptimizer(client)
    reporter  = ReportSender(client)

    return client, predictor, cross_sell, churn, optimizer, reporter


# ---------------------------------------------------------------------------
# Задачи планировщика
# ---------------------------------------------------------------------------

def job_predict_deals(predictor, reporter) -> None:
    """Ежедневно 07:00 — прогноз вероятности закрытия сделок."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Прогноз закрытия сделок [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if predictor.model is None:
            logger.info("Модель не найдена. Запускаем начальное обучение...")
            metrics = predictor.train()
            logger.info("Обучение завершено: %s", metrics)
        results = predictor.predict_and_update()
        reporter.send_predict_report(results)
        logger.info("Прогноз завершён: %d сделок", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_predict_deals: %s", exc, exc_info=True)


def job_churn_detection(churn, reporter) -> None:
    """Ежедневно 08:00 — проверка churn-риска."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Churn Detection [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if churn.model is None:
            logger.info("Churn модель не найдена. Запускаем обучение...")
            metrics = churn.train()
            logger.info("Обучение churn: %s", metrics)
        results = churn.detect_and_update()
        reporter.send_churn_report(results)
        high_count = sum(1 for r in results if r.churn_risk == "HIGH")
        logger.info("Churn detection завершён: всего=%d, HIGH=%d", len(results), high_count)
    except Exception as exc:
        logger.error("ОШИБКА в job_churn_detection: %s", exc, exc_info=True)


def job_contact_optimizer(optimizer, reporter) -> None:
    """Ежедневно 09:00 — обновление оптимального времени контакта."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Contact Optimizer [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        results = optimizer.optimize_and_update()
        reporter.send_contact_report(results)
        logger.info("Contact optimizer завершён: %d компаний", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_contact_optimizer: %s", exc, exc_info=True)


def job_cross_sell(cross_sell, reporter) -> None:
    """Еженедельно в понедельник — cross-sell рекомендации."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Cross-Sell Рекомендации [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if cross_sell.rules is None:
            logger.info("Cross-sell модель не найдена. Запускаем обучение...")
            metrics = cross_sell.train()
            logger.info("Cross-sell обучен: %s", metrics)
        results = cross_sell.recommend_and_create_tasks()
        reporter.send_crosssell_report(results)
        logger.info("Cross-sell завершён: %d рекомендаций", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_cross_sell: %s", exc, exc_info=True)


def job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter) -> None:
    """Ежемесячно 1-е число — полное переобучение всех моделей."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Полное переобучение моделей [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)

    client.invalidate_cache()  # Сброс кэша для получения свежих данных
    all_metrics: dict = {}

    for name, fn, kwargs in [
        ("DealPredictor",    predictor.train,   {"days_back": 365}),
        ("ChurnDetector",    churn.train,        {"days_back": 730}),
        ("CrossSell",        cross_sell.train,   {"days_back": 730}),
        ("ContactOptimizer", optimizer.fit,      {"days_back": 365}),
    ]:
        try:
            logger.info("Переобучение %s...", name)
            m = fn(**kwargs)
            all_metrics[name] = m
            logger.info("%s: %s", name, m)
        except Exception as exc:
            logger.error("Ошибка переобучения %s: %s", name, exc, exc_info=True)
            all_metrics[name] = {"error": str(exc)}

    reporter.send_retrain_summary(all_metrics)
    logger.info("Переобучение завершено. Итоги: %s", all_metrics)


# ---------------------------------------------------------------------------
# Точка входа
# ---------------------------------------------------------------------------

def main() -> None:
    """Запускает планировщик задач аналитики."""
    _setup_logging()

    logger.info("╔══════════════════════════════════════════════════════╗")
    logger.info("║       FLEX-N-ROLL Analytics — запуск планировщика   ║")
    logger.info("╚══════════════════════════════════════════════════════╝")
    logger.info("Webhook: %s***", config.BITRIX_WEBHOOK_URL[:30])

    client, predictor, cross_sell, churn, optimizer, reporter = _init_components()

    # Регистрируем ежедневные задачи
    schedule.every().day.at(config.SCHEDULER_DAILY_PREDICT_TIME).do(
        job_predict_deals, predictor=predictor, reporter=reporter
    )
    schedule.every().day.at(config.SCHEDULER_DAILY_CHURN_TIME).do(
        job_churn_detection, churn=churn, reporter=reporter
    )
    schedule.every().day.at("09:00").do(
        job_contact_optimizer, optimizer=optimizer, reporter=reporter
    )

    # Еженедельная задача (понедельник)
    schedule.every().monday.at("10:00").do(
        job_cross_sell, cross_sell=cross_sell, reporter=reporter
    )

    # Ежемесячная задача — schedule не поддерживает напрямую,
    # проверяем через ежедневную задачу в 03:00
    def _monthly_check():
        if datetime.now().day == config.SCHEDULER_MONTHLY_RETRAIN_DAY:
            job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter)

    schedule.every().day.at("03:00").do(_monthly_check)

    # Первичное обучение если модели отсутствуют
    if predictor.model is None or churn.model is None:
        logger.info("Необученные модели — запуск первичного обучения...")
        job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter)

    logger.info("Планировщик запущен. Зарегистрировано задач: %d", len(schedule.get_jobs()))
    logger.info("Ожидание (Ctrl+C для остановки)...")

    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        logger.info("Получен сигнал остановки. Выход.")
    except Exception as exc:
        logger.critical("Критическая ошибка в главном цикле: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
