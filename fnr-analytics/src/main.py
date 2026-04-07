"""
FNR Sales Analytics — точка входа CLI.

Команды:
    python main.py weekly          — недельный отчёт
    python main.py monthly         — месячный отчёт
    python main.py churn           — отчёт по рискам оттока
    python main.py segment         — RFM-сегментация
    python main.py forecast        — прогноз выручки
    python main.py export --format xlsx  — полный экспорт в Excel
"""

import argparse
import sys
from pathlib import Path

# Добавляем корень проекта в sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.logger import setup_logger, get_logger
from src.data.loader import DataLoader
from src.data.preprocessor import DataPreprocessor
from src.models.churn import ChurnPredictor
from src.models.forecast import RevenueForecast
from src.models.segmentation import RFMSegmentation
from src.reports.weekly import WeeklyReport
from src.reports.monthly import MonthlyReport
from src.reports.excel_export import ExcelExporter

logger = get_logger("main")


def _load_and_preprocess(args: argparse.Namespace) -> tuple:
    """
    Загрузить и подготовить данные.

    Returns:
        (deals_df, companies_df, company_agg)
    """
    csv_path = getattr(args, "csv", None)
    use_api = not getattr(args, "no_api", False)

    loader = DataLoader(use_api=use_api)
    preprocessor = DataPreprocessor()

    # Загрузка
    raw_deals = loader.load_deals(csv_fallback=csv_path)
    companies_df = loader.load_companies()

    # Обработка
    deals_df = preprocessor.process_deals(raw_deals)

    # Агрегация по компаниям
    company_agg = preprocessor.aggregate_by_company(deals_df)

    return deals_df, companies_df, company_agg


def cmd_weekly(args: argparse.Namespace) -> None:
    """Недельный отчёт."""
    logger.info("═" * 50)
    logger.info("Запуск: Недельный отчёт")
    logger.info("═" * 50)

    deals_df, _, _ = _load_and_preprocess(args)
    report = WeeklyReport()
    text = report.generate(deals_df)
    print(text)


def cmd_monthly(args: argparse.Namespace) -> None:
    """Месячный отчёт."""
    logger.info("═" * 50)
    logger.info("Запуск: Месячный отчёт")
    logger.info("═" * 50)

    deals_df, companies_df, _ = _load_and_preprocess(args)
    report = MonthlyReport()
    text = report.generate(deals_df, companies_df)
    print(text)


