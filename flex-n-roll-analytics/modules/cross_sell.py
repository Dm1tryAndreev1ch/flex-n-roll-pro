"""
cross_sell.py — Cross-sell рекомендации для типографии FLEX-N-ROLL PRO.

Алгоритм:
  1. Строим матрицу заказов клиент × продукт (binary)
  2. Применяем mlxtend Apriori (min_support=0.1)
  3. Генерируем association rules (min_confidence=0.5)
  4. Дополнительные бизнес-правила типографии:
       самоклейка → AR или термохром
       нет маркировки → DataMatrix
       sleeve → гибридная_флексо_цифра
  5. Для каждой активной сделки находим релевантные рекомендации
  6. Создаём задачу менеджеру в Б24 со списком рекомендаций
"""

import logging
from datetime import datetime, timedelta
from typing import NamedTuple

import numpy as np
import pandas as pd
import joblib
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Бизнес-правила типографии
# ---------------------------------------------------------------------------

BUSINESS_RULES: list[dict] = [
    {
        "if_product": "самоклейка",
        "recommend": ["AR_этикетка", "термохром"],
        "reason": "Клиенты, заказывающие самоклейку, часто добавляют AR или термохром для premium-эффекта",
    },
    {
        "if_no_product": "DataMatrix",
        "recommend": ["DataMatrix"],
        "reason": "Клиент не использует DataMatrix-маркировку — обязательная для большинства групп товаров с 2024 г.",
    },
    {
        "if_product": "sleeve",
        "recommend": ["гибридная_флексо_цифра"],
        "reason": "Sleeve-заказчики выигрывают от гибридной технологии: флексо-фон + цифровые переменные данные",
    },
]

MARKING_PRODUCTS = {"DataMatrix"}

# ---------------------------------------------------------------------------
# Структуры данных
# ---------------------------------------------------------------------------

class CrossSellRecommendation(NamedTuple):
    company_id: int
    deal_id: int
    manager_id: int
    current_products: list[str]
    recommended_products: list[str]
    confidence: float
    reason: str
    task_created: bool


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------

def _extract_products(deal: dict) -> list[str]:
    """Извлекает список продуктов из поля сделки."""
    raw = str(deal.get("UF_CRM_PRODUCT_TYPE") or "").strip().lower()
    if not raw:
        return []
    tokens = [t.strip() for t in raw.replace(";", ",").replace("\n", ",").split(",")]
    return [t for t in tokens if t]


def _build_transaction_matrix(deals: list[dict]) -> pd.DataFrame:
    """
    Строит бинарную матрицу сделка × продукт для mlxtend.

    :param deals: Список сделок
    :return: DataFrame с bool-значениями
    """
    transactions = []
    for deal in deals:
        products = _extract_products(deal)
        if products:
            transactions.append(products)

    if not transactions:
        return pd.DataFrame()

    te = TransactionEncoder()
    te_arr = te.fit_transform(transactions)
    df = pd.DataFrame(te_arr, columns=te.columns_)
    return df


def _group_by_company(deals: list[dict]) -> dict[int, list[str]]:
    """Возвращает словарь {company_id: [все_продукты_компании]}."""
    result: dict[int, list[str]] = {}
    for deal in deals:
        cid = int(deal.get("COMPANY_ID") or 0)
        if cid == 0:
            continue
        products = _extract_products(deal)
        if cid not in result:
            result[cid] = []
        result[cid].extend(products)
    return result


# ---------------------------------------------------------------------------
# Основной класс
# ---------------------------------------------------------------------------

