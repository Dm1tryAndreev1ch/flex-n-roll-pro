# FNR Sales Analytics 📊

**AI-модуль аналитики продаж для типографии FLEX-N-ROLL PRO**

Интеллектуальный анализ данных из Битрикс24 CRM: прогнозирование выручки, предсказание оттока клиентов, RFM-сегментация и автоматическая генерация отчётов.

---

## 🚀 Быстрый старт

```bash
# 1. Установить зависимости
make install

# 2. Настроить переменные окружения
cp .env.example .env
# Заполнить BITRIX24_WEBHOOK_URL в .env

# 3. Запустить недельный отчёт
make weekly
```

## 📦 Установка

```bash
# Через pip
python3 -m pip install -r requirements.txt

# Или через make
make install
```

## 🔧 Конфигурация

Скопируйте `.env.example` в `.env` и заполните переменные:

| Переменная | Описание | По умолчанию |
|---|---|---|
| `BITRIX24_WEBHOOK_URL` | URL вебхука Битрикс24 | — |
| `DATA_CACHE_DIR` | Директория кэша данных | `./data/cache` |
| `REPORTS_OUTPUT_DIR` | Директория отчётов | `./reports` |
| `CHURN_THRESHOLD_DAYS` | Порог оттока (дней без заказов) | `90` |
| `FORECAST_MONTHS_AHEAD` | Горизонт прогноза (месяцев) | `3` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |

## 📋 Команды

### CLI
```bash
python src/main.py weekly          # Недельный отчёт
python src/main.py monthly         # Месячный отчёт
python src/main.py churn           # Анализ оттока клиентов
python src/main.py segment         # RFM-сегментация
python src/main.py forecast        # Прогноз выручки
python src/main.py export --format xlsx  # Экспорт в Excel
```

### Make
```bash
make weekly    # Недельный отчёт
make monthly   # Месячный отчёт
make churn     # Анализ оттока
make segment   # RFM-сегментация
make forecast  # Прогноз выручки
make export    # Экспорт в Excel
make report    # Все отчёты
make clean     # Очистка кэша
```

## 📊 Модули аналитики

### 1. Прогноз выручки (`forecast`)
- Временной ряд по месяцам
- Линейная регрессия с сезонными компонентами
- Прогноз на 3 месяца вперёд
- 95% доверительный интервал

### 2. Предсказание оттока (`churn`)
- RandomForest классификатор
- Признаки: давность заказа, частота, средний чек, разнообразие продуктов
- Уровни риска: HIGH (>0.7), MEDIUM (0.4–0.7), LOW (<0.4)
- Рекомендации по удержанию

### 3. RFM-сегментация (`segment`)
- Recency / Frequency / Monetary анализ
- Квартильный скоринг 1–4
- Сегменты: Champions, Loyal, At Risk, Lost, New, Promising

### 4. Отчёты
- **Недельный**: конверсия, топ-сделки, сделки под риском
- **Месячный**: KPI, динамика, сравнение с прошлым месяцем
- **Excel**: многостраничный отчёт со стилизацией

## 🏗️ Структура проекта

```
fnr-analytics/
├── src/
│   ├── main.py              — CLI точка входа
│   ├── data/
│   │   ├── loader.py        — загрузка из Битрикс24 / CSV
│   │   └── preprocessor.py  — очистка и трансформация
│   ├── models/
│   │   ├── churn.py         — предсказание оттока
│   │   ├── forecast.py      — прогноз выручки
│   │   └── segmentation.py  — RFM-сегментация
│   ├── reports/
│   │   ├── weekly.py        — недельный отчёт
│   │   ├── monthly.py       — месячный отчёт
│   │   └── excel_export.py  — экспорт в Excel
│   └── utils/
│       ├── bitrix_client.py — клиент Битрикс24 API
│       └── logger.py        — логирование
├── config/settings.py       — конфигурация
├── requirements.txt
├── .env.example
├── README.md
└── Makefile
```

## 📝 Лицензия

© 2026 FLEX-N-ROLL PRO. Внутренний инструмент аналитики.
