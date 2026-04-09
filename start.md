# FLEX-N-ROLL PRO — Руководство по запуску

## О проекте

FLEX-N-ROLL PRO — монорепозиторий для типографии, специализирующейся на этикетках. Интегрируется с Bitrix24 CRM и автоматизирует приём заявок, аналитику звонков, маркировку Честного ЗНАКа и управление заказами.

### Сервисы

| Контейнер | Описание | Внутренний адрес |
|---|---|---|
| `fnr-webhook` | Приём событий Bitrix24, AI-классификация (LM Studio), роутинг по менеджерам | `fnr-webhook:3000` |
| `fnr-calculator` | Калькулятор стоимости этикеток (React SPA, nginx) | `fnr-calculator:80` |
| `fnr-calculator-api` | Express API калькулятора, интеграция с Bitrix24 | `fnr-calculator-api:3001` |
| `fnr-commanalysis` | AI-анализ звонков: транскрипция Whisper + оценка GPT | `fnr-commanalysis:3000` |
| `fnr-commanalysis-scheduler` | Ежедневные сводные отчёты (cron) | — |
| `fnr-status-bot` | Telegram-бот проверки статуса заказов | — (long-polling) |
| `fnr-marking` | Интеграция с Честным ЗНАКом (ГИС МТ), генерация DataMatrix | `fnr-marking:3000` |
| `fnr-analytics` | Дашборд аналитики (React SPA, nginx) — в `docker-compose.calculator.yml` | `fnr-analytics:80` |
| `fnr-redis` | Кэш, rate limiting, round-robin счётчики менеджеров | `fnr-redis:6379` |
| `fnr-prometheus`| Сбор и хранение метрик со всех сервисов | `fnr-prometheus:9090` |
| `fnr-grafana` | Визуализация метрик и дашборды | `fnr-grafana:3000` (host: 3001) |

Все сервисы (включая мониторинг) общаются через Docker-сеть `fnr-net` по именам контейнеров. Порты на хост не пробрасываются (кроме Grafana: 3001) — для доступа извне нужен reverse proxy (nginx/Traefik).

---

## Предварительные требования

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **LM Studio** запущен на хост-машине (для сервиса `webhook`)
- Аккаунт Bitrix24 с правами администратора
- Telegram Bot Token (от @BotFather)
- OpenAI API ключ (для сервиса `commanalysis`)
- Учётные данные ГИС МТ / Честный ЗНАК (для сервиса `marking`)

---

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/Dm1tryAndreev1ch/flex-n-roll-pro.git
cd flex-n-roll-pro
```

### 2. Создать `.env`

```bash
cp .env.example .env
```

Открыть `.env` и заполнить все обязательные переменные (см. раздел «Настройка .env»).

### 3. Запустить

```bash
docker compose up --build -d
```

### 4. Проверить статус

```bash
# Все контейнеры должны быть healthy / running
docker compose ps

# Проверить webhook
docker exec fnr-webhook curl -s http://localhost:3000/health

# Логи конкретного сервиса
docker compose logs -f webhook
docker compose logs -f commanalysis
```

### 5. Остановить

```bash
docker compose down

# С удалением данных (Redis, логи, файлы маркировки):
docker compose down -v
```

### 6. Запуск мониторинга (Grafana + Prometheus)

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

### Доступ к интерфейсам

| Сервис | URL (внутренний) | Данные для входа |
|---|---|---|
| **FNR Analytics** (Дашборд) | http://fnr-analytics:80 | Пароль: `fnr2024` (по умолчанию, настраивается в Settings) |
| **Grafana** (Метрики сервисов) | http://localhost:3001 | *См. переменные `GRAFANA_ADMIN_USER` и `GRAFANA_ADMIN_PASSWORD` в `.env`* |

---

## Настройка .env

Единый файл `.env` в корне репозитория читается всеми сервисами.

### Обязательные переменные

#### Bitrix24 — Входящий вебхук (для commanalysis, marking, fnr-status-bot)

Создать **входящий вебхук** в Bitrix24:  
`Настройки → Интеграции → Вебхуки → Входящий вебхук`  
Права: **CRM + Задачи + IM + Телефония**

```env
BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
BITRIX_PORTAL_DOMAIN=your-portal.bitrix24.ru
```

#### Bitrix24 — OAuth-приложение (webhook-сервис, получение событий)

Webhook-сервис использует OAuth для получения событий от Bitrix24 через ngrok-туннель.

**Шаг 1**: Создать **локальное приложение** в Bitrix24:  
`Разработчикам → Другое → Локальное приложение`

```env
BITRIX_CLIENT_ID=local.xxxxxxxx.xxxxxxxx
BITRIX_CLIENT_SECRET=xxxxxxxxxxxxxxxx
BITRIX_APP_TOKEN=xxxxxxxxxxxxxxxx
```

**Шаг 2**: Зарегистрироваться на [ngrok.com](https://ngrok.com) и получить authtoken:

```env
NGROK_AUTHTOKEN=xxxxxxxxxxxxxxxx
```

**Шаг 3**: Запустить и установить: `http://localhost:3000/install`

#### Telegram Bot

```env
BOT_TOKEN=токен_от_BotFather
MANAGER_CONTACT=@ваш_менеджер
MANAGER_PHONE=+375XXXXXXXXX
```

#### LM Studio (классификация обращений)

```env
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
OPENAI_MODEL=local-model
```

#### OpenAI (анализ звонков)

```env
COMMANALYSIS_OPENAI_API_KEY=sk-...
GPT_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
```

