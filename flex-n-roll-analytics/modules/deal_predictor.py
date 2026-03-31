"""
deal_predictor.py — Прогноз вероятности закрытия сделки.

Модель: ансамбль RandomForestClassifier + LogisticRegression (soft voting).
Фичи:
  - Стадия сделки (ordinal encoding)
  - Сумма сделки (log1p)
  - Тип продукта (one-hot, 10 категорий)
  - LTV клиента (сумма прошлых выигранных сделок)
  - Количество предыдущих выигранных сделок
  - Дней на текущей стадии
  - Количество активностей (звонки + письма)
  - Сегмент клиента (ordinal A→1, B→2, C→3, D→4)

Выход:
  - Вероятность 0–100%
  - Топ-3 фактора влияния (SHAP-like через feature_importances_)
  - Запись прогноза в поле UF_CRM_WIN_PROBABILITY через crm.deal.update
"""

import logging
import pickle
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
import joblib

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Константы
# ---------------------------------------------------------------------------

FEATURE_COLUMNS = [
    "stage_ordinal",
    "amount_log",
    "days_in_stage",
    "activity_count",
    "ltv",
    "prev_won_count",
    "segment_ordinal",
] + [f"product_{p}" for p in config.PRODUCT_TYPES]

SEGMENT_MAP = {"A": 4, "B": 3, "C": 2, "D": 1, "": 0}


# ---------------------------------------------------------------------------
# Структуры данных
# ---------------------------------------------------------------------------

class PredictionResult(NamedTuple):
    deal_id: int
    probability: float          # 0.0 – 1.0
    probability_pct: int        # 0 – 100
    top_factors: list[str]      # топ-3 важных признака
    written_to_b24: bool        # успешно ли записано в Б24


# ---------------------------------------------------------------------------
# Построение фичей
# ---------------------------------------------------------------------------

def _build_features(
    deals: list[dict],
    activities: list[dict],
    company_history: dict[int, dict],
) -> pd.DataFrame:
    """
    Строит датафрейм признаков из сырых данных Б24.

    :param deals:           Список сделок
    :param activities:      Список активностей
    :param company_history: Словарь {company_id: {ltv, prev_won_count}}
    :return: DataFrame с фичами
    """
    now = datetime.now()

    # Подсчёт активностей по сделке
    activity_by_deal: dict[int, int] = {}
    for act in activities:
        try:
            owner_id = int(act.get("OWNER_ID", 0))
            activity_by_deal[owner_id] = activity_by_deal.get(owner_id, 0) + 1
        except (ValueError, TypeError):
            pass

    rows = []
    for deal in deals:
        try:
            deal_id = int(deal["ID"])

            # --- Стадия (ordinal) ---
            stage = deal.get("STAGE_ID", "NEW")
            stage_ordinal = config.STAGE_ORDER.get(stage, 1)

            # --- Сумма (log) ---
            try:
                amount = float(deal.get("OPPORTUNITY") or 0)
            except (ValueError, TypeError):
                amount = 0.0
            amount_log = np.log1p(amount)

            # --- Дней на текущей стадии ---
            try:
                date_modify = datetime.fromisoformat(
                    str(deal.get("DATE_MODIFY", now.isoformat())).replace("Z", "+00:00")
                )
                days_in_stage = max(0, (now - date_modify.replace(tzinfo=None)).days)
            except Exception:
                days_in_stage = 0

            # --- Активности ---
            act_count = activity_by_deal.get(deal_id, 0)

            # --- История компании ---
            company_id = int(deal.get("COMPANY_ID") or 0)
            hist = company_history.get(company_id, {"ltv": 0, "prev_won_count": 0})
            ltv = np.log1p(hist["ltv"])
            prev_won_count = hist["prev_won_count"]

            # --- Сегмент ---
            segment_raw = str(deal.get("UF_CRM_SEGMENT") or "").strip().upper()
            segment_ordinal = SEGMENT_MAP.get(segment_raw, 0)

            # --- Тип продукта (one-hot) ---
            product_raw = str(deal.get("UF_CRM_PRODUCT_TYPE") or "").strip().lower()
            product_ohe = {
                f"product_{p}": int(p.lower() in product_raw)
                for p in config.PRODUCT_TYPES
            }

            row = {
                "deal_id": deal_id,
                "stage_ordinal": stage_ordinal,
                "amount_log": amount_log,
                "days_in_stage": days_in_stage,
                "activity_count": act_count,
                "ltv": ltv,
                "prev_won_count": prev_won_count,
                "segment_ordinal": segment_ordinal,
                **product_ohe,
            }
            rows.append(row)

        except Exception as exc:
            logger.warning("Ошибка при обработке сделки #%s: %s", deal.get("ID"), exc)

    return pd.DataFrame(rows)


