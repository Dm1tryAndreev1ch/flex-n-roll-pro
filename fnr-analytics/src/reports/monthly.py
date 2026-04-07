"""
Генерация месячного отчёта по продажам.
"""

from pathlib import Path

import pandas as pd

from config.settings import REPORTS_OUTPUT_DIR, DEAL_STAGES
from src.models.forecast import RevenueForecast
from src.models.segmentation import RFMSegmentation
from src.data.preprocessor import DataPreprocessor
from src.utils.logger import get_logger

logger = get_logger("reports.monthly")


class MonthlyReport:
    """
    Месячный отчёт по продажам FLEX-N-ROLL PRO.

    Содержание:
    - KPI за месяц (выручка, сделки, конверсия, средний чек)
    - Сравнение с предыдущим месяцем
    - Динамика по неделям
    - Топ-5 клиентов по выручке
    - Распределение по категориям продукции
    - Прогноз на следующий месяц
    - RFM-сводка
    """

    def generate(
        self,
        deals_df: pd.DataFrame,
        companies_df: pd.DataFrame | None = None,
    ) -> str:
        """
        Сгенерировать месячный отчёт.

        Args:
            deals_df: Обработанный DataFrame сделок.
            companies_df: DataFrame компаний (для имён).

        Returns:
            Текст отчёта.
        """
        now = pd.Timestamp.now()
        current_month = now.to_period("M")
        prev_month = current_month - 1

        lines = [
            "╔══════════════════════════════════════════════════════════════════╗",
            "║         FLEX-N-ROLL PRO — МЕСЯЧНЫЙ ОТЧЁТ ПО ПРОДАЖАМ          ║",
            f"║         Период: {current_month}                                          ║",
            "╚══════════════════════════════════════════════════════════════════╝",
            "",
        ]

        # Фильтрация по периодам
        cm_deals = deals_df[deals_df["DATE_CREATE"].dt.to_period("M") == current_month]
        pm_deals = deals_df[deals_df["DATE_CREATE"].dt.to_period("M") == prev_month]

        cm_won = cm_deals[cm_deals["is_won"]]
        pm_won = pm_deals[pm_deals["is_won"]]

        # ── 1. KPI ──
        lines.append("📊 КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ (KPI):")
        lines.append("═" * 60)

        kpis = self._calculate_kpis(cm_deals, cm_won, pm_deals, pm_won)
        for kpi_name, kpi_data in kpis.items():
            change = kpi_data.get("change", "")
            change_str = f"  ({change})" if change else ""
            lines.append(f"   {kpi_name:30s} │ {kpi_data['value']:>15s}{change_str}")

        lines.append("")

        # ── 2. Динамика по неделям ──
        lines.append("📈 ДИНАМИКА ПО НЕДЕЛЯМ:")
        lines.append("─" * 60)
        weekly_data = self._weekly_breakdown(cm_won)
        for week, data in weekly_data.items():
            bar_len = min(30, int(data["revenue"] / max(1, max(w["revenue"] for w in weekly_data.values())) * 30))
            bar = "█" * bar_len + "░" * (30 - bar_len)
            lines.append(
                f"   Неделя {week} │ {bar} │ {data['revenue']:>12,.0f} BYN ({data['count']} сд.)"
            )
        lines.append("")

        # ── 3. Топ-5 клиентов ──
        lines.append("🏆 ТОП-5 КЛИЕНТОВ ПО ВЫРУЧКЕ:")
        lines.append("─" * 60)
        if not cm_won.empty:
            top_clients = cm_won.groupby("COMPANY_ID").agg(
                revenue=("OPPORTUNITY", "sum"),
                orders=("ID", "count"),
            ).nlargest(5, "revenue").reset_index()

            company_names = {}
            if companies_df is not None and "TITLE" in companies_df.columns:
                company_names = companies_df.set_index("ID")["TITLE"].to_dict()

            for i, (_, row) in enumerate(top_clients.iterrows(), 1):
                name = company_names.get(row["COMPANY_ID"], f"Компания #{row['COMPANY_ID']}")
                lines.append(
                    f"   {i}. {name[:35]:35s} │ {row['revenue']:>12,.2f} BYN │ {int(row['orders'])} заказов"
                )
        else:
            lines.append("   Нет данных о выигранных сделках за месяц")
        lines.append("")

        # ── 4. Распределение по категориям ──
        lines.append("📦 РАСПРЕДЕЛЕНИЕ ПО КАТЕГОРИЯМ ПРОДУКЦИИ:")
        lines.append("─" * 60)
        if not cm_won.empty and "product_category" in cm_won.columns:
            cat_stats = cm_won.groupby("product_category").agg(
                revenue=("OPPORTUNITY", "sum"),
                count=("ID", "count"),
            ).sort_values("revenue", ascending=False)

            total_rev = cat_stats["revenue"].sum()
            for cat, row in cat_stats.iterrows():
                pct = row["revenue"] / total_rev * 100 if total_rev > 0 else 0
                bar = "█" * int(pct / 3) + "░" * (20 - int(pct / 3))
                lines.append(
                    f"   {cat:25s} │ {bar} │ {row['revenue']:>10,.0f} BYN ({pct:.1f}%)"
                )
        lines.append("")

        # ── 5. Конверсия воронки ──
        lines.append("🔄 КОНВЕРСИЯ ВОРОНКИ ЗА МЕСЯЦ:")
        lines.append("─" * 60)
        total_cm = len(cm_deals)
        if total_cm > 0:
            won_count = len(cm_won)
            lost_count = len(cm_deals[cm_deals["is_lost"]])
            active_count = total_cm - won_count - lost_count

            lines.append(f"   Всего сделок:     {total_cm}")
            lines.append(f"   Выигранных:       {won_count} ({won_count/total_cm*100:.1f}%)")
            lines.append(f"   Проигранных:      {lost_count} ({lost_count/total_cm*100:.1f}%)")
            lines.append(f"   В работе:         {active_count} ({active_count/total_cm*100:.1f}%)")
        lines.append("")

        # ── 6. Прогноз ──
        lines.append("🔮 ПРОГНОЗ ВЫРУЧКИ:")
        lines.append("─" * 60)
        try:
            forecaster = RevenueForecast(months_ahead=1)
            forecast_df = forecaster.predict(deals_df)
            summary = forecaster.get_summary(forecast_df)

            if "forecast_months" in summary and summary["forecast_months"]:
                f = summary["forecast_months"][0]
                lines.append(
                    f"   Следующий месяц ({f['month']}): "
                    f"{f['forecast']:,.0f} BYN "
                    f"(95% CI: {f['lower_ci']:,.0f} — {f['upper_ci']:,.0f})"
                )
            if "trend_direction" in summary:
                lines.append(f"   Тренд: {summary['trend_direction']}")
        except Exception as e:
            lines.append(f"   ⚠️ Недостаточно данных для прогноза: {e}")
        lines.append("")

        # ── Финал ──
        lines.append("═" * 60)
        lines.append(f"Отчёт сгенерирован: {now.strftime('%d.%m.%Y %H:%M')}")
        lines.append("FLEX-N-ROLL PRO — AI Sales Analytics")

        report = "\n".join(lines)

        # Сохранение
        output_dir = Path(REPORTS_OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = output_dir / f"monthly_{current_month}.txt"
        filename.write_text(report, encoding="utf-8")
        logger.info("Месячный отчёт сохранён: %s", filename)

        return report

    @staticmethod
    def _calculate_kpis(
        cm_deals: pd.DataFrame,
        cm_won: pd.DataFrame,
        pm_deals: pd.DataFrame,
        pm_won: pd.DataFrame,
    ) -> dict:
        """Рассчитать KPI с изменением к прошлому месяцу."""

        def _change(current: float, previous: float) -> str:
            if previous == 0:
                return "—"
            diff = (current - previous) / previous * 100
            arrow = "↑" if diff > 0 else "↓" if diff < 0 else "→"
            return f"{arrow} {abs(diff):.1f}%"

        cm_revenue = cm_won["OPPORTUNITY"].sum() if not cm_won.empty else 0
        pm_revenue = pm_won["OPPORTUNITY"].sum() if not pm_won.empty else 0

        cm_avg = cm_won["OPPORTUNITY"].mean() if not cm_won.empty else 0
        pm_avg = pm_won["OPPORTUNITY"].mean() if not pm_won.empty else 0

        return {
            "Выручка (выигранные)": {
                "value": f"{cm_revenue:,.2f} BYN",
                "change": _change(cm_revenue, pm_revenue),
            },
            "Количество сделок": {
                "value": str(len(cm_deals)),
                "change": _change(len(cm_deals), len(pm_deals)),
            },
            "Выигранных сделок": {
                "value": str(len(cm_won)),
                "change": _change(len(cm_won), len(pm_won)),
            },
            "Средний чек": {
                "value": f"{cm_avg:,.2f} BYN",
                "change": _change(cm_avg, pm_avg),
            },
            "Средняя длительность (дн.)": {
                "value": f"{cm_won['deal_duration_days'].mean():.1f}" if not cm_won.empty else "—",
            },
        }

    @staticmethod
    def _weekly_breakdown(won_deals: pd.DataFrame) -> dict:
        """Разбивка выигранных сделок по неделям месяца."""
        result = {}
        if won_deals.empty:
            return {"1": {"revenue": 0, "count": 0}}

        won_deals = won_deals.copy()
        won_deals["week_num"] = won_deals["DATE_CREATE"].dt.isocalendar().week.astype(int)
        weeks = sorted(won_deals["week_num"].unique())

        for i, week in enumerate(weeks, 1):
            week_data = won_deals[won_deals["week_num"] == week]
            result[str(i)] = {
                "revenue": week_data["OPPORTUNITY"].sum(),
                "count": len(week_data),
            }

        return result
