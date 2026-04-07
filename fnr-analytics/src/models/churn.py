"""
Предсказание риска оттока клиентов.
Модель: RandomForestClassifier (sklearn).
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

from config.settings import CHURN_THRESHOLD_DAYS
from src.utils.logger import get_logger

logger = get_logger("models.churn")


class ChurnPredictor:
    """
    Предсказание вероятности оттока клиентов.

    Определение оттока: клиент не делал заказов более CHURN_THRESHOLD_DAYS (90) дней.

    Признаки:
    - days_since_last_order: дней с последнего заказа
    - total_orders: общее количество заказов
    - avg_order_value: средний чек
    - product_diversity: разнообразие продуктов
    - avg_deal_duration: средняя длительность сделки
    - win_rate: доля выигранных сделок

    Выход:
    - churn_probability: вероятность оттока [0, 1]
    - risk_level: HIGH (>0.7), MEDIUM (0.4–0.7), LOW (<0.4)
    - recommended_action: рекомендация менеджеру
    """

    FEATURES = [
        "days_since_last_order",
        "total_orders",
        "avg_order_value",
        "product_diversity",
        "avg_deal_duration",
        "win_rate",
    ]

    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=6,
            min_samples_leaf=3,
            random_state=42,
            class_weight="balanced",
        )
        self.scaler = StandardScaler()
        self._is_fitted = False

    def predict(
        self,
        company_agg: pd.DataFrame,
        companies_df: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """
        Предсказать риск оттока для каждой компании.

        Args:
            company_agg: Агрегированные данные по компаниям
                         (из DataPreprocessor.aggregate_by_company).
            companies_df: DataFrame компаний (для имён). Опционально.

        Returns:
            DataFrame с колонками:
            [company_id, company_name, churn_probability, risk_level,
             last_order_date, recommended_action]
        """
        if company_agg.empty:
            logger.warning("Пустой входной DataFrame — возврат пустого результата")
            return pd.DataFrame(columns=[
                "company_id", "company_name", "churn_probability",
                "risk_level", "last_order_date", "recommended_action",
            ])

        df = company_agg.copy()

        # Подготовка целевой переменной
        df["is_churned"] = (df["days_since_last_order"] >= CHURN_THRESHOLD_DAYS).astype(int)

        # Проверяем наличие признаков
        missing_features = [f for f in self.FEATURES if f not in df.columns]
        if missing_features:
            logger.error("Отсутствуют признаки: %s", missing_features)
            raise ValueError(f"Отсутствуют признаки: {missing_features}")

        X = df[self.FEATURES].fillna(0).values
        y = df["is_churned"].values

        # Масштабирование
        X_scaled = self.scaler.fit_transform(X)

        # Обучение и кросс-валидация
        if len(np.unique(y)) > 1:
            cv_scores = cross_val_score(self.model, X_scaled, y, cv=min(5, len(y)), scoring="f1")
            logger.info(
                "Кросс-валидация F1: %.3f ± %.3f",
                cv_scores.mean(), cv_scores.std(),
            )

        # Обучение на полном датасете
        self.model.fit(X_scaled, y)
        self._is_fitted = True

        # Предсказание вероятностей
        probas = self.model.predict_proba(X_scaled)
        churn_proba = probas[:, 1] if probas.shape[1] > 1 else probas[:, 0]

        # Важность признаков
        importances = dict(zip(self.FEATURES, self.model.feature_importances_))
        logger.info("Важность признаков: %s", {
            k: f"{v:.3f}" for k, v in sorted(importances.items(), key=lambda x: -x[1])
        })

        # Формирование результата
        result = pd.DataFrame({
            "company_id": df["COMPANY_ID"].values,
            "churn_probability": np.round(churn_proba, 3),
            "last_order_date": df["last_order_date"].values,
            "total_orders": df["total_orders"].values,
            "avg_order_value": df["avg_order_value"].round(2).values,
            "days_since_last_order": df["days_since_last_order"].values,
        })

        # Уровень риска
        result["risk_level"] = result["churn_probability"].apply(self._classify_risk)

        # Рекомендации
        result["recommended_action"] = result.apply(self._recommend_action, axis=1)

        # Добавляем имена компаний
        if companies_df is not None and "TITLE" in companies_df.columns:
            name_map = companies_df.set_index("ID")["TITLE"].to_dict()
            result["company_name"] = result["company_id"].map(name_map).fillna("Неизвестная компания")
        else:
            result["company_name"] = "—"

        # Сортировка по вероятности оттока (убывание)
        result = result.sort_values("churn_probability", ascending=False).reset_index(drop=True)

        # Порядок колонок
        result = result[[
            "company_id", "company_name", "churn_probability", "risk_level",
            "last_order_date", "total_orders", "avg_order_value",
            "days_since_last_order", "recommended_action",
        ]]

        logger.info(
            "Риски оттока: HIGH=%d, MEDIUM=%d, LOW=%d",
            (result["risk_level"] == "HIGH").sum(),
            (result["risk_level"] == "MEDIUM").sum(),
            (result["risk_level"] == "LOW").sum(),
        )

        return result

    @staticmethod
    def _classify_risk(probability: float) -> str:
        """Классификация уровня риска."""
        if probability > 0.7:
            return "HIGH"
        elif probability > 0.4:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _recommend_action(row: pd.Series) -> str:
        """Рекомендация менеджеру на основе риска и поведения клиента."""
        risk = row["risk_level"]
        days = row["days_since_last_order"]
        orders = row["total_orders"]
        avg_value = row["avg_order_value"]

        if risk == "HIGH":
            if days > 180:
                return "🔴 Срочно: персональное предложение со скидкой 15-20%"
            if avg_value > 50000:
                return "🔴 Срочно: звонок руководителя, VIP-условия"
            return "🔴 Срочно: связаться, выяснить причину отсутствия заказов"

        if risk == "MEDIUM":
            if orders > 5:
                return "🟡 Предложить программу лояльности / объёмную скидку"
            return "🟡 Напоминание о компании, отправить каталог новинок"

        # LOW
        if orders > 10:
            return "🟢 Поддерживать контакт, поздравления с праздниками"
        return "🟢 Стандартное обслуживание, информировать об акциях"
