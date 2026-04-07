"""
RFM-сегментация клиентов.
Recency — Frequency — Monetary анализ с квартильным скорингом.
"""

import numpy as np
import pandas as pd

from src.utils.logger import get_logger

logger = get_logger("models.segmentation")

# Определение RFM-сегментов
SEGMENT_RULES: list[tuple[str, str, callable]] = []

# Сегменты определяются в _assign_segment как набор правил


class RFMSegmentation:
    """
    RFM-сегментация клиентов.

    Расчёт:
    - Recency: дней с последнего заказа
    - Frequency: количество заказов
    - Monetary: сумма всех заказов

    Скоринг: квартили 1–4 (4 = лучший) по каждому измерению.

    Сегменты:
    - Champions (R4, F4, M4) — лучшие клиенты
    - Loyal Customers (R≥3, F≥3) — лояльные
    - At Risk (R≤2, F≥3) — риск оттока
    - Lost (R=1, F≤2) — потерянные
    - New Customers (R=4, F=1) — новые
    - Promising (R≥3, F≤2) — перспективные
    """

    def segment(
        self,
        company_agg: pd.DataFrame,
        companies_df: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """
        Выполнить RFM-сегментацию.

        Args:
            company_agg: Агрегированные данные по компаниям
                         (из DataPreprocessor.aggregate_by_company).
            companies_df: DataFrame компаний (для имён). Опционально.

        Returns:
            DataFrame с колонками:
            [company_id, company_name, recency, frequency, monetary,
             r_score, f_score, m_score, rfm_score, segment, description]
        """
        if company_agg.empty:
            logger.warning("Пустой входной DataFrame")
            return pd.DataFrame()

        df = company_agg.copy()

        # Подготовка RFM-метрик
        rfm = pd.DataFrame({
            "company_id": df["COMPANY_ID"],
            "recency": df["days_since_last_order"],
            "frequency": df["total_orders"],
            "monetary": df["total_revenue"],
        })

        # Квартильный скоринг (1–4)
        # Для Recency: меньше = лучше, поэтому инвертируем
        rfm["r_score"] = pd.qcut(
            rfm["recency"], q=4, labels=[4, 3, 2, 1], duplicates="drop"
        ).astype(int)

        # Для Frequency и Monetary: больше = лучше
        rfm["f_score"] = pd.qcut(
            rfm["frequency"].rank(method="first"), q=4, labels=[1, 2, 3, 4], duplicates="drop"
        ).astype(int)

        rfm["m_score"] = pd.qcut(
            rfm["monetary"].rank(method="first"), q=4, labels=[1, 2, 3, 4], duplicates="drop"
        ).astype(int)

        # Общий RFM-скор (строка)
        rfm["rfm_score"] = (
            rfm["r_score"].astype(str)
            + rfm["f_score"].astype(str)
            + rfm["m_score"].astype(str)
        )

        # Сегментация
        rfm["segment"] = rfm.apply(self._assign_segment, axis=1)
        rfm["description"] = rfm["segment"].map(self._segment_descriptions())

        # Добавить имена компаний
        if companies_df is not None and "TITLE" in companies_df.columns:
            name_map = companies_df.set_index("ID")["TITLE"].to_dict()
            rfm["company_name"] = rfm["company_id"].map(name_map).fillna("—")
        else:
            rfm["company_name"] = "—"

        # Форматирование monetary
        rfm["monetary"] = rfm["monetary"].round(2)

        # Сортировка по сегментам
        segment_order = [
            "Champions", "Loyal Customers", "Promising",
            "New Customers", "At Risk", "Lost",
        ]
        rfm["_sort"] = rfm["segment"].map(
            {s: i for i, s in enumerate(segment_order)}
        ).fillna(99)
        rfm = rfm.sort_values(["_sort", "monetary"], ascending=[True, False])
        rfm = rfm.drop(columns=["_sort"]).reset_index(drop=True)

        # Колонки в нужном порядке
        result = rfm[[
            "company_id", "company_name", "recency", "frequency", "monetary",
            "r_score", "f_score", "m_score", "rfm_score", "segment", "description",
        ]]

        # Статистика
        segment_counts = result["segment"].value_counts()
        logger.info("RFM-сегментация завершена:")
        for seg, count in segment_counts.items():
            logger.info("  %s: %d компаний", seg, count)

        return result

    @staticmethod
    def _assign_segment(row: pd.Series) -> str:
        """Определить сегмент по RFM-скорам."""
        r, f, m = row["r_score"], row["f_score"], row["m_score"]

        # Champions: лучшие по всем метрикам
        if r >= 4 and f >= 4 and m >= 4:
            return "Champions"

        # Loyal Customers: высокая частота и давность
        if r >= 3 and f >= 3:
            return "Loyal Customers"

        # At Risk: были активны, но давно не заказывали
        if r <= 2 and f >= 3:
            return "At Risk"

        # Lost: давно не заказывали и мало заказов
        if r == 1 and f <= 2:
            return "Lost"

        # New Customers: недавно появились, мало заказов
        if r >= 4 and f == 1:
            return "New Customers"

        # Promising: относительно недавние, мало заказов
        if r >= 3 and f <= 2:
            return "Promising"

        # Fallback
        if r <= 2:
            return "At Risk"
        return "Promising"

    @staticmethod
    def _segment_descriptions() -> dict[str, str]:
        """Описания сегментов."""
        return {
            "Champions": "🏆 Лучшие клиенты. Заказывают часто и недавно. Максимальная ценность.",
            "Loyal Customers": "💎 Лояльные клиенты. Регулярные заказы, стабильная выручка.",
            "At Risk": "⚠️ Риск оттока. Были активны, но давно не заказывали. Требуют внимания.",
            "Lost": "❌ Потерянные. Давно не заказывали. Нужна реактивация или списание.",
            "New Customers": "🌟 Новые клиенты. Недавно начали работать. Потенциал роста.",
            "Promising": "📈 Перспективные. Недавние, но пока мало заказов. Нужно развивать.",
        }

    def get_summary(self, rfm_df: pd.DataFrame) -> dict:
        """
        Сводка по сегментации для отчётов.

        Returns:
            dict с общей статистикой и breakdown по сегментам.
        """
        if rfm_df.empty:
            return {"total_companies": 0, "segments": {}}

        summary = {
            "total_companies": len(rfm_df),
            "total_revenue": round(rfm_df["monetary"].sum(), 2),
            "avg_recency": round(rfm_df["recency"].mean(), 1),
            "avg_frequency": round(rfm_df["frequency"].mean(), 1),
            "avg_monetary": round(rfm_df["monetary"].mean(), 2),
            "segments": {},
        }

        for segment in rfm_df["segment"].unique():
            seg_data = rfm_df[rfm_df["segment"] == segment]
            summary["segments"][segment] = {
                "count": len(seg_data),
                "share_pct": round(len(seg_data) / len(rfm_df) * 100, 1),
                "total_revenue": round(seg_data["monetary"].sum(), 2),
                "revenue_share_pct": round(
                    seg_data["monetary"].sum() / rfm_df["monetary"].sum() * 100, 1
                ) if rfm_df["monetary"].sum() > 0 else 0,
                "avg_orders": round(seg_data["frequency"].mean(), 1),
            }

        return summary
