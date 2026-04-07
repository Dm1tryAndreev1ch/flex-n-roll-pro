"""
Прогнозирование выручки на основе временных рядов.
Модель: LinearRegression + сезонные dummy-переменные.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from config.settings import FORECAST_MONTHS_AHEAD
from src.utils.logger import get_logger

logger = get_logger("models.forecast")


class RevenueForecast:
    """
    Прогноз выручки по месяцам.

    Метод:
    - Линейная регрессия на временном тренде
    - Сезонные dummy-переменные (12 месяцев)
    - 95% доверительный интервал на основе среднеквадратичной ошибки

    Вход: DataFrame сделок (выигранные, с полем OPPORTUNITY и DATE_CREATE).
    Выход: DataFrame [month, actual, forecast, lower_ci, upper_ci].
    """

    def __init__(self, months_ahead: int | None = None):
        self.months_ahead = months_ahead or FORECAST_MONTHS_AHEAD
        self.model = LinearRegression()
        self._is_fitted = False

    def predict(self, deals_df: pd.DataFrame) -> pd.DataFrame:
        """
        Построить прогноз выручки.

        Args:
            deals_df: Обработанный DataFrame сделок (с is_won, DATE_CREATE, OPPORTUNITY).

        Returns:
            DataFrame с колонками:
            [month, actual, forecast, lower_ci, upper_ci, is_forecast]
        """
        # Фильтруем только выигранные сделки
        won = deals_df[deals_df["is_won"]].copy()
        if won.empty:
            logger.warning("Нет выигранных сделок для прогноза")
            return pd.DataFrame(columns=[
                "month", "actual", "forecast", "lower_ci", "upper_ci", "is_forecast",
            ])

        # Агрегация по месяцам
        won["month"] = won["DATE_CREATE"].dt.to_period("M")
        monthly = won.groupby("month").agg(
            actual=("OPPORTUNITY", "sum"),
            deal_count=("ID", "count"),
        ).reset_index()
        monthly = monthly.sort_values("month").reset_index(drop=True)

        if len(monthly) < 3:
            logger.warning("Слишком мало данных для прогноза (%d месяцев)", len(monthly))
            monthly["month"] = monthly["month"].astype(str)
            monthly["forecast"] = monthly["actual"]
            monthly["lower_ci"] = monthly["actual"] * 0.8
            monthly["upper_ci"] = monthly["actual"] * 1.2
            monthly["is_forecast"] = False
            return monthly[["month", "actual", "forecast", "lower_ci", "upper_ci", "is_forecast"]]

        # Подготовка признаков
        n = len(monthly)
        X, feature_names = self._build_features(monthly, n)

        y = monthly["actual"].values

        # Обучение модели
        self.model.fit(X, y)
        self._is_fitted = True

        # Предсказание на исторических данных
        y_pred = self.model.predict(X)

        # Расчёт ошибки для доверительного интервала
        residuals = y - y_pred
        rmse = np.sqrt(np.mean(residuals ** 2))
        z_95 = 1.96  # z-score для 95% CI

        logger.info("RMSE модели: %.2f BYN", rmse)
        logger.info("R² модели: %.3f", self.model.score(X, y))

        # Логируем коэффициенты
        coef_dict = dict(zip(feature_names, self.model.coef_))
        logger.debug("Коэффициенты: %s", {k: f"{v:.2f}" for k, v in coef_dict.items()})

        # Формируем результат для исторических данных
        results = []
        for i in range(n):
            results.append({
                "month": str(monthly.iloc[i]["month"]),
                "actual": round(monthly.iloc[i]["actual"], 2),
                "forecast": round(y_pred[i], 2),
                "lower_ci": round(max(0, y_pred[i] - z_95 * rmse), 2),
                "upper_ci": round(max(0, y_pred[i] + z_95 * rmse), 2),
                "is_forecast": False,
            })

        # Прогноз на будущие месяцы
        last_period = monthly.iloc[-1]["month"]
        for m in range(1, self.months_ahead + 1):
            future_period = last_period + m
            future_idx = n + m - 1
            month_num = future_period.month

            # Признаки для будущего месяца
            x_future = np.zeros(len(feature_names))
            x_future[0] = future_idx  # тренд
            if month_num - 1 < 12:  # сезонная dummy
                x_future[1 + (month_num - 1)] = 1.0

            y_future = self.model.predict(x_future.reshape(1, -1))[0]

            # Расширение CI для будущих периодов
            ci_expansion = 1 + 0.15 * m
            results.append({
                "month": str(future_period),
                "actual": None,
                "forecast": round(max(0, y_future), 2),
                "lower_ci": round(max(0, y_future - z_95 * rmse * ci_expansion), 2),
                "upper_ci": round(max(0, y_future + z_95 * rmse * ci_expansion), 2),
                "is_forecast": True,
            })

        result_df = pd.DataFrame(results)

        logger.info(
            "Прогноз построен: %d исторических + %d будущих месяцев",
            n, self.months_ahead,
        )

        return result_df

    @staticmethod
    def _build_features(monthly: pd.DataFrame, n: int) -> tuple[np.ndarray, list[str]]:
        """
        Построить матрицу признаков: тренд + сезонные dummy.

        Returns:
            (X, feature_names) — матрица и имена признаков.
        """
        feature_names = ["trend"] + [f"month_{i}" for i in range(1, 13)]

        X = np.zeros((n, len(feature_names)))

        for i in range(n):
            X[i, 0] = i  # линейный тренд
            month_num = monthly.iloc[i]["month"].month
            X[i, month_num] = 1.0  # сезонная dummy

        return X, feature_names

    def get_summary(self, forecast_df: pd.DataFrame) -> dict:
        """
        Сводка по прогнозу для отчётов.

        Returns:
            dict с ключами:
            - last_actual_month, last_actual_value
            - forecast_months (list of dicts)
            - total_forecast, trend_direction
        """
        actual = forecast_df[~forecast_df["is_forecast"]]
        future = forecast_df[forecast_df["is_forecast"]]

        if actual.empty:
            return {"error": "Нет исторических данных"}

        last = actual.iloc[-1]
        prev = actual.iloc[-2] if len(actual) > 1 else last

        trend = "📈 рост" if last["actual"] > prev["actual"] else "📉 снижение"

        summary = {
            "last_actual_month": last["month"],
            "last_actual_value": last["actual"],
            "month_over_month_change": round(
                (last["actual"] - prev["actual"]) / prev["actual"] * 100, 1
            ) if prev["actual"] > 0 else 0,
            "trend_direction": trend,
            "forecast_months": [],
            "total_forecast": 0,
        }

        for _, row in future.iterrows():
            summary["forecast_months"].append({
                "month": row["month"],
                "forecast": row["forecast"],
                "lower_ci": row["lower_ci"],
                "upper_ci": row["upper_ci"],
            })
            summary["total_forecast"] += row["forecast"]

        summary["total_forecast"] = round(summary["total_forecast"], 2)

        return summary