class CrossSellEngine:
    """
    Движок cross-sell рекомендаций.

    Использует:
      - Ассоциативные правила (Apriori) из истории заказов
      - Жёсткие бизнес-правила типографии
    """

    def __init__(self, client: BitrixClient):
        self.client = client
        self.rules: pd.DataFrame | None = None
        self._load_model()

    def _save_model(self) -> None:
        if self.rules is not None:
            joblib.dump(self.rules, config.MODEL_CROSS_SELL)
            logger.info("Модель cross_sell сохранена: %s", config.MODEL_CROSS_SELL)

    def _load_model(self) -> None:
        if config.MODEL_CROSS_SELL.exists():
            try:
                self.rules = joblib.load(config.MODEL_CROSS_SELL)
                logger.info("Модель cross_sell загружена: %d правил", len(self.rules))
            except Exception as exc:
                logger.warning("Не удалось загрузить cross_sell модель: %s", exc)
                self.rules = None

    def train(self, days_back: int = 730, min_support: float = 0.1) -> dict:
        """
        Строит матрицу ассоциативных правил на истории заказов.

        :param days_back:    Глубина истории
        :param min_support:  Минимальная поддержка
        :return: Статистика обучения
        """
        logger.info(
            "Обучение CrossSell (history=%d дней, min_support=%.2f)...",
            days_back, min_support,
        )

        closed_deals = self.client.get_closed_deals(days_back=days_back)
        active_deals = self.client.get_active_deals()
        all_deals = closed_deals + active_deals

        df = _build_transaction_matrix(all_deals)
        if df.empty:
            logger.warning("Нет транзакций с заполненным типом продукта.")
            self.rules = pd.DataFrame()
            return {"rules_count": 0, "transactions": 0}

        logger.info("Транзакций для Apriori: %d", len(df))

        frequent_sets = apriori(df, min_support=min_support, use_colnames=True)
        if frequent_sets.empty:
            frequent_sets = apriori(df, min_support=0.05, use_colnames=True)

        if frequent_sets.empty:
            self.rules = pd.DataFrame()
            self._save_model()
            return {"rules_count": 0, "transactions": len(df)}

        rules = association_rules(frequent_sets, metric="confidence", min_threshold=0.5)
        rules = rules.sort_values("lift", ascending=False)

        self.rules = rules
        self._save_model()

        logger.info("CrossSell обучен: %d правил из %d транзакций", len(rules), len(df))
        return {
            "rules_count": len(rules),
            "transactions": len(df),
            "frequent_sets": len(frequent_sets),
        }

    def _apply_association_rules(
        self,
        current_products: set[str],
    ) -> list[tuple[str, float, str]]:
        """Применяет ассоциативные правила к набору продуктов клиента."""
        recommendations: list[tuple[str, float, str]] = []

        if self.rules is None or self.rules.empty:
            return recommendations

        for _, rule in self.rules.iterrows():
            antecedent = set(rule["antecedents"])
            consequent = set(rule["consequents"])

            if antecedent <= current_products and not consequent & current_products:
                for prod in consequent:
                    if prod not in current_products:
                        reason = (
                            f"Клиенты, заказывающие {', '.join(antecedent)}, "
                            f"также заказывают {prod} "
                            f"(confidence={rule['confidence']:.0%}, lift={rule['lift']:.2f})"
                        )
                        recommendations.append((prod, float(rule["confidence"]), reason))

        best: dict[str, tuple[float, str]] = {}
        for prod, conf, reason in recommendations:
            if prod not in best or conf > best[prod][0]:
                best[prod] = (conf, reason)

        return [(prod, conf, reason) for prod, (conf, reason) in best.items()]

    def _apply_business_rules(
        self,
        current_products: set[str],
        all_company_products: set[str],
    ) -> list[tuple[str, float, str]]:
        """Применяет жёсткие бизнес-правила типографии."""
        recommendations: list[tuple[str, float, str]] = []

        for rule in BUSINESS_RULES:
            if "if_product" in rule:
                if rule["if_product"] in current_products or rule["if_product"] in all_company_products:
                    for prod in rule["recommend"]:
                        if prod not in all_company_products:
                            recommendations.append((prod, 0.85, rule["reason"]))
            elif "if_no_product" in rule:
                has_marking = bool(MARKING_PRODUCTS & all_company_products)
                if not has_marking:
                    for prod in rule["recommend"]:
                        recommendations.append((prod, 0.9, rule["reason"]))

        return recommendations

    def recommend_and_create_tasks(self) -> list[CrossSellRecommendation]:
        """
        Генерирует рекомендации для всех активных сделок
        и создаёт задачи менеджерам в Б24.

        :return: Список рекомендаций
        """
        logger.info("Запуск генерации cross-sell рекомендаций...")

        active_deals = self.client.get_active_deals()
        closed_deals = self.client.get_closed_deals(days_back=730)
        all_deals = active_deals + closed_deals

        company_products = _group_by_company(all_deals)

        results: list[CrossSellRecommendation] = []
        processed_companies: set[int] = set()

        for deal in active_deals:
            deal_id = int(deal["ID"])
            company_id = int(deal.get("COMPANY_ID") or 0)
            manager_id = int(deal.get("ASSIGNED_BY_ID") or config.DEFAULT_RESPONSIBLE_ID)

            if company_id in processed_companies:
                continue
            processed_companies.add(company_id)

            current_products = set(_extract_products(deal))
            all_company_prods = set(company_products.get(company_id, []))

            assoc_recs = self._apply_association_rules(current_products)
            biz_recs   = self._apply_business_rules(current_products, all_company_prods)

            all_recs: dict[str, tuple[float, str]] = {}
            for prod, conf, reason in biz_recs + assoc_recs:
                if prod not in all_company_prods:
                    if prod not in all_recs or conf > all_recs[prod][0]:
                        all_recs[prod] = (conf, reason)

            if not all_recs:
                continue

            recommended = sorted(all_recs.items(), key=lambda x: x[1][0], reverse=True)

            rec_lines = "\n".join(
                f"  • {prod} (уверенность {conf:.0%}): {reason}"
                for prod, (conf, reason) in recommended
            )
            task_title = f"Cross-sell: рекомендации для компании #{company_id}"
            task_desc = (
                f"AI-аналитика выявила возможности для доп. продаж.\n\n"
                f"Сделка: #{deal_id}\n"
                f"Текущие продукты: {', '.join(current_products) or 'не указаны'}\n\n"
                f"Рекомендации:\n{rec_lines}\n\n"
                f"Сгенерировано: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
            )
            deadline = datetime.now() + timedelta(days=3)

            task_created = bool(
                self.client.create_task(
                    title=task_title,
                    description=task_desc,
                    responsible_id=manager_id,
                    deadline=deadline,
                    deal_id=deal_id,
                )
            )

            top_rec_str = ", ".join(p for p, _ in recommended[:3])
            self.client.update_deal(deal_id, {config.FIELD_CROSS_SELL: top_rec_str})

            results.append(CrossSellRecommendation(
                company_id=company_id,
                deal_id=deal_id,
                manager_id=manager_id,
                current_products=list(current_products),
                recommended_products=[p for p, _ in recommended],
                confidence=recommended[0][1][0] if recommended else 0.0,
                reason=recommended[0][1][1] if recommended else "",
                task_created=task_created,
            ))

        logger.info(
            "Cross-sell завершён: %d рекомендаций, задач создано: %d",
            len(results),
            sum(1 for r in results if r.task_created),
        )
        return results
