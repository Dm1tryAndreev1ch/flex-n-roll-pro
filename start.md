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
| `fnr-analytics` | Дашборд аналитики (React SPA, nginx) | `fnr-analytics:80` |
| `fnr-redis` | Кэш, rate limiting, round-robin счётчики менеджеров | `fnr-redis:6379` |

Все сервисы общаются через Docker-сеть `fnr-net` по именам контейнеров. Порты на хост не пробрасываются — для доступа извне нужен reverse proxy (nginx/Traefik).

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

---

## Настройка .env

Единый файл `.env` в корне репозитория читается всеми сервисами.

### Обязательные переменные

#### Bitrix24

Создать **входящий вебхук** в Bitrix24:  
`Настройки → Интеграции → Вебхуки → Входящий вебхук`  
Права: **CRM + Задачи + IM + Телефония**

```env
BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
BITRIX_PORTAL_DOMAIN=your-portal.bitrix24.ru
```

Создать **исходящий вебхук** для получения событий:  
`Настройки → Интеграции → Вебхуки → Исходящий вебхук`  
- URL обработчика: `http://your-server:3000/webhook`  
- События: `OnCrmLeadAdd`, `OnImConnectorMessageAdd`

#### Telegram Bot

```env
BOT_TOKEN=токен_от_BotFather
MANAGER_CONTACT=@ваш_менеджер
MANAGER_PHONE=+375XXXXXXXXX
```

#### LM Studio (классификация обращений)

LM Studio должен быть запущен на хост-машине. В Docker используется `host.docker.internal`:

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

ID пользователей из CRM. Используются для round-robin роутинга:

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

Узнать ID стадий: `CRM → Настройки → Воронки и туннели продаж`

```env
BITRIX_STAGE_PRODUCTION=C3:NEW
BITRIX_STAGE_SHIPMENT=C3:WON
BITRIX_STAGE_MARKING_DONE=C3:PREPARATION
BITRIX_OPERATOR_USER_ID=1
```

#### Отчёты commanalysis

```env
REPORT_MANAGER_USER_ID=1        # ID руководителя в Bitrix24
REPORT_EMAIL=director@example.by
```

### Необязательные переменные

```env
# SLA дедлайны (часы, по умолчанию: 1/4/8/24/48)
SLA_P1_HOURS=1
SLA_P2_HOURS=4
SLA_P3_HOURS=8
SLA_P4_HOURS=24
SLA_P5_HOURS=48

# Rate limiting webhook (запросов в минуту)
RATE_LIMIT_MAX=60

# Секрет для верификации вебхуков marking (если нужна доп. защита)
WEBHOOK_SECRET=

# Только для локальной разработки — отключает верификацию домена Bitrix24
# SKIP_VERIFY=true
```

---

## Настройка Bitrix24

### Входящий вебхук (наш сервер → Bitrix24)

| Поле | Значение |
|---|---|
| Расположение | Настройки → Интеграции → Вебхуки → Входящий вебхук |
| Права | CRM, Задачи, IM, Телефония |
| Переменная | `BITRIX_WEBHOOK_URL` |

Один URL используется всеми сервисами (webhook, calculator, commanalysis, fnr-status-bot, marking).

### Исходящий вебхук (Bitrix24 → наш сервер)

| Поле | Значение |
|---|---|
| Расположение | Настройки → Интеграции → Вебхуки → Исходящий вебхук |
| URL обработчика | `https://your-server/webhook` |
| События | `OnCrmLeadAdd`, `OnImConnectorMessageAdd` |

Верификация: сервис проверяет `auth.domain` в теле запроса против `BITRIX_PORTAL_DOMAIN`.

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