def cmd_churn(args: argparse.Namespace) -> None:
    """Отчёт по рискам оттока."""
    logger.info("═" * 50)
    logger.info("Запуск: Предсказание оттока клиентов")
    logger.info("═" * 50)

    deals_df, companies_df, company_agg = _load_and_preprocess(args)

    if company_agg.empty:
        logger.error("Нет данных для анализа оттока")
        return

    predictor = ChurnPredictor()
    churn_df = predictor.predict(company_agg, companies_df)

    # Вывод в консоль
    print("\n╔══════════════════════════════════════════════════════╗")
    print("║     ПРЕДСКАЗАНИЕ РИСКА ОТТОКА КЛИЕНТОВ             ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    # HIGH-риск
    high_risk = churn_df[churn_df["risk_level"] == "HIGH"]
    if not high_risk.empty:
        print("🔴 КЛИЕНТЫ С ВЫСОКИМ РИСКОМ ОТТОКА:")
        print("─" * 70)
        for _, row in high_risk.iterrows():
            print(f"  {row['company_name'][:35]:35s} │ "
                  f"Риск: {row['churn_probability']:.0%} │ "
                  f"Дней без заказов: {row['days_since_last_order']:.0f}")
            print(f"  {'':35s} │ {row['recommended_action']}")
            print()

    # Сводка
    print("\n📊 СВОДКА:")
    print(f"  HIGH:   {len(churn_df[churn_df['risk_level'] == 'HIGH']):3d} компаний")
    print(f"  MEDIUM: {len(churn_df[churn_df['risk_level'] == 'MEDIUM']):3d} компаний")
    print(f"  LOW:    {len(churn_df[churn_df['risk_level'] == 'LOW']):3d} компаний")


def cmd_segment(args: argparse.Namespace) -> None:
    """RFM-сегментация."""
    logger.info("═" * 50)
    logger.info("Запуск: RFM-сегментация")
    logger.info("═" * 50)

    deals_df, companies_df, company_agg = _load_and_preprocess(args)

    if company_agg.empty:
        logger.error("Нет данных для сегментации")
        return

    segmenter = RFMSegmentation()
    rfm_df = segmenter.segment(company_agg, companies_df)
    summary = segmenter.get_summary(rfm_df)

    # Вывод в консоль
    print("\n╔══════════════════════════════════════════════════════╗")
    print("║     RFM-СЕГМЕНТАЦИЯ КЛИЕНТОВ                       ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    print(f"  Всего компаний: {summary['total_companies']}")
    print(f"  Общая выручка:  {summary['total_revenue']:,.2f} BYN\n")

    print("  Сегменты:")
    print("  " + "─" * 65)
    for segment, data in summary.get("segments", {}).items():
        print(f"  {segment:20s} │ {data['count']:3d} компаний ({data['share_pct']:5.1f}%) │ "
              f"Выручка: {data['total_revenue']:>12,.0f} BYN ({data['revenue_share_pct']:.1f}%)")

    print("\n  Детали по компаниям:")
    print("  " + "─" * 80)
    for _, row in rfm_df.head(20).iterrows():
        print(f"  {row['company_name'][:30]:30s} │ {row['segment']:18s} │ "
              f"R{row['r_score']}F{row['f_score']}M{row['m_score']} │ "
              f"{row['monetary']:>12,.0f} BYN")


def cmd_forecast(args: argparse.Namespace) -> None:
    """Прогноз выручки."""
    logger.info("═" * 50)
    logger.info("Запуск: Прогноз выручки")
    logger.info("═" * 50)

    deals_df, _, _ = _load_and_preprocess(args)

    forecaster = RevenueForecast()
    forecast_df = forecaster.predict(deals_df)
    summary = forecaster.get_summary(forecast_df)

    # Вывод в консоль
    print("\n╔══════════════════════════════════════════════════════╗")
    print("║     ПРОГНОЗ ВЫРУЧКИ                                ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    # Исторические данные
    historical = forecast_df[~forecast_df["is_forecast"]]
    if not historical.empty:
        print("  📊 Историческая выручка (последние 6 месяцев):")
        print("  " + "─" * 60)
        for _, row in historical.tail(6).iterrows():
            actual = row["actual"] if row["actual"] is not None else 0
            bar_len = min(30, int(actual / max(1, historical["actual"].max()) * 30))
            bar = "█" * bar_len
            print(f"  {row['month']:10s} │ {bar:30s} │ {actual:>12,.0f} BYN")

    # Прогноз
    future = forecast_df[forecast_df["is_forecast"]]
    if not future.empty:
        print(f"\n  🔮 Прогноз на {len(future)} мес.:")
        print("  " + "─" * 60)
        for _, row in future.iterrows():
            print(f"  {row['month']:10s} │ {row['forecast']:>12,.0f} BYN  "
                  f"(95% CI: {row['lower_ci']:>10,.0f} — {row['upper_ci']:>10,.0f})")

    # Тренд
    if "trend_direction" in summary:
        print(f"\n  Тренд: {summary['trend_direction']}")
        if summary.get("month_over_month_change"):
            print(f"  Изменение м/м: {summary['month_over_month_change']:+.1f}%")


def cmd_export(args: argparse.Namespace) -> None:
    """Полный экспорт в Excel."""
    logger.info("═" * 50)
    logger.info("Запуск: Экспорт в Excel")
    logger.info("═" * 50)

    deals_df, companies_df, company_agg = _load_and_preprocess(args)

    # Запуск всех моделей
    forecast_df = None
    rfm_df = None
    churn_df = None

    try:
        logger.info("Прогноз выручки...")
        forecaster = RevenueForecast()
        forecast_df = forecaster.predict(deals_df)
    except Exception as e:
        logger.warning("Ошибка прогноза: %s", e)

    if not company_agg.empty:
        try:
            logger.info("RFM-сегментация...")
            segmenter = RFMSegmentation()
            rfm_df = segmenter.segment(company_agg, companies_df)
        except Exception as e:
            logger.warning("Ошибка сегментации: %s", e)

        try:
            logger.info("Предсказание оттока...")
            predictor = ChurnPredictor()
            churn_df = predictor.predict(company_agg, companies_df)
        except Exception as e:
            logger.warning("Ошибка предсказания оттока: %s", e)

    # Экспорт
    exporter = ExcelExporter()
    filepath = exporter.export(
        forecast_df=forecast_df,
        rfm_df=rfm_df,
        churn_df=churn_df,
        deals_df=deals_df,
    )

    print(f"\n✅ Excel-отчёт сохранён: {filepath}")
    print(f"   Листы: Обзор, RFM-сегменты, Риск оттока, Прогноз")


def main() -> None:
    """Главная функция CLI."""
    setup_logger()

    parser = argparse.ArgumentParser(
        prog="fnr-analytics",
        description="🔬 FNR Sales Analytics — AI-аналитика продаж FLEX-N-ROLL PRO",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python src/main.py weekly              Недельный отчёт
  python src/main.py monthly             Месячный отчёт
  python src/main.py churn               Анализ оттока
  python src/main.py segment             RFM-сегментация
  python src/main.py forecast            Прогноз выручки
  python src/main.py export --format xlsx  Экспорт в Excel
  python src/main.py weekly --csv data.csv  Из CSV-файла
        """,
    )

    # Общие аргументы
    parser.add_argument(
        "--csv", type=str, default=None,
        help="Путь к CSV-файлу (вместо API)",
    )
    parser.add_argument(
        "--no-api", action="store_true",
        help="Не использовать Битрикс24 API (только кэш/CSV/демо)",
    )

    subparsers = parser.add_subparsers(dest="command", help="Доступные команды")

    # weekly
    sp_weekly = subparsers.add_parser("weekly", help="Недельный отчёт по продажам")
    sp_weekly.set_defaults(func=cmd_weekly)

    # monthly
    sp_monthly = subparsers.add_parser("monthly", help="Месячный отчёт по продажам")
    sp_monthly.set_defaults(func=cmd_monthly)

    # churn
    sp_churn = subparsers.add_parser("churn", help="Предсказание риска оттока клиентов")
    sp_churn.set_defaults(func=cmd_churn)

    # segment
    sp_segment = subparsers.add_parser("segment", help="RFM-сегментация клиентов")
    sp_segment.set_defaults(func=cmd_segment)

    # forecast
    sp_forecast = subparsers.add_parser("forecast", help="Прогноз выручки")
    sp_forecast.set_defaults(func=cmd_forecast)

    # export
    sp_export = subparsers.add_parser("export", help="Экспорт аналитики в файл")
    sp_export.add_argument(
        "--format", choices=["xlsx"], default="xlsx",
        help="Формат экспорта (по умолчанию: xlsx)",
    )
    sp_export.set_defaults(func=cmd_export)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Баннер
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║   🔬 FNR Sales Analytics v1.0                ║")
    print("  ║   FLEX-N-ROLL PRO — AI-аналитика продаж      ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()

    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\n⚠️ Прервано пользователем")
        sys.exit(130)
    except Exception as e:
        logger.exception("Критическая ошибка: %s", e)
        print(f"\n❌ Ошибка: {e}")
        sys.exit(1)

    print("\n✅ Готово!")


if __name__ == "__main__":
    main()
