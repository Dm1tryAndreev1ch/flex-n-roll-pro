"""
bitrix_client.py — Клиент для Битрикс24 REST API.

Возможности:
- Получение активных сделок с пагинацией (start=0, шаг 50)
- Получение истории активностей (звонки, письма)
- Обновление полей сделок (crm.deal.update)
- Создание задач менеджерам (tasks.task.add)
- Кэширование: Redis если доступен, иначе файловый JSON-кэш
- Автоматические retry через tenacity
"""

import json
import logging
import hashlib
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

try:
    import redis as redis_lib
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Вспомогательный кэш
# ---------------------------------------------------------------------------

class FileCache:
    """Простой файловый JSON-кэш с TTL."""

    def __init__(self, cache_dir: Path, ttl: int = 3600):
        self.cache_dir = cache_dir
        self.ttl = ttl
        cache_dir.mkdir(exist_ok=True)

    def _key_path(self, key: str) -> Path:
        hashed = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed}.json"

    def get(self, key: str) -> Any | None:
        path = self._key_path(key)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if time.time() - data["ts"] > self.ttl:
                path.unlink(missing_ok=True)
                return None
            return data["value"]
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        path = self._key_path(key)
        try:
            path.write_text(
                json.dumps({"ts": time.time(), "value": value}, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("FileCache.set error: %s", exc)


class RedisCache:
    """Обёртка над redis с автоматическим сериализацией JSON."""

    def __init__(self, url: str, ttl: int = 3600):
        self.ttl = ttl
        self._client = redis_lib.from_url(url, decode_responses=True)

    def get(self, key: str) -> Any | None:
        try:
            raw = self._client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.warning("RedisCache.get error: %s", exc)
            return None

    def set(self, key: str, value: Any) -> None:
        try:
            self._client.setex(key, self.ttl, json.dumps(value, ensure_ascii=False))
        except Exception as exc:
            logger.warning("RedisCache.set error: %s", exc)


def _build_cache():
    """Создаёт Redis-кэш если доступен, иначе файловый."""
    if config.USE_REDIS and REDIS_AVAILABLE:
        try:
            cache = RedisCache(config.REDIS_URL, ttl=config.CACHE_TTL_SECONDS)
            cache._client.ping()
            logger.info("Используется Redis-кэш: %s", config.REDIS_URL)
            return cache
        except Exception as exc:
            logger.warning("Redis недоступен (%s), переключаемся на файловый кэш", exc)
    logger.info("Используется файловый кэш: %s", config.CACHE_DIR)
    return FileCache(config.CACHE_DIR, ttl=config.CACHE_TTL_SECONDS)


# ---------------------------------------------------------------------------
# Основной клиент
# ---------------------------------------------------------------------------

class BitrixClient:
    """
    Клиент Битрикс24 REST API.

    Пример использования:
        client = BitrixClient()
        deals = client.get_active_deals()
        client.update_deal(42, {"UF_CRM_WIN_PROBABILITY": 85})
    """

    def __init__(self):
        self.webhook = config.BITRIX_WEBHOOK_URL.rstrip("/")
        self.timeout = config.BITRIX_REQUEST_TIMEOUT
        self.page_size = config.BITRIX_PAGE_SIZE
        self.cache = _build_cache()
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    # ------------------------------------------------------------------
    # Внутренние методы
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(config.BITRIX_MAX_RETRIES),
        wait=wait_exponential(
            multiplier=config.BITRIX_RETRY_DELAY, min=1, max=30
        ),
        retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
        reraise=True,
    )
    def _call(self, method: str, params: dict | None = None) -> dict:
        """
        Выполняет один вызов REST API Битрикс24.

        :param method: Метод API, например 'crm.deal.list'
        :param params: Параметры запроса
        :return: Распакованный JSON-ответ
        """
        url = f"{self.webhook}/{method}.json"
        params = params or {}
        try:
            response = self._session.post(url, json=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if "error" in data:
                raise ValueError(
                    f"Б24 API error [{data['error']}]: {data.get('error_description', '')}"
                )
            return data
        except requests.HTTPError as exc:
            logger.error("HTTP ошибка %s для %s: %s", exc.response.status_code, method, exc)
            raise
        except ValueError:
            raise
        except Exception as exc:
            logger.error("Неожиданная ошибка при вызове %s: %s", method, exc)
            raise

    def _paginate(self, method: str, params: dict, result_key: str = "result") -> list[dict]:
        """
        Постранично получает все записи с поддержкой пагинации Б24.
        Б24 возвращает максимум 50 записей за запрос (start=0..N).

        :param method:     Метод API
        :param params:     Базовые параметры
        :param result_key: Ключ в ответе с массивом данных
        :return: Список всех записей
        """
        all_items: list[dict] = []
        start = 0

        while True:
            page_params = {**params, "start": start}
            data = self._call(method, page_params)
            items = data.get(result_key, [])
            all_items.extend(items)

            total = int(data.get("total", 0))
            logger.debug(
                "%s: получено %d / %d записей (start=%d)",
                method, len(all_items), total, start,
            )

            # Б24 возвращает next в data["next"] или считаем вручную
            if "next" in data:
                start = data["next"]
            elif len(all_items) < total:
                start += self.page_size
            else:
                break

        return all_items

    # ------------------------------------------------------------------
    # Публичные методы — чтение
    # ------------------------------------------------------------------

    def get_active_deals(self, extra_filter: dict | None = None) -> list[dict]:
        """
        Возвращает все активные (незакрытые) сделки.

        :param extra_filter: Дополнительные условия фильтрации
        """
        cache_key = "active_deals"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Сделки получены из кэша (%d шт.)", len(cached))
            return cached

        base_filter = {
            "CLOSED": "N",          # только открытые
            "!=STAGE_ID": "LOSE",   # исключаем проигранные
        }
        if extra_filter:
            base_filter.update(extra_filter)

        params = {
            "filter": base_filter,
            "select": [
                "ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "CURRENCY_ID",
                "CONTACT_ID", "COMPANY_ID", "ASSIGNED_BY_ID",
                "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
                "TYPE_ID", "SOURCE_ID",
                config.FIELD_WIN_PROBABILITY,
                config.FIELD_CHURN_RISK,
                config.FIELD_CROSS_SELL,
                config.FIELD_CONTACT_TIME,
                "UF_CRM_PRODUCT_TYPE",   # тип продукта типографии
                "UF_CRM_SEGMENT",        # сегмент клиента
            ],
        }
        deals = self._paginate("crm.deal.list", params)
        self.cache.set(cache_key, deals)
        logger.info("Получено активных сделок: %d", len(deals))
        return deals

    def get_closed_deals(self, days_back: int = 365) -> list[dict]:
        """
        Возвращает закрытые сделки за последние N дней.
        Используется для обучения моделей.

        :param days_back: Количество дней в прошлое
        """
        cache_key = f"closed_deals_{days_back}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Закрытые сделки получены из кэша (%d шт.)", len(cached))
            return cached

        since = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00")

        params = {
            "filter": {
                "CLOSED": "Y",
                ">=DATE_MODIFY": since,
            },
            "select": [
                "ID", "TITLE", "STAGE_ID", "OPPORTUNITY",
                "CONTACT_ID", "COMPANY_ID",
                "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
                "UF_CRM_PRODUCT_TYPE", "UF_CRM_SEGMENT",
            ],
        }
        deals = self._paginate("crm.deal.list", params)
        self.cache.set(cache_key, deals)
        logger.info("Получено закрытых сделок: %d (за %d дней)", len(deals), days_back)
        return deals

    def get_activities(
        self,
        entity_type: str = "CRM_DEAL",
        deal_ids: list[int] | None = None,
        days_back: int = 180,
    ) -> list[dict]:
        """
        Возвращает историю активностей (звонки, письма).

        :param entity_type: Тип сущности ('CRM_DEAL', 'CRM_CONTACT')
        :param deal_ids:    Список ID сделок для фильтрации
        :param days_back:   Глубина истории в днях
        """
        cache_key = f"activities_{entity_type}_{days_back}_{hash(tuple(deal_ids or []))}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Активности получены из кэша (%d шт.)", len(cached))
            return cached

        since = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00")

        flt: dict = {
            ">=CREATED": since,
            "BINDINGS": [{"ENTITY_TYPE": entity_type}],
        }
        if deal_ids:
            flt["OWNER_ID"] = deal_ids

        params = {
            "filter": flt,
            "select": [
                "ID", "TYPE_ID", "SUBJECT", "CREATED", "DEADLINE",
                "OWNER_ID", "OWNER_TYPE_ID", "RESPONSIBLE_ID",
                "DIRECTION",   # 1=входящий, 2=исходящий
                "COMPLETED",
            ],
        }
        activities = self._paginate("crm.activity.list", params)
        self.cache.set(cache_key, activities)
        logger.info("Получено активностей: %d", len(activities))
        return activities

    def get_company_deals(self, company_id: int) -> list[dict]:
        """Возвращает все сделки по компании (для расчёта LTV и истории)."""
        params = {
            "filter": {"COMPANY_ID": company_id},
            "select": ["ID", "OPPORTUNITY", "STAGE_ID", "DATE_MODIFY", "CLOSED"],
        }
        return self._paginate("crm.deal.list", params)

    def get_contacts(self) -> list[dict]:
        """Возвращает список всех контактов для churn-анализа."""
        cache_key = "contacts_all"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "select": ["ID", "NAME", "LAST_NAME", "COMPANY_ID", "ASSIGNED_BY_ID"],
        }
        contacts = self._paginate("crm.contact.list", params)
        self.cache.set(cache_key, contacts)
        logger.info("Получено контактов: %d", len(contacts))
        return contacts

    # ------------------------------------------------------------------
    # Публичные методы — запись
    # ------------------------------------------------------------------

    def update_deal(self, deal_id: int, fields: dict) -> bool:
        """
        Обновляет поля сделки.

        :param deal_id: ID сделки
        :param fields:  Словарь обновляемых полей
        :return: True если успешно
        """
        try:
            self._call("crm.deal.update", {"id": deal_id, "fields": fields})
            logger.debug("Сделка #%d обновлена: %s", deal_id, list(fields.keys()))
            return True
        except Exception as exc:
            logger.error("Ошибка обновления сделки #%d: %s", deal_id, exc)
            return False

    def create_task(
        self,
        title: str,
        description: str,
        responsible_id: int,
        deadline: datetime | None = None,
        deal_id: int | None = None,
    ) -> int | None:
        """
        Создаёт задачу менеджеру.

        :param title:          Название задачи
        :param description:    Описание
        :param responsible_id: ID ответственного в Б24
        :param deadline:       Срок исполнения
        :param deal_id:        Привязка к сделке (UF_CRM)
        :return: ID созданной задачи или None
        """
        fields: dict = {
            "TITLE": title,
            "DESCRIPTION": description,
            "RESPONSIBLE_ID": responsible_id,
            "ALLOW_TIME_TRACKING": "N",
        }
        if deadline:
            fields["DEADLINE"] = deadline.strftime("%Y-%m-%dT%H:%M:%S+03:00")
        if deal_id:
            fields["UF_CRM_TASK"] = [f"CRM_DEAL_{deal_id}"]

        try:
            data = self._call("tasks.task.add", {"fields": fields})
            task_id = data.get("result", {}).get("task", {}).get("id")
            logger.info("Задача создана: #%s — %s", task_id, title)
            return int(task_id) if task_id else None
        except Exception as exc:
            logger.error("Ошибка создания задачи '%s': %s", title, exc)
            return None

    def post_to_feed(self, message: str, group_id: int = 0) -> bool:
        """
        Публикует сообщение в живую ленту (для сводных отчётов).

        :param message:  Текст сообщения
        :param group_id: ID группы (0 = лента новостей)
        :return: True если успешно
        """
        params: dict = {"POST_TITLE": "Analytics Report", "MESSAGE": message}
        if group_id:
            params["DEST"] = [f"SG{group_id}"]

        try:
            self._call("log.blogpost.add", params)
            logger.info("Сообщение опубликовано в живую ленту")
            return True
        except Exception as exc:
            logger.error("Ошибка публикации в ленту: %s", exc)
            return False

    def invalidate_cache(self) -> None:
        """Принудительно сбрасывает кэш (вызывается перед переобучением)."""
        if isinstance(self.cache, RedisCache):
            try:
                self.cache._client.flushdb()
                logger.info("Redis кэш очищен")
            except Exception as exc:
                logger.warning("Ошибка очистки Redis: %s", exc)
        elif isinstance(self.cache, FileCache):
            for f in config.CACHE_DIR.glob("*.json"):
                f.unlink(missing_ok=True)
            logger.info("Файловый кэш очищен")