#### Менеджеры Bitrix24

```env
MANAGER_IDS_SALES=1,2,3
MANAGER_IDS_TECH=4
MANAGER_IDS_QUALITY=5
MANAGER_IDS_MARKING=6
```

#### Честный ЗНАК / ГИС МТ

```env
MDLP_CLIENT_ID=your_client_id
MDLP_CLIENT_SECRET=your_client_secret
MDLP_PARTICIPANT_INN=your_inn
MDLP_DEFAULT_GTIN=your_gtin
```

#### Стадии воронки CRM

```env
BITRIX_STAGE_PRODUCTION=C3:NEW
BITRIX_STAGE_SHIPMENT=C3:WON
BITRIX_STAGE_MARKING_DONE=C3:PREPARATION
BITRIX_OPERATOR_USER_ID=1
```

#### Отчёты commanalysis

```env
REPORT_MANAGER_USER_ID=1
REPORT_EMAIL=director@example.by
```

### Необязательные переменные

```env
SLA_P1_HOURS=1
SLA_P2_HOURS=4
SLA_P3_HOURS=8
SLA_P4_HOURS=24
SLA_P5_HOURS=48
RATE_LIMIT_MAX=60
WEBHOOK_SECRET=
# NGROK_DOMAIN=your-domain.ngrok-free.app
# SKIP_VERIFY=true
```

---

## Настройка Bitrix24

### Входящий вебхук (сервисы → Bitrix24 API)

| Поле | Значение |
|---|---|
| Расположение | Настройки → Интеграции → Вебхуки → Входящий вебхук |
| Права | CRM, Задачи, IM, Телефония |
| Переменная | `BITRIX_WEBHOOK_URL` |

Используется сервисами commanalysis, marking, fnr-status-bot для вызова Bitrix24 API.

### OAuth-приложение (Bitrix24 → webhook-сервис)

| Поле | Значение |
|---|---|
| Расположение | Разработчикам → Другое → Локальное приложение |
| Права | CRM, Задачи, IM, Телефония |
| Переменные | `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET`, `BITRIX_APP_TOKEN` |

Webhook-сервис автоматически подписывается на события (`event.bind`):
- `ONCRMLEADADD` → AI-классификация → роутинг
- `ONIMCONNECTORMESSAGEADD` → IM-сообщения
- `ONCRMDEALUPDATE` → forward на fnr-marking
- `ONVOXIMPLANTCALLEND` → forward на fnr-commanalysis

Исходящий вебхук больше не нужен.

---

## Локальный запуск (без Docker)

Для разработки отдельных сервисов:

### 1. Запустить Redis

```bash
docker run -d --name fnr-redis -p 6379:6379 redis:7.2-alpine redis-server --appendonly yes
```

### 2. Скопировать env в каждый сервис

Все сервисы читают из корневого `.env` при запуске через Docker. При локальном запуске — переменные нужно экспортировать или создать `.env` в директории сервиса:

```bash
# Быстрый способ — экспортировать из корневого .env
export $(grep -v '^#' .env | xargs)
```

### 3. Запустить сервисы

```bash
# Terminal 1 — Webhook
cd webhook && npm install && REDIS_URL=redis://localhost:6379 npm run dev

# Terminal 2 — Calculator API
cd calculator && npm install && npm run server

# Terminal 3 — Calculator Frontend
cd calculator && npm run dev

# Terminal 4 — CommAnalysis
cd commanalysis && npm install && npm run dev

# Terminal 5 — Telegram Bot
cd fnr-status-bot && npm install && npm start

# Terminal 6 — Marking
cd marking && npm install && npm run dev

# Terminal 7 — Analytics
cd fnr-analytics && npm install && npm run dev

# Terminal 8 — CommAnalysis Scheduler (опционально)
cd commanalysis && node scheduler/dailyBatch.js
```

---

## Известные проблемы

### npm install из корня монорепо

Корневой `package.json` использует npm workspaces. `fnr-analytics` не в workspaces — устанавливать отдельно:

```bash
npm install          # устанавливает webhook, calculator, commanalysis, fnr-status-bot, marking
cd fnr-analytics && npm install
```

### LM Studio не доступен из Docker

В docker-compose используется `host.docker.internal:1234`. На Linux это может не работать — добавьте:

```bash
# В docker-compose.yml для сервиса webhook:
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Marking: директория данных

При локальном запуске создать вручную:

```bash
mkdir -p marking/data/production/orders
```

В Docker директория создаётся автоматически через volume `marking-data`.

### fnr-analytics — в отдельном compose-файле

`fnr-analytics` размещён в `docker-compose.calculator.yml` (фронтенд-сервисы):

```bash
docker compose -f docker-compose.calculator.yml up --build -d
```

Bitrix24 Webhook URL **не нужен** при сборке — пользователи настраивают его через страницу **Settings** в интерфейсе приложения (сохраняется в localStorage браузера).

### Redis в webhook недоступен локально

Убедиться что `REDIS_URL=redis://localhost:6379` (не `redis://redis:6379` — это Docker-адрес).

---

## Обслуживание

```bash
# Пересобрать и перезапустить один сервис
docker compose up --build -d webhook

# Просмотр логов всех сервисов
docker compose logs -f

# Очистить неиспользуемые образы
docker image prune -f

# Бэкап данных маркировки
docker run --rm -v flex-n-roll-pro_marking-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/marking-backup-$(date +%Y%m%d).tar.gz /data
```
