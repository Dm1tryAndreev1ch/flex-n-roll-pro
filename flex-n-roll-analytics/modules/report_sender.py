"""
report_sender.py — Формирование и отправка сводных отчётов в Битрикс24.

Возможности:
  - Ежедневный дайджест прогнозов сделок
  - Еженедельный cross-sell отчёт
  - Ежедневный churn-отчёт
  - Публикация в живую ленту или сохранение локально
  - Отчёт о переобучении моделей
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import config
from modules.bitrix_client import BitrixClient
from modules.deal_predictor import PredictionResult
from modules.cross_sell import CrossSellRecommendation
from modules.churn_detector import ChurnResult, RISK_HIGH, RISK_MEDIUM, RISK_LOW
from modules.contact_optimizer import ContactWindow

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def _format_predict_report(results: list[PredictionResult]) -> str:
    """Формирует текст дайджеста прогнозов сделок."""
    now_str = datetime.now().strftime("%d.%m.%Y")
    total   = len(results)

    high   = [r for r in results if r.probability_pct >= 70]
    medium = [r for r in results if 40 <= r.probability_pct < 70]
    low    = [r for r in results if r.probability_pct < 40]

    lines = [
        f"📊 [Прогноз закрытия сделок] {now_str}",
        f"Всего активных сделок: {total}",
        f"🟢 Высокая вероятность (≥70%): {len(high)}",
        f"🟡 Средняя (40–69%): {len(medium)}",
        f"🔴 Низкая (<40%): {len(low)}",
        "",
    ]

    if high:
        lines.append("▶ Топ-сделки для финализации:")
        for r in sorted(high, key=lambda x: -x.probability_pct)[:10]:
            factors = ", ".join(r.top_factors[:3])
            lines.append(f"  • Сделка #{r.deal_id}: {r.probability_pct}% [{factors}]")
        lines.append("")

    if low:
        lines.append("▶ Сделки под угрозой (требуют внимания):")
        for r in sorted(low, key=lambda x: x.probability_pct)[:10]:
            lines.append(f"  • Сделка #{r.deal_id}: {r.probability_pct}%")
        lines.append("")

    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_churn_report(results: list[ChurnResult]) -> str:
    """Формирует текст churn-отчёта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    high_list   = [r for r in results if r.churn_risk == RISK_HIGH]
    medium_list = [r for r in results if r.churn_risk == RISK_MEDIUM]

    lines = [
        f"🚨 [Churn Detection] {now_str}",
        f"HIGH риск: {len(high_list)} клиентов",
        f"MEDIUM риск: {len(medium_list)} клиентов",
        "",
    ]

    if high_list:
        lines.append("▶ КРИТИЧНО — требуют немедленного контакта:")
        for r in high_list[:15]:
            lines.append(
                f"  • {r.company_name} (#{r.company_id}): "
                f"{r.days_since_last_order} дней без заказа, "
                f"тренд {r.freq_trend_pct:+.0f}%, "
                f"ML-score {r.ml_churn_probability:.0%}"
            )
        lines.append("")

    if medium_list:
        lines.append("▶ ВНИМАНИЕ — средний риск:")
        for r in medium_list[:10]:
            lines.append(
                f"  • {r.company_name} (#{r.company_id}): "
                f"{r.days_since_last_order} дней без заказа"
            )
        lines.append("")

    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_crosssell_report(results: list[CrossSellRecommendation]) -> str:
    """Формирует текст cross-sell отчёта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    lines = [
        f"🛒 [Cross-Sell Рекомендации] {now_str}",
        f"Сгенерировано рекомендаций: {len(results)}",
        f"Задач менеджерам создано: {sum(1 for r in results if r.task_created)}",
        "",
    ]

    for r in results[:20]:
        rec_str = ", ".join(r.recommended_products[:3])
        lines.append(
            f"  • Компания #{r.company_id} (сделка #{r.deal_id}): "
            f"→ {rec_str} (conf {r.confidence:.0%})"
        )

    lines.append("")
    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_contact_report(results: list[ContactWindow]) -> str:
    """Формирует краткий отчёт об оптимальных временах контакта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    lines = [
        f"🕐 [Оптимальное время контакта] {now_str}",
        f"Обработано компаний: {len(results)}",
        "",
    ]
    for r in results[:15]:
        conf_str = f"{r.confidence:.0%}" if r.confidence > 0 else "нет данных"
        lines.append(
            f"  • Компания #{r.company_id}: {r.time_label} (уверенность: {conf_str})"
        )

    lines.append("")
    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


class ReportSender:
    """Отправляет сводные отчёты в Битрикс24 и сохраняет локальные копии."""

    def __init__(self, client: BitrixClient):
        self.client = client

    def _save_local(self, filename: str, text: str, data: Any = None) -> Path:
        """Сохраняет текстовый отчёт и (опционально) JSON-данные локально."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        txt_path = REPORTS_DIR / f"{ts}_{filename}.txt"
        txt_path.write_text(text, encoding="utf-8")

        if data is not None:
            json_path = REPORTS_DIR / f"{ts}_{filename}.json"
            json_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
            logger.debug("Отчёт (JSON) сохранён: %s", json_path)

        logger.debug("Отчёт (TXT) сохранён: %s", txt_path)
        return txt_path

    def _send_to_feed(self, message: str) -> bool:
        """Публикует в живую ленту если настроен group_id."""
        if config.REPORT_GROUP_ID > 0:
            return self.client.post_to_feed(message, group_id=config.REPORT_GROUP_ID)
        return False

    def send_predict_report(self, results: list[PredictionResult]) -> bool:
        if not results:
            return False
        text = _format_predict_report(results)
        self._save_local("predict_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Отчёт по прогнозам %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_churn_report(self, results: list[ChurnResult]) -> bool:
        if not results:
            return False
        text = _format_churn_report(results)
        self._save_local("churn_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Churn отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_crosssell_report(self, results: list[CrossSellRecommendation]) -> bool:
        if not results:
            return False
        text = _format_crosssell_report(results)
        self._save_local("crosssell_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Cross-sell отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_contact_report(self, results: list[ContactWindow]) -> bool:
        if not results:
            return False
        text = _format_contact_report(results)
        self._save_local("contact_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Contact отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_retrain_summary(self, metrics: dict) -> bool:
        """Уведомляет об итогах ежемесячного переобучения моделей."""
        lines = [
            f"🤖 [Переобучение моделей] {datetime.now().strftime('%d.%m.%Y')}",
            "",
        ]
        for model_name, m in metrics.items():
            lines.append(f"▶ {model_name}:")
            for k, v in m.items():
                lines.append(f"  {k}: {v}")
            lines.append("")

        lines.append("Источник: AI-аналитика FLEX-N-ROLL PRO")
        text = "\n".join(lines)

        self._save_local("retrain_summary", text, metrics)
        ok = self._send_to_feed(text)
        logger.info("Отчёт о переобучении %s", "отправлен" if ok else "сохранён локально")
        return ok
