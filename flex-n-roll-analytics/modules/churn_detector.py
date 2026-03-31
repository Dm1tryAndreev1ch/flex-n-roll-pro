"""
churn_detector.py — Определение вероятности оттока клиентов.

Признаки:
  - days_since_last_order: дней с последнего заказа
  - orders_per_year:       частота заказов (за последний год)
  - freq_trend:            тренд частоты (>0 растёт, <0 падает)
  - avg_check_change:      изменение среднего чека (последние 6 мес. vs. предыдущие)

Пороги (HIGH / MEDIUM / LOW):
  HIGH:   снижение частоты ≥30% ИЛИ дней без заказа ≥180
  MEDIUM: снижение частоты ≥15% ИЛИ дней без заказа ≥90
  LOW:    остальные активные клиенты

Выход:
  - Список клиентов с churn_risk и рекомендуемым действием
  - Запись риска в поле UF_CRM_CHURN_RISK
  - Создание задачи менеджеру для HIGH-риска
"""

import logging
from datetime import datetime, timedelta
from typing import NamedTuple
from collections import defaultdict

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Константы
# ---------------------------------------------------------------------------

RISK_HIGH   = "HIGH"
RISK_MEDIUM = "MEDIUM"
RISK_LOW    = "LOW"

ACTIONS: dict[str, str] = {
    RISK_HIGH: (
        "Немедленно позвонить клиенту. Выяснить причину паузы. "
        "Предложить специальные условия / персональную скидку."
    ),
    RISK_MEDIUM: (
        "Отправить письмо с новинками ассортимента. "
        "Пригласить на презентацию новых технологий печати."
    ),
    RISK_LOW: (
        "Плановое поддерживающее взаимодействие. "
        "Убедиться, что все текущие заказы в работе."
    ),
}


# ---------------------------------------------------------------------------
# Структуры данных
# ---------------------------------------------------------------------------

class ChurnResult(NamedTuple):
    company_id: int
    company_name: str
    responsible_id: int
    churn_risk: str
    days_since_last_order: int
    orders_per_year: float
    freq_trend_pct: float
    avg_check_change_pct: float
    recommended_action: str
    ml_churn_probability: float
    task_created: bool


# ---------------------------------------------------------------------------
# Вычисление признаков
# ---------------------------------------------------------------------------

def _compute_company_features(
    company_id: int,
    deals: list[dict],
    now: datetime,
) -> dict | None:
    """Рассчитывает churn-признаки для одной компании."""
    if not deals:
        return None

    order_dates: list[datetime] = []
    amounts: list[tuple[datetime, float]] = []

    for deal in deals:
        if deal.get("STAGE_ID") != "WON" or deal.get("CLOSED") != "Y":
            continue
        try:
            dt = datetime.fromisoformat(
                str(deal.get("DATE_MODIFY", "")).replace("Z", "+00:00")
            ).replace(tzinfo=None)
            order_dates.append(dt)
            amt = float(deal.get("OPPORTUNITY") or 0)
            amounts.append((dt, amt))
        except Exception:
            continue

    if not order_dates:
        return None

    order_dates.sort()
    now_naive = now.replace(tzinfo=None)

    last_order = max(order_dates)
    days_since = (now_naive - last_order).days

    year_ago = now_naive - timedelta(days=365)
    orders_last_year = sum(1 for d in order_dates if d >= year_ago)
    orders_per_year = float(orders_last_year)

    six_months_ago    = now_naive - timedelta(days=183)
    twelve_months_ago = now_naive - timedelta(days=365)

    orders_recent = sum(1 for d in order_dates if six_months_ago <= d <= now_naive)
    orders_prev   = sum(1 for d in order_dates if twelve_months_ago <= d < six_months_ago)

    if orders_prev > 0:
        freq_trend = (orders_recent - orders_prev) / orders_prev
    elif orders_recent > 0:
        freq_trend = 1.0
    else:
        freq_trend = 0.0

    recent_amounts = [a for dt, a in amounts if dt >= six_months_ago]
    prev_amounts   = [a for dt, a in amounts if twelve_months_ago <= dt < six_months_ago]

    avg_recent = np.mean(recent_amounts) if recent_amounts else 0.0
    avg_prev   = np.mean(prev_amounts)   if prev_amounts   else 0.0

    if avg_prev > 0:
        check_change = (avg_recent - avg_prev) / avg_prev
    elif avg_recent > 0:
        check_change = 1.0
    else:
        check_change = 0.0

    return {
        "company_id": company_id,
        "days_since_last_order": days_since,
        "orders_per_year": orders_per_year,
        "freq_trend": freq_trend,
        "avg_check_change": check_change,
        "order_count_total": len(order_dates),
    }


