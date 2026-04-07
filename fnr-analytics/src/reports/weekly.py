"""
Генерация недельного отчёта по продажам.
"""

from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from config.settings import REPORTS_OUTPUT_DIR, DEAL_STAGES
from src.utils.logger import get_logger

logger = get_logger("reports.weekly")


class WeeklyReport:
    """
    Недельный отчёт по продажам FLEX-N-ROLL PRO.

    Содержание:
    - Новые лиды за неделю
    - Конверсия по стадиям воронки
    - Топ-3 сделки в работе
    - Сделки под риском (нет движения >7 дней)
    - Выигранные / проигранные сделки
    - Рекомендации менеджерам
    """

    def generate(self, deals_df: pd.DataFrame) -> str:
        """
        Сгенерировать недельный отчёт.

        Args:
            deals_df: Обработанный DataFrame сделок.

        Returns:
            Текст отчёта.
        """
        now = pd.Timestamp.now()
        week_ago = now - pd.Timedelta(days=7)
        report_date = now.strftime("%d.%m.%Y")

        lines = [
            "╔══════════════════════════════════════════════════════════════╗",
            "║         FLEX-N-ROLL PRO — НЕДЕЛЬНЫЙ ОТЧЁТ ПО ПРОДАЖАМ     ║",
            f"║         Период: {(week_ago).strftime('%d.%m')} – {report_date}                          ║",
            "╚══════════════════════════════════════════════════════════════╝",
            "",
        ]

        # 1. Новые лиды
        new_deals = deals_df[deals_df["DATE_CREATE"] >= week_ago]
        lines.append(f"📥 НОВЫЕ ЛИДЫ ЗА НЕДЕЛЮ: {len(new_deals)}")
        if not new_deals.empty:
            total_value = new_deals["OPPORTUNITY"].sum()
            lines.append(f"   Общая стоимость: {total_value:,.2f} BYN")
            lines.append(f"   Средний чек: {new_deals['OPPORTUNITY'].mean():,.2f} BYN")
        lines.append("")

        # 2. Конверсия по стадиям
        lines.append("📊 ВОРОНКА ПРОДАЖ (все активные сделки):")
        lines.append("─" * 55)
        active = deals_df[deals_df["is_active"]]
        if not active.empty:
            stage_counts = active["STAGE_ID"].value_counts()
            total_active = len(active)
            for stage_id in ["NEW", "PREPARATION", "PREPAYMENT_INVOICE", "EXECUTING", "FINAL_INVOICE"]:
                count = stage_counts.get(stage_id, 0)
                name = DEAL_STAGES.get(stage_id, stage_id)
                pct = count / total_active * 100 if total_active > 0 else 0
                bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
                lines.append(f"   {name:20s} │ {bar} │ {count:3d} ({pct:5.1f}%)")
        lines.append("")

        # 3. Топ-3 сделки в работе
        lines.append("🔥 ТОП-3 СДЕЛКИ В РАБОТЕ:")
        lines.append("─" * 55)
        in_work = active.nlargest(3, "OPPORTUNITY")
        for _, deal in in_work.iterrows():
            stage_name = DEAL_STAGES.get(deal["STAGE_ID"], deal["STAGE_ID"])
            lines.append(
                f"   • {deal['TITLE'][:40]:40s}"
            )
            lines.append(
                f"     {deal['OPPORTUNITY']:>12,.2f} BYN │ {stage_name}"
            )
        lines.append("")

        # 4. Сделки под риском
        lines.append("⚠️  СДЕЛКИ ПОД РИСКОМ (нет движения >7 дней):")
        lines.append("─" * 55)
        if "days_since_last_modify" in deals_df.columns:
            at_risk = active[active["days_since_last_modify"] > 7].sort_values(
                "days_since_last_modify", ascending=False
            )
            if not at_risk.empty:
                for _, deal in at_risk.head(10).iterrows():
                    days = int(deal["days_since_last_modify"])
                    lines.append(
                        f"   🔴 {deal['TITLE'][:35]:35s} │ {days} дн. без движения │ "
                        f"{deal['OPPORTUNITY']:>10,.2f} BYN"
                    )
            else:
                lines.append("   ✅ Нет сделок под риском")
        lines.append("")

        # 5. Выигранные / проигранные за неделю
        won_week = deals_df[
            (deals_df["is_won"]) &
            (deals_df["CLOSEDATE"] >= week_ago)
        ]
        lost_week = deals_df[
            (deals_df["is_lost"]) &
            (deals_df["CLOSEDATE"] >= week_ago)
        ]

        lines.append("✅ ВЫИГРАННЫЕ СДЕЛКИ ЗА НЕДЕЛЮ:")
        lines.append("─" * 55)
        if not won_week.empty:
            lines.append(f"   Количество: {len(won_week)}")
            lines.append(f"   Сумма: {won_week['OPPORTUNITY'].sum():,.2f} BYN")
            for _, deal in won_week.head(5).iterrows():
                lines.append(f"   ✅ {deal['TITLE'][:45]} — {deal['OPPORTUNITY']:,.2f} BYN")
        else:
            lines.append("   Нет выигранных сделок за период")
        lines.append("")

        lines.append("❌ ПРОИГРАННЫЕ СДЕЛКИ ЗА НЕДЕЛЮ:")
        lines.append("─" * 55)
        if not lost_week.empty:
            lines.append(f"   Количество: {len(lost_week)}")
            lines.append(f"   Потерянная выручка: {lost_week['OPPORTUNITY'].sum():,.2f} BYN")
            for _, deal in lost_week.head(5).iterrows():
                lines.append(f"   ❌ {deal['TITLE'][:45]} — {deal['OPPORTUNITY']:,.2f} BYN")
        else:
            lines.append("   Нет проигранных сделок за период")
        lines.append("")

        # 6. Win rate за неделю
        total_closed = len(won_week) + len(lost_week)
        if total_closed > 0:
            win_rate = len(won_week) / total_closed * 100
            lines.append(f"📈 WIN RATE ЗА НЕДЕЛЮ: {win_rate:.1f}%")
        lines.append("")

        # 7. Рекомендации
        lines.append("💡 РЕКОМЕНДАЦИИ МЕНЕДЖЕРАМ:")
        lines.append("─" * 55)
        recommendations = self._generate_recommendations(
            deals_df, new_deals, at_risk if "days_since_last_modify" in deals_df.columns else pd.DataFrame(),
            won_week, lost_week,
        )
        for rec in recommendations:
            lines.append(f"   {rec}")
        lines.append("")

        lines.append("─" * 55)
        lines.append(f"Отчёт сгенерирован: {now.strftime('%d.%m.%Y %H:%M')}")
        lines.append("FLEX-N-ROLL PRO — AI Sales Analytics")

        report = "\n".join(lines)

        # Сохранение в файл
        output_dir = Path(REPORTS_OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = output_dir / f"weekly_{now.strftime('%Y-%m-%d')}.txt"
        filename.write_text(report, encoding="utf-8")
        logger.info("Недельный отчёт сохранён: %s", filename)

        return report

    @staticmethod
    def _generate_recommendations(
        all_deals: pd.DataFrame,
        new_deals: pd.DataFrame,
        at_risk: pd.DataFrame,
        won: pd.DataFrame,
        lost: pd.DataFrame,
    ) -> list[str]:
        """Автоматическая генерация рекомендаций."""
        recs = []

        # Анализ новых лидов
        if len(new_deals) < 5:
            recs.append("📋 Мало новых лидов. Рассмотрите усиление маркетинговой активности.")
        elif len(new_deals) > 20:
            recs.append("🎯 Много новых лидов! Убедитесь, что все обработаны в течение 2 часов.")

        # Сделки под риском
        if not at_risk.empty:
            top_risk = at_risk.head(3)
            total_risk_value = at_risk["OPPORTUNITY"].sum()
            recs.append(
                f"⚠️ {len(at_risk)} сделок без движения. Под риском: {total_risk_value:,.0f} BYN. "
                f"Приоритетно обработайте топ-3."
            )

        # Win rate
        total_closed = len(won) + len(lost)
        if total_closed > 0:
            wr = len(won) / total_closed
            if wr < 0.4:
                recs.append(
                    "📉 Win rate ниже 40%. Проанализируйте причины проигрышей, "
                    "скорректируйте скрипты продаж."
                )
            elif wr > 0.7:
                recs.append("🚀 Отличный win rate! Масштабируйте текущий подход.")

        # Средний чек
        if not won.empty:
            avg_check = won["OPPORTUNITY"].mean()
            if avg_check < 15000:
                recs.append(
                    "💰 Средний чек ниже 15 000 BYN. "
                    "Рассмотрите кросс-продажи и допродажи."
                )

        if not recs:
            recs.append("✅ Показатели в норме. Продолжайте в том же духе!")

        return recs
