# FLEX-N-ROLL PRO — Bitrix24 × LM Studio Webhook

Production-ready Node.js/Express сервер для интеграции **Битрикс24** с **LM Studio AI**.  
Получает входящие события CRM, классифицирует запросы через локальную LLM, обновляет лиды, назначает менеджеров (round-robin), создаёт задачи по SLA и отправляет автоответы.

---

## Архитектура

```
Bitrix24 webhooks
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│  Express Server  │─────▶│  LM Studio AI   │
│  (webhook handler│      │  (classification)│
│   + HMAC auth)   │      └─────────────────┘
│                  │
│  Rate Limiting   │◀────▶ Redis
│  Round-Robin     │
│                  │
│  Bitrix24 API    │─────▶ Bitrix24 REST
│  (OAuth 2.0)     │      (leads, tasks, IM)
└──────────────────┘
```

## Функциональность

### AI-классификатор (LM Studio)
- Определяет **intent** (8 типов): quote_request, order_placement, reorder, design_question, technical_issue, delivery_inquiry, general_inquiry, spam
- Определяет **product_type** (11 типов): self_adhesive_paper/pe/pet/bopp/pp, sleeve, ar_label, thermochrome, linerless, datamatrix, unknown
- Определяет **urgency**: critical, high, medium, low
- Определяет **route_to**: sales, tech, quality, marking
- Оценивает **priority** (1–5) с привязкой к SLA
- Генерирует **auto_reply** на языке клиента
- Извлекает **extracted_data**: тираж, размеры, материал, дедлайн, бюджет, контакты

### Маршрутизация лидов
- Round-robin по пулам менеджеров (sales / tech / quality / marking)
- Счётчики в Redis с автоматическим fallback на JSON-файл
- SLA-дедлайны: P1=1ч, P2=4ч, P3=8ч, P4=24ч, P5=48ч

### Безопасность
- HMAC-SHA256 верификация подписи вебхука (timing-safe)
- Helmet security headers
- Rate limiting: 60 req/min per IP (Redis-backed с fallback на in-memory)

### Битрикс24 интеграция
- OAuth 2.0 с автообновлением токенов
- Создание задач, обновление лидов/сделок, отправка сообщений
- Retry с exponential backoff на 5xx ошибки

---

## Быстрый старт

### Требования

- **Node.js** ≥ 20
- **Redis** 7+ (опционально — без Redis используется файловый fallback)
- **LM Studio** запущен локально на `http://localhost:1234`
- Доступ к **Битрикс24** (OAuth 2.0 приложение)

### 1. Установить зависимости

```bash
cd webhook
npm install
```

### 2. Настроить окружение

```bash
cp .env.example .env
# Отредактируйте .env — заполните WEBHOOK_SECRET, BITRIX_* и LM Studio параметры
```

### 3. Запуск в режиме разработки

```bash
npm run dev
```

### 4. Запуск в production (Docker)

```bash
docker compose up -d --build
```

---

## Структура проекта

```
webhook/
├── src/
│   ├── server.js                 # Express-сервер, graceful shutdown
│   ├── routes/
│   │   └── webhook.js            # POST /webhook — обработка событий
│   ├── services/
│   │   ├── lmstudio.js           # AI-классификатор (LM Studio)
│   │   ├── bitrix.js             # Bitrix24 REST API клиент (OAuth 2.0)
│   │   └── routing.js            # Round-robin маршрутизация
│   ├── middleware/
│   │   ├── auth.js               # HMAC-SHA256 верификация
│   │   └── rateLimit.js          # Rate limiting (Redis / in-memory)
│   └── utils/
│       ├── logger.js             # Winston логгер
│       └── retry.js              # Exponential backoff с jitter
├── config/
│   └── config.js                 # Центральная конфигурация из .env
├── .env.example                  # Шаблон переменных окружения
├── package.json
├── Dockerfile                    # node:20-alpine, non-root, healthcheck
├── docker-compose.yml            # app + redis
└── README.md
```