def _classify_risk_rules(features: dict) -> str:
    """Детерминистская классификация по бизнес-правилам."""
    days    = features["days_since_last_order"]
    f_trend = features["freq_trend"]
    c_change= features["avg_check_change"]

    if (
        days >= config.CHURN_HIGH_DAYS_SILENT
        or f_trend <= -config.CHURN_HIGH_FREQ_DROP
        or (f_trend <= -config.CHURN_MED_FREQ_DROP and c_change <= -config.CHURN_CHECK_DROP)
    ):
        return RISK_HIGH

    if (
        days >= config.CHURN_MED_DAYS_SILENT
        or f_trend <= -config.CHURN_MED_FREQ_DROP
        or c_change <= -config.CHURN_CHECK_DROP
    ):
        return RISK_MEDIUM

    return RISK_LOW


# ---------------------------------------------------------------------------
# Основной класс
# ---------------------------------------------------------------------------

class ChurnDetector:
    """
    Детектор оттока клиентов.
    Комбинирует пороговые правила + GradientBoosting для скоринга.
    """

    FEATURE_COLS = [
        "days_since_last_order",
        "orders_per_year",
        "freq_trend",
        "avg_check_change",
        "order_count_total",
    ]

    def __init__(self, client: BitrixClient):
        self.client = client
        self.model: Pipeline | None = None
        self._load_model()

    def _save_model(self) -> None:
        joblib.dump(self.model, config.MODEL_CHURN)
        logger.info("Модель churn сохранена: %s", config.MODEL_CHURN)

    def _load_model(self) -> None:
        if config.MODEL_CHURN.exists():
            try:
                self.model = joblib.load(config.MODEL_CHURN)
                logger.info("Модель churn загружена из %s", config.MODEL_CHURN)
            except Exception as exc:
                logger.warning("Не удалось загрузить churn модель: %s", exc)
                self.model = None

    def train(self, days_back: int = 730) -> dict:
        """
        Обучает ML-модель churn на исторических данных.

        :param days_back: Глубина истории
        :return: Метрики
        """
        logger.info("Обучение ChurnDetector (history=%d дней)...", days_back)

        closed_deals = self.client.get_closed_deals(days_back=days_back)
        by_company: dict[int, list[dict]] = defaultdict(list)
        for deal in closed_deals:
            cid = int(deal.get("COMPANY_ID") or 0)
            if cid > 0:
                by_company[cid].append(deal)

        now = datetime.now()
        rows: list[dict] = []

        for company_id, deals in by_company.items():
            feats = _compute_company_features(company_id, deals, now)
            if feats:
                rows.append(feats)

        if len(rows) < 20:
            logger.warning("Недостаточно данных для обучения churn модели: %d", len(rows))
            return {"status": "skipped", "reason": "insufficient_data"}

        df = pd.DataFrame(rows)
        df["label"] = df.apply(
            lambda r: 1 if _classify_risk_rules(r) == RISK_HIGH else 0,
            axis=1,
        )

        X = df[self.FEATURE_COLS].fillna(0)
        y = df["label"]

        if y.nunique() < 2:
            logger.warning("В данных только один класс churn-риска — пропускаем ML-обучение.")
            return {"status": "skipped", "reason": "single_class"}

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        self.model = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                random_state=42,
            )),
        ])
        self.model.fit(X_train, y_train)

        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_pred_proba)
        logger.info("ChurnDetector обучен. AUC=%.3f", auc)

        self._save_model()
        return {"auc": round(auc, 4), "samples": len(rows)}

    def detect_and_update(self) -> list[ChurnResult]:
        """
        Выполняет churn-анализ по всем компаниям с активными сделками
        и записывает риск в поля сделок.

        :return: Список результатов по компаниям
        """
        logger.info("Запуск churn detection...")

        active_deals = self.client.get_active_deals()
        closed_deals = self.client.get_closed_deals(days_back=730)
        all_deals = active_deals + closed_deals

        by_company: dict[int, list[dict]] = defaultdict(list)
        company_info: dict[int, dict] = {}

        for deal in all_deals:
            cid = int(deal.get("COMPANY_ID") or 0)
            if cid > 0:
                by_company[cid].append(deal)

        for deal in active_deals:
            cid = int(deal.get("COMPANY_ID") or 0)
            if cid > 0 and cid not in company_info:
                company_info[cid] = {
                    "name": deal.get("TITLE", f"Компания #{cid}"),
                    "manager_id": int(deal.get("ASSIGNED_BY_ID") or config.DEFAULT_RESPONSIBLE_ID),
                    "deal_id": int(deal["ID"]),
                }

        now = datetime.now()
        results: list[ChurnResult] = []
        active_companies = set(company_info.keys())

        for company_id in active_companies:
            feats = _compute_company_features(
                company_id, by_company.get(company_id, []), now
            )
            if feats is None:
                continue

            risk = _classify_risk_rules(feats)

            ml_prob = 0.0
            if self.model is not None:
                try:
                    X = pd.DataFrame([feats])[self.FEATURE_COLS].fillna(0)
                    ml_prob = float(self.model.predict_proba(X)[0, 1])
                except Exception as exc:
                    logger.warning("ML churn predict error для компании #%d: %s", company_id, exc)

            action = ACTIONS[risk]
            info = company_info.get(company_id, {})
            deal_id = info.get("deal_id", 0)
            manager_id = info.get("manager_id", config.DEFAULT_RESPONSIBLE_ID)

            if deal_id:
                self.client.update_deal(deal_id, {config.FIELD_CHURN_RISK: risk})

            task_created = False
            if risk == RISK_HIGH:
                title = f"⚠️ Churn HIGH: Клиент #{company_id} не делал заказ {feats['days_since_last_order']} дней"
                desc = (
                    f"AI-система выявила высокий риск потери клиента.\n\n"
                    f"Компания: #{company_id}\n"
                    f"Дней без заказа: {feats['days_since_last_order']}\n"
                    f"Заказов за год: {feats['orders_per_year']:.0f}\n"
                    f"Тренд частоты: {feats['freq_trend']:+.0%}\n"
                    f"Изменение чека: {feats['avg_check_change']:+.0%}\n"
                    f"ML-вероятность оттока: {ml_prob:.0%}\n\n"
                    f"Рекомендуемое действие:\n{action}\n\n"
                    f"Сгенерировано: {now.strftime('%d.%m.%Y %H:%M')}"
                )
                task_created = bool(
                    self.client.create_task(
                        title=title,
                        description=desc,
                        responsible_id=manager_id,
                        deadline=now + timedelta(days=1),
                        deal_id=deal_id if deal_id else None,
                    )
                )

            results.append(ChurnResult(
                company_id=company_id,
                company_name=info.get("name", f"#{company_id}"),
                responsible_id=manager_id,
                churn_risk=risk,
                days_since_last_order=feats["days_since_last_order"],
                orders_per_year=feats["orders_per_year"],
                freq_trend_pct=round(feats["freq_trend"] * 100, 1),
                avg_check_change_pct=round(feats["avg_check_change"] * 100, 1),
                recommended_action=action,
                ml_churn_probability=round(ml_prob, 4),
                task_created=task_created,
            ))

        risk_order = {RISK_HIGH: 0, RISK_MEDIUM: 1, RISK_LOW: 2}
        results.sort(key=lambda r: (risk_order.get(r.churn_risk, 3), -r.days_since_last_order))

        logger.info(
            "Churn detection завершён: HIGH=%d, MEDIUM=%d, LOW=%d",
            sum(1 for r in results if r.churn_risk == RISK_HIGH),
            sum(1 for r in results if r.churn_risk == RISK_MEDIUM),
            sum(1 for r in results if r.churn_risk == RISK_LOW),
        )
        return results
