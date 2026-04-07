.PHONY: install weekly monthly churn segment forecast export report clean help

PYTHON = python3
SRC = src/main.py

help: ## Показать справку
	@echo "╔══════════════════════════════════════════════════╗"
	@echo "║   FNR Sales Analytics — FLEX-N-ROLL PRO         ║"
	@echo "╠══════════════════════════════════════════════════╣"
	@echo "║  make install   — установить зависимости        ║"
	@echo "║  make weekly    — недельный отчёт                ║"
	@echo "║  make monthly   — месячный отчёт                ║"
	@echo "║  make churn     — анализ оттока                 ║"
	@echo "║  make segment   — RFM-сегментация               ║"
	@echo "║  make forecast  — прогноз выручки               ║"
	@echo "║  make export    — экспорт в Excel               ║"
	@echo "║  make report    — полный отчёт (все модули)     ║"
	@echo "║  make clean     — очистить кэш и отчёты         ║"
	@echo "╚══════════════════════════════════════════════════╝"

install: ## Установить зависимости
	$(PYTHON) -m pip install -r requirements.txt
	@mkdir -p data/cache reports
	@echo "✅ Зависимости установлены"

weekly: ## Сгенерировать недельный отчёт
	$(PYTHON) $(SRC) weekly

monthly: ## Сгенерировать месячный отчёт
	$(PYTHON) $(SRC) monthly

churn: ## Предсказание оттока клиентов
	$(PYTHON) $(SRC) churn

segment: ## RFM-сегментация клиентов
	$(PYTHON) $(SRC) segment

forecast: ## Прогноз выручки
	$(PYTHON) $(SRC) forecast

export: ## Экспорт в Excel
	$(PYTHON) $(SRC) export --format xlsx

report: ## Полный отчёт (все модули)
	$(PYTHON) $(SRC) weekly
	$(PYTHON) $(SRC) monthly
	$(PYTHON) $(SRC) churn
	$(PYTHON) $(SRC) segment
	$(PYTHON) $(SRC) forecast
	$(PYTHON) $(SRC) export --format xlsx
	@echo "✅ Все отчёты сгенерированы"

clean: ## Очистить кэш и временные файлы
	rm -rf data/cache/*.parquet
	rm -rf reports/*.txt reports/*.xlsx
	rm -rf __pycache__ src/__pycache__ src/**/__pycache__
	@echo "🧹 Кэш и отчёты очищены"