---

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/webhook` | Приём вебхуков Битрикс24 (HMAC + rate limit) |
| `GET` | `/health` | Health check (без авторизации) |
| `GET` | `/oauth/init` | Редирект на OAuth-страницу Битрикс24 |
| `GET` | `/oauth/callback` | Обмен кода на токены OAuth |

---

## Переменные окружения

| Переменная | Обяз. | Описание | По умолчанию |
|------------|-------|----------|--------------|
| `PORT` | — | Порт сервера | `3000` |
| `NODE_ENV` | — | Окружение | `development` |
| `WEBHOOK_SECRET` | ✅ | Секрет для HMAC | — |
| `WEBHOOK_SIGNATURE_HEADER` | — | Заголовок подписи | `x-bitrix-signature` |
| `OPENAI_API_KEY` | — | API-ключ LM Studio | `lm-studio` |
| `OPENAI_BASE_URL` | — | URL LM Studio | `http://localhost:1234/v1` |
| `OPENAI_MODEL` | — | Модель LLM | `local-model` |
| `OPENAI_MAX_TOKENS` | — | Макс. токенов ответа | `1024` |
| `OPENAI_TEMPERATURE` | — | Температура генерации | `0.2` |
| `BITRIX_CLIENT_ID` | ✅ | ID OAuth-приложения | — |
| `BITRIX_CLIENT_SECRET` | ✅ | Секрет приложения | — |
| `BITRIX_PORTAL_DOMAIN` | ✅ | Домен портала | — |
| `BITRIX_REDIRECT_URI` | ✅ | URI для OAuth callback | — |
| `REDIS_URL` | — | URL Redis | `redis://localhost:6379` |
| `MANAGER_IDS_SALES` | — | ID менеджеров продаж | `1,2,3` |
| `MANAGER_IDS_TECH` | — | ID тех. менеджеров | `4` |
| `MANAGER_IDS_QUALITY` | — | ID менеджеров качества | `5` |
| `MANAGER_IDS_MARKING` | — | ID менеджеров маркировки | `6` |
| `SLA_P1_HOURS` – `SLA_P5_HOURS` | — | SLA дедлайны (часы) | `1, 4, 8, 24, 48` |

---

## Pipeline обработки

```
1. Bitrix24 → POST /webhook (HMAC-SHA256 verified)
2. Извлечение данных из payload (lead / IM message)
3. LM Studio AI → classifyMessage()
   └─ intent, product_type, urgency, route_to, priority, auto_reply, extracted_data
4. Routing → resolvePool() + getNextManager() (round-robin)
5. Bitrix24 API → updateLead() — назначение менеджера, заполнение UF-полей
6. Bitrix24 API → createTask() — задача с дедлайном по SLA
7. Bitrix24 API → sendMessage() — автоответ клиенту
```

---

## Docker

### Сборка и запуск

```bash
docker compose up -d --build
```

### Проверка здоровья

```bash
curl http://localhost:3000/health
```

### Просмотр логов

```bash
docker compose logs -f app
```

---

## Логирование

- **Development**: цветной вывод в консоль (`YYYY-MM-DD HH:mm:ss.SSS`)
- **Production**: JSON-формат в консоль + файлы
- Файлы: `logs/combined.log`, `logs/error.log`, `logs/exceptions.log`, `logs/rejections.log`
- Ротация: 20 MB / 14 файлов (combined), 10 MB / 30 файлов (error)

---

## OAuth 2.0 начальная настройка

1. Создайте OAuth-приложение в Битрикс24 (Разработчикам → OAuth)
2. Укажите `BITRIX_REDIRECT_URI` = `https://your-domain.com/oauth/callback`
3. Заполните `BITRIX_CLIENT_ID` и `BITRIX_CLIENT_SECRET` в `.env`
4. Откройте `https://your-domain.com/oauth/init` в браузере
5. Авторизуйтесь — токены сохранятся в `./data/bitrix_tokens.json`
6. Далее токены обновляются автоматически

---

## Лицензия

UNLICENSED — внутренний проект FLEX-N-ROLL PRO.