def _compute_company_history(deals: list[dict]) -> dict[int, dict]:
    """
    Считает LTV и количество выигранных сделок по каждой компании.

    :param deals: Закрытые сделки
    :return: Словарь {company_id: {ltv, prev_won_count}}
    """
    history: dict[int, dict] = {}
    for deal in deals:
        try:
            company_id = int(deal.get("COMPANY_ID") or 0)
            if company_id == 0:
                continue
            amount = float(deal.get("OPPORTUNITY") or 0)
            is_won = deal.get("STAGE_ID") == "WON"

            if company_id not in history:
                history[company_id] = {"ltv": 0.0, "prev_won_count": 0}
            if is_won:
                history[company_id]["ltv"] += amount
                history[company_id]["prev_won_count"] += 1
        except Exception:
            pass
    return history


# ---------------------------------------------------------------------------
# Модель
# ---------------------------------------------------------------------------

class DealPredictor:
    """Ансамбль RF + LR для прогноза вероятности закрытия сделки."""

    def __init__(self, client: BitrixClient):
        self.client = client
        self.model: VotingClassifier | None = None
        self.feature_names: list[str] = FEATURE_COLUMNS
        self._load_model()

    # ----------------------------------------------------------------
    # Сохранение / загрузка модели
    # ----------------------------------------------------------------

    def _save_model(self) -> None:
        """Сохраняет обученную модель на диск."""
        joblib.dump(self.model, config.MODEL_DEAL_PREDICTOR)
        logger.info("Модель deal_predictor сохранена: %s", config.MODEL_DEAL_PREDICTOR)

    def _load_model(self) -> None:
        """Загружает модель с диска если существует."""
        if config.MODEL_DEAL_PREDICTOR.exists():
            try:
                self.model = joblib.load(config.MODEL_DEAL_PREDICTOR)
                logger.info("Модель deal_predictor загружена из %s", config.MODEL_DEAL_PREDICTOR)
            except Exception as exc:
                logger.warning("Не удалось загрузить модель: %s. Нужно переобучить.", exc)
                self.model = None

    # ----------------------------------------------------------------
    # Обучение
    # ----------------------------------------------------------------

    def train(self, days_back: int = 365) -> dict:
        """
        Обучает ансамбль на исторических данных из Б24.

        :param days_back: Глубина истории в днях
        :return: Метрики качества
        """
        logger.info("Начало обучения DealPredictor (история %d дней)...", days_back)

        # 1. Загружаем закрытые сделки
        closed_deals = self.client.get_closed_deals(days_back=days_back)
        if len(closed_deals) < 20:
            raise ValueError(
                f"Недостаточно данных для обучения: {len(closed_deals)} сделок "
                f"(нужно ≥ 20). Увеличьте days_back или проверьте подключение."
            )

        # 2. Получаем активности
        activities = self.client.get_activities(days_back=days_back)

        # 3. История компаний
        company_history = _compute_company_history(closed_deals)

        # 4. Строим фичи
        df = _build_features(closed_deals, activities, company_history)

        # 5. Целевая переменная: 1 = WON, 0 = LOSE
        stage_map = {d["ID"]: d.get("STAGE_ID", "") for d in closed_deals}
        df["target"] = df["deal_id"].apply(
            lambda did: 1 if stage_map.get(str(did)) == "WON" else 0
        )

        X = df[self.feature_names].fillna(0)
        y = df["target"]

        if y.nunique() < 2:
            raise ValueError("В данных присутствует только один класс — невозможно обучить.")

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 6. Определяем ансамбль
        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(
                C=1.0, max_iter=500, class_weight="balanced", random_state=42
            )),
        ])

        self.model = VotingClassifier(
            estimators=[("rf", rf), ("lr", lr)],
            voting="soft",
            weights=[2, 1],   # RF важнее на табличных данных
        )

        self.model.fit(X_train, y_train)

        # 7. Оцениваем
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        y_pred = self.model.predict(X_test)
        auc = roc_auc_score(y_test, y_pred_proba)
        report = classification_report(y_test, y_pred, output_dict=True)

        logger.info("DealPredictor обучен. AUC=%.3f, precision=%.3f, recall=%.3f",
                    auc,
                    report.get("1", {}).get("precision", 0),
                    report.get("1", {}).get("recall", 0))

        # 8. Сохраняем
        self._save_model()

        return {
            "auc": round(auc, 4),
            "precision": round(report.get("1", {}).get("precision", 0), 4),
            "recall": round(report.get("1", {}).get("recall", 0), 4),
            "train_size": len(X_train),
            "test_size": len(X_test),
        }

    # ----------------------------------------------------------------
    # Прогноз
    # ----------------------------------------------------------------

    def predict_and_update(self) -> list[PredictionResult]:
        """
        Прогнозирует вероятность для всех активных сделок
        и записывает результат в Б24.

        :return: Список результатов
        """
        if self.model is None:
            raise RuntimeError(
                "Модель не обучена. Сначала вызовите DealPredictor.train()."
            )

        logger.info("Запуск прогноза для активных сделок...")

        active_deals = self.client.get_active_deals()
        if not active_deals:
            logger.warning("Активных сделок не найдено.")
            return []

        # Загружаем историю для feature engineering
        closed_deals = self.client.get_closed_deals(days_back=730)
        activities = self.client.get_activities(days_back=180)
        company_history = _compute_company_history(closed_deals)

        df = _build_features(active_deals, activities, company_history)
        if df.empty:
            logger.warning("Не удалось построить фичи для активных сделок.")
            return []

        X = df[self.feature_names].fillna(0)

        # Вероятности
        proba = self.model.predict_proba(X)[:, 1]

        # Важность признаков (из RF-компоненты ансамбля)
        rf_estimator = self.model.estimators_[0]
        if hasattr(rf_estimator, "named_steps"):
            rf_estimator = rf_estimator.named_steps.get("clf", rf_estimator)

        feature_importances = (
            rf_estimator.feature_importances_
            if hasattr(rf_estimator, "feature_importances_")
            else np.ones(len(self.feature_names)) / len(self.feature_names)
        )

        results: list[PredictionResult] = []

        for idx, row in df.iterrows():
            deal_id = int(row["deal_id"])
            prob = float(proba[idx])
            prob_pct = min(100, max(0, round(prob * 100)))

            # Топ-3 фактора: произведение важности × нормализованного значения
            feat_vals = X.iloc[idx].values.astype(float)
            feat_max = np.abs(feat_vals).max() or 1.0
            scores = feature_importances * (np.abs(feat_vals) / feat_max)
            top_idx = np.argsort(scores)[::-1][:3]
            top_factors = [self.feature_names[i] for i in top_idx]

            # Запись в Б24
            written = self.client.update_deal(
                deal_id,
                {config.FIELD_WIN_PROBABILITY: prob_pct},
            )

            results.append(PredictionResult(
                deal_id=deal_id,
                probability=prob,
                probability_pct=prob_pct,
                top_factors=top_factors,
                written_to_b24=written,
            ))

        logger.info(
            "Прогноз завершён: %d сделок, записано в Б24: %d",
            len(results),
            sum(1 for r in results if r.written_to_b24),
        )
        return results
