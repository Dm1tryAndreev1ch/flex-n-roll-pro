"""
contact_optimizer.py — Определение оптимального времени контакта с клиентом.

Алгоритм:
  1. Получаем историю активностей из Б24 (звонки, письма)
  2. Фильтруем: только успешные (DIRECTION=1 или COMPLETED=Y)
  3. Для каждого клиента строим тепловую карту (7 дней × 24 часа)
  4. Топ-1 ячейка = оптимальное время
  5. Записываем в UF_CRM_BEST_CONTACT_TIME сделки

Типы активностей Б24:
  2 = Звонок | 3 = Email | 6 = Письмо
"""

import logging
from datetime import datetime
from typing import NamedTuple

import numpy as np
import pandas as pd
import joblib

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

RELEVANT_ACTIVITY_TYPES = {2, 3, 6}
DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


class ContactWindow(NamedTuple):
    company_id: int
    deal_id: int
    day_of_week: int
    day_name: str
    hour: int
    time_label: str
    confidence: float
    total_contacts: int
    written_to_b24: bool


def _parse_activity_datetime(activity: dict) -> datetime | None:
    """Парсит дату/время активности из поля CREATED."""
    raw = activity.get("CREATED") or activity.get("DEADLINE") or ""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def _is_successful_activity(activity: dict) -> bool:
    """Успешная активность: входящий контакт (DIRECTION=1) или COMPLETED=Y."""
    direction = str(activity.get("DIRECTION", "")).strip()
    completed = str(activity.get("COMPLETED", "")).strip().upper()
    return direction == "1" or completed == "Y"


def _build_contact_heatmap(activities: list[dict], owner_id: int) -> np.ndarray | None:
    """
    Строит тепловую карту 7×24 для конкретного владельца (сделки).

    :return: Матрица 7×24 или None если нет данных
    """
    heatmap = np.zeros((7, 24), dtype=int)
    count = 0

    for act in activities:
        try:
            act_owner = int(act.get("OWNER_ID", 0))
        except (ValueError, TypeError):
            act_owner = 0

        if act_owner != owner_id:
            continue

        try:
            act_type = int(act.get("TYPE_ID", 0))
        except (ValueError, TypeError):
            act_type = 0

        if act_type not in RELEVANT_ACTIVITY_TYPES:
            continue

        if not _is_successful_activity(act):
            continue

        dt = _parse_activity_datetime(act)
        if dt is None:
            continue

        heatmap[dt.weekday(), dt.hour] += 1
        count += 1

    return heatmap if count > 0 else None


def _find_best_window(heatmap: np.ndarray) -> tuple[int, int, float]:
    """
    Находит день + час с максимальной активностью.

    :return: (day_of_week, hour, confidence)
    """
    total = heatmap.sum()
    if total == 0:
        return 2, 10, 0.0  # дефолт: среда 10:00

    best_flat = int(np.argmax(heatmap))
    best_day  = best_flat // 24
    best_hour = best_flat % 24
    confidence = float(heatmap[best_day, best_hour]) / float(total)
    return best_day, best_hour, confidence


class ContactOptimizer:
    """
    Определяет оптимальное время контакта с клиентом
    на основе истории активностей в Б24.
    """

    def __init__(self, client: BitrixClient):
        self.client = client
        self._contact_windows: dict[int, tuple[int, int, float]] = {}
        self._load_model()

    def _save_model(self) -> None:
        joblib.dump(self._contact_windows, config.MODEL_CONTACT_OPT)
        logger.info("Модель contact_optimizer сохранена: %d записей", len(self._contact_windows))

    def _load_model(self) -> None:
        if config.MODEL_CONTACT_OPT.exists():
            try:
                self._contact_windows = joblib.load(config.MODEL_CONTACT_OPT)
                logger.info(
                    "Модель contact_optimizer загружена: %d компаний",
                    len(self._contact_windows),
                )
            except Exception as exc:
                logger.warning("Не удалось загрузить contact_optimizer: %s", exc)
                self._contact_windows = {}

    def fit(self, days_back: int = 365) -> dict:
        """
        Строит оптимальные окна контакта по истории активностей.

        :param days_back: Глубина истории
        :return: Статистика
        """
        logger.info("ContactOptimizer.fit() — анализ %d дней истории...", days_back)

        active_deals = self.client.get_active_deals()
        activities   = self.client.get_activities(days_back=days_back)

        deal_to_company: dict[int, int] = {
            int(deal["ID"]): int(deal.get("COMPANY_ID") or 0)
            for deal in active_deals
        }

        company_heatmaps: dict[int, np.ndarray] = {}

        for deal in active_deals:
            did = int(deal["ID"])
            cid = deal_to_company.get(did, 0)
            if cid == 0:
                continue

            heatmap = _build_contact_heatmap(activities, owner_id=did)
            if heatmap is None:
                continue

            if cid not in company_heatmaps:
                company_heatmaps[cid] = np.zeros((7, 24), dtype=int)
            company_heatmaps[cid] += heatmap

        self._contact_windows = {}
        for cid, heatmap in company_heatmaps.items():
            day, hour, conf = _find_best_window(heatmap)
            self._contact_windows[cid] = (day, hour, conf)

        self._save_model()

        logger.info(
            "ContactOptimizer.fit() завершён: %d компаний обработано",
            len(self._contact_windows),
        )
        return {
            "companies_analyzed": len(self._contact_windows),
            "activities_used": len(activities),
        }

    def optimize_and_update(self) -> list[ContactWindow]:
        """
        Обновляет поля оптимального контакта для всех активных сделок.

        :return: Список результатов
        """
        logger.info("Запуск ContactOptimizer.optimize_and_update()...")

        self.fit(days_back=365)

        active_deals = self.client.get_active_deals()
        results: list[ContactWindow] = []
        processed: set[int] = set()

        for deal in active_deals:
            deal_id = int(deal["ID"])
            cid     = int(deal.get("COMPANY_ID") or 0)

            if cid in processed:
                continue
            processed.add(cid)

            if cid in self._contact_windows:
                day, hour, conf = self._contact_windows[cid]
            else:
                day, hour, conf = 2, 10, 0.0

            day_name   = DAYS_RU[day]
            time_label = f"{day_name} {hour:02d}:00–{(hour+1) % 24:02d}:00"

            written = self.client.update_deal(
                deal_id, {config.FIELD_CONTACT_TIME: time_label}
            )

            results.append(ContactWindow(
                company_id=cid,
                deal_id=deal_id,
                day_of_week=day,
                day_name=day_name,
                hour=hour,
                time_label=time_label,
                confidence=conf,
                total_contacts=0,
                written_to_b24=written,
            ))

        logger.info(
            "ContactOptimizer завершён: %d компаний, обновлено в Б24: %d",
            len(results),
            sum(1 for r in results if r.written_to_b24),
        )
        return results

    def get_best_time(self, company_id: int) -> str:
        """Возвращает строку оптимального времени для компании."""
        if company_id in self._contact_windows:
            day, hour, _ = self._contact_windows[company_id]
        else:
            day, hour = 2, 10

        return f"{DAYS_RU[day]} {hour:02d}:00–{(hour+1) % 24:02d}:00"
