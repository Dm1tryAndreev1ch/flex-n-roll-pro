"""
Клиент для работы с Битрикс24 REST API.
Поддержка пакетных запросов, постраничной загрузки и retry-логики.
"""

import time
from typing import Any

import requests

from config.settings import (
    BITRIX24_WEBHOOK_URL,
    BITRIX_BATCH_SIZE,
    BITRIX_MAX_RETRIES,
    BITRIX_RETRY_DELAY,
)
from src.utils.logger import get_logger

logger = get_logger("bitrix_client")


class BitrixAPIError(Exception):
    """Ошибка при работе с Битрикс24 API."""
    pass


class BitrixClient:
    """
    Клиент REST API Битрикс24.

    Использует вебхук-авторизацию и поддерживает:
    - Постраничную загрузку данных (batch по 50 записей)
    - Автоматические повторные запросы при ошибках
    - Контроль rate-limit (не более 2 запросов/сек)
    """

    def __init__(self, webhook_url: str | None = None):
        self.webhook_url = (webhook_url or BITRIX24_WEBHOOK_URL).rstrip("/")
        if not self.webhook_url:
            raise BitrixAPIError(
                "BITRIX24_WEBHOOK_URL не задан. "
                "Укажите его в .env файле или передайте в конструктор."
            )
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self._last_request_time = 0.0

    def _throttle(self) -> None:
        """Контроль частоты запросов (не чаще 2 в секунду)."""
        elapsed = time.time() - self._last_request_time
        if elapsed < 0.5:
            time.sleep(0.5 - elapsed)
        self._last_request_time = time.time()

    def _request(self, method: str, params: dict | None = None) -> dict:
        """
        Выполнить один запрос к API с retry-логикой.

        Args:
            method: Метод API (например, 'crm.deal.list').
            params: Параметры запроса.

        Returns:
            Ответ API в виде dict.

        Raises:
            BitrixAPIError: При неудачном запросе после всех повторов.
        """
        url = f"{self.webhook_url}/{method}"
        last_error = None

        for attempt in range(1, BITRIX_MAX_RETRIES + 1):
            self._throttle()
            try:
                response = self.session.post(url, json=params or {}, timeout=30)
                response.raise_for_status()
                data = response.json()

                if "error" in data:
                    raise BitrixAPIError(
                        f"API ошибка: {data['error']} — {data.get('error_description', '')}"
                    )
                return data

            except requests.exceptions.RequestException as e:
                last_error = e
                logger.warning(
                    "Попытка %d/%d для %s не удалась: %s",
                    attempt, BITRIX_MAX_RETRIES, method, str(e),
                )
                if attempt < BITRIX_MAX_RETRIES:
                    time.sleep(BITRIX_RETRY_DELAY * attempt)

        raise BitrixAPIError(
            f"Не удалось выполнить {method} после {BITRIX_MAX_RETRIES} попыток: {last_error}"
        )

    def get_list(
        self,
        method: str,
        params: dict | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        """
        Загрузить полный список сущностей с постраничной навигацией.

        Args:
            method: Метод API (например, 'crm.deal.list').
            params: Фильтры и параметры запроса.
            limit: Максимальное количество записей (None = все).

        Returns:
            Полный список записей.
        """
        all_items: list[dict] = []
        start = 0
        request_params = dict(params or {})

        logger.info("Загрузка данных: %s", method)

        while True:
            request_params["start"] = start
            response = self._request(method, request_params)

            items = response.get("result", [])
            if not items:
                break

            all_items.extend(items)
            logger.debug(
                "Загружено %d записей (всего: %d)", len(items), len(all_items)
            )

            if limit and len(all_items) >= limit:
                all_items = all_items[:limit]
                break

            next_start = response.get("next")
            if next_start is None:
                break
            start = int(next_start)

        logger.info("Всего загружено: %d записей для %s", len(all_items), method)
        return all_items

    def get_deals(
        self,
        filters: dict | None = None,
        select: list[str] | None = None,
    ) -> list[dict]:
        """
        Загрузить сделки из CRM.

        Args:
            filters: Фильтры ({'STAGE_ID': 'WON', '>DATE_CREATE': '2024-01-01'}).
            select: Список полей для выборки.

        Returns:
            Список сделок.
        """
        params: dict[str, Any] = {}
        if filters:
            params["filter"] = filters
        if select:
            params["select"] = select
        else:
            params["select"] = [
                "ID", "TITLE", "STAGE_ID", "CATEGORY_ID",
                "OPPORTUNITY", "CURRENCY_ID",
                "COMPANY_ID", "CONTACT_ID",
                "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
                "ASSIGNED_BY_ID", "SOURCE_ID",
                "UF_*",
            ]
        return self.get_list("crm.deal.list", params)

    def get_contacts(self, filters: dict | None = None) -> list[dict]:
        """Загрузить контакты."""
        params: dict[str, Any] = {}
        if filters:
            params["filter"] = filters
        params["select"] = [
            "ID", "NAME", "LAST_NAME", "COMPANY_ID",
            "PHONE", "EMAIL", "DATE_CREATE",
        ]
        return self.get_list("crm.contact.list", params)

    def get_companies(self, filters: dict | None = None) -> list[dict]:
        """Загрузить компании."""
        params: dict[str, Any] = {}
        if filters:
            params["filter"] = filters
        params["select"] = [
            "ID", "TITLE", "INDUSTRY",
            "REVENUE", "PHONE", "EMAIL",
            "DATE_CREATE", "DATE_MODIFY",
        ]
        return self.get_list("crm.company.list", params)
