# FLEX-N-ROLL PRO — Программный код
## Файл для выполнения в Claude Code CLI

**Инструкция по использованию:**

1. Откройте Claude Code CLI в нужной директории
2. Скопируйте нужный раздел и отправьте в Claude Code
3. Claude Code создаст все файлы проекта с полным кодом

---

## ОГЛАВЛЕНИЕ МОДУЛЕЙ

| Раздел | Проект | Технологии |
|--------|--------|------------|
| **2.2** | Вебхук-обработчик Битрикс24 + GPT | Node.js, Express, OpenAI API, Redis |
| **3.3** | Статус-бот для клиентов | Node.js, Telegraf, Битрикс24 API |
| **4.2** | AI-аналитика продаж | Python, scikit-learn, pandas |
| **4.3** | Анализ коммуникаций (Whisper + GPT) | Node.js, OpenAI Whisper, GPT-4 |
| **Доп** | Модуль маркировки Честный ЗНАК | Node.js, ГИС МТ API |
| **Доп** | Калькулятор этикеток (сайт) | React, TypeScript, Tailwind |

---

## КАК ИСПОЛЬЗОВАТЬ С CLAUDE CODE CLI

Для каждого модуля выполните команду вида:

```
claude "Создай проект [название] со следующей структурой и кодом файлов: [вставить раздел]"
```

Или запустите Claude Code в нужной папке:
```bash
mkdir flex-n-roll-webhook && cd flex-n-roll-webhook
claude  # открывает интерактивный режим
```

---

## МОДУЛЬ 2.2 — ВЕБХУК-ОБРАБОТЧИК (Node.js + GPT-4 + Битрикс24)

> **Промт для Claude Code CLI:**  
> "Создай Node.js проект `flex-n-roll-webhook` по следующей структуре. Создай все файлы с полным кодом."

# 2.2 Вебхук Node.js — FLEX-N-ROLL PRO
# Bitrix24 × OpenAI GPT-4 Webhook Handler

Production-ready интеграция: Битрикс24 → GPT-4 → автоматическая маршрутизация лидов, создание задач по SLA, автоответы клиентам.

---

## Структура проекта

```
flex-n-roll-webhook/
├── src/
│   ├── server.js
│   ├── routes/
│   │   └── webhook.js
│   ├── services/
│   │   ├── lmstudio.js
│   │   ├── bitrix.js
│   │   └── routing.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rateLimit.js
│   └── utils/
│       ├── logger.js
│       └── retry.js
├── config/
│   └── config.js
├── .env.example
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## `package.json`

```json
{
  "name": "flex-n-roll-webhook",
  "version": "1.0.0",
  "description": "Bitrix24 → OpenAI GPT-4 webhook handler for FLEX-N-ROLL PRO typography",
  "main": "src/server.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --forceExit",
    "test:coverage": "jest --runInBand --forceExit --coverage",
    "lint": "eslint src/ config/ --ext .js",
    "lint:fix": "eslint src/ config/ --ext .js --fix"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "body-parser": "^1.20.3",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "express-rate-limit": "^7.4.1",
    "helmet": "^7.2.0",
    "openai": "^4.67.3",
    "rate-limit-redis": "^4.2.0",
    "redis": "^4.7.0",
    "winston": "^3.15.0"
  },
  "devDependencies": {
    "eslint": "^8.57.1",
    "jest": "^29.7.0",
    "nodemon": "^3.1.7",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.js"],
    "coverageDirectory": "coverage",
    "collectCoverageFrom": ["src/**/*.js", "config/**/*.js"]
  },
  "nodemonConfig": {
    "watch": ["src/", "config/"],
    "ext": "js,json",
    "ignore": ["logs/", "data/", "node_modules/"]
  },
  "license": "UNLICENSED",
  "private": true
}
```

---

## `.env.example`

```bash
# .env.example — copy to .env and fill in real values

# ─── Server ──────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ─── Webhook security ────────────────────────────────────────────────────────
# Shared secret used to verify Bitrix24 / reverse-proxy HMAC signatures
WEBHOOK_SECRET=change_me_to_a_long_random_string_64chars
WEBHOOK_SIGNATURE_HEADER=x-bitrix-signature

# ─── LM Studio ───────────────────────────────────────────────────────────────
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_MODEL=local-model
OPENAI_MAX_TOKENS=1024
OPENAI_TEMPERATURE=0.2
OPENAI_TIMEOUT_MS=30000

# ─── Bitrix24 OAuth 2.0 ──────────────────────────────────────────────────────
BITRIX_CLIENT_ID=local.xxxxxxxxxx.yyyyyyyyyy
BITRIX_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BITRIX_PORTAL_DOMAIN=mycompany.bitrix24.ru
BITRIX_REDIRECT_URI=https://your-server.example.com/oauth/callback
# Bootstrap tokens — will be refreshed automatically and written to BITRIX_TOKEN_FILE
BITRIX_ACCESS_TOKEN=
BITRIX_REFRESH_TOKEN=
BITRIX_TOKEN_FILE=./data/bitrix_tokens.json
BITRIX_TIMEOUT_MS=15000

# ─── Redis (manager round-robin counters) ────────────────────────────────────
REDIS_URL=redis://localhost:6379
# Set to true to use a JSON file instead of Redis
ROUTING_USE_FILE=false
ROUTING_COUNTER_FILE=./data/routing_counters.json

# ─── Rate limiting ───────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60

# ─── Retry logic ─────────────────────────────────────────────────────────────
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=500
RETRY_MAX_DELAY_MS=8000

# ─── Manager IDs (Bitrix24 user IDs, comma-separated) ────────────────────────
MANAGER_IDS_SALES=1,2,3
MANAGER_IDS_TECH=4
MANAGER_IDS_QUALITY=5
MANAGER_IDS_MARKING=6

# ─── SLA deadlines (hours) ───────────────────────────────────────────────────
SLA_P1_HOURS=1
SLA_P2_HOURS=4
SLA_P3_HOURS=8
SLA_P4_HOURS=24
SLA_P5_HOURS=48

# ─── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## `config/config.js`

```js
// config/config.js
'use strict';

require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

const config = {
  server: {
    port: parseInt(optional('PORT', '3000'), 10),
    nodeEnv: optional('NODE_ENV', 'development'),
    isProduction: optional('NODE_ENV', 'development') === 'production',
  },

  webhook: {
    secret: required('WEBHOOK_SECRET'),
    // Signature header sent by Bitrix24 or your reverse proxy
    signatureHeader: optional('WEBHOOK_SIGNATURE_HEADER', 'x-bitrix-signature'),
  },

  openai: {
    apiKey: optional('OPENAI_API_KEY', 'lm-studio'),
    baseURL: optional('OPENAI_BASE_URL', 'http://localhost:1234/v1'),
    model: optional('OPENAI_MODEL', 'local-model'),
    maxTokens: parseInt(optional('OPENAI_MAX_TOKENS', '1024'), 10),
    temperature: parseFloat(optional('OPENAI_TEMPERATURE', '0.2')),
    timeout: parseInt(optional('OPENAI_TIMEOUT_MS', '30000'), 10),
  },

  bitrix: {
    // OAuth 2.0 credentials
    clientId: required('BITRIX_CLIENT_ID'),
    clientSecret: required('BITRIX_CLIENT_SECRET'),
    portalDomain: required('BITRIX_PORTAL_DOMAIN'), // e.g. mycompany.bitrix24.ru
    redirectUri: required('BITRIX_REDIRECT_URI'),

    // Initial tokens (bootstrapped; refreshed automatically)
    accessToken: optional('BITRIX_ACCESS_TOKEN'),
    refreshToken: optional('BITRIX_REFRESH_TOKEN'),

    // Token storage path (JSON file)
    tokenFile: optional('BITRIX_TOKEN_FILE', './data/bitrix_tokens.json'),

    timeout: parseInt(optional('BITRIX_TIMEOUT_MS', '15000'), 10),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
    // Fallback to file-based counter when Redis unavailable
    useFile: optional('ROUTING_USE_FILE', 'false') === 'true',
    counterFile: optional('ROUTING_COUNTER_FILE', './data/routing_counters.json'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),   // 1 minute
    maxRequests: parseInt(optional('RATE_LIMIT_MAX', '60'), 10),          // per window
  },

  retry: {
    maxAttempts: parseInt(optional('RETRY_MAX_ATTEMPTS', '3'), 10),
    baseDelayMs: parseInt(optional('RETRY_BASE_DELAY_MS', '500'), 10),
    maxDelayMs: parseInt(optional('RETRY_MAX_DELAY_MS', '8000'), 10),
  },

  // Manager pools — IDs reference Bitrix24 user IDs
  managers: {
    sales:   (optional('MANAGER_IDS_SALES',   '1,2,3')).split(',').map(Number),
    tech:    (optional('MANAGER_IDS_TECH',    '4')).split(',').map(Number),
    quality: (optional('MANAGER_IDS_QUALITY', '5')).split(',').map(Number),
    marking: (optional('MANAGER_IDS_MARKING', '6')).split(',').map(Number),
  },

  // SLA deadlines in hours by priority level (1 = HOT … 5 = COLD)
  sla: {
    1: parseInt(optional('SLA_P1_HOURS', '1'),  10),
    2: parseInt(optional('SLA_P2_HOURS', '4'),  10),
    3: parseInt(optional('SLA_P3_HOURS', '8'),  10),
    4: parseInt(optional('SLA_P4_HOURS', '24'), 10),
    5: parseInt(optional('SLA_P5_HOURS', '48'), 10),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR', './logs'),
  },
};

module.exports = config;
```

---

## `src/utils/logger.js`

```js
// src/utils/logger.js
'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

// Ensure log directory exists
fs.mkdirSync(config.logging.dir, { recursive: true });

const { combine, timestamp, errors, json, colorize, printf, splat } = format;

// Human-readable format for development console
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
  })
);

// JSON format for production / file output
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

const logger = createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'flex-n-roll-webhook' },
  transports: [
    // Combined log (all levels)
    new transports.File({
      filename: path.join(config.logging.dir, 'combined.log'),
      format: prodFormat,
      maxsize: 20 * 1024 * 1024,   // 20 MB
      maxFiles: 14,
      tailable: true,
    }),
    // Error-only log
    new transports.File({
      filename: path.join(config.logging.dir, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
      tailable: true,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(config.logging.dir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(config.logging.dir, 'rejections.log') }),
  ],
});

// Add console transport based on environment
if (config.server.isProduction) {
  logger.add(new transports.Console({ format: prodFormat }));
} else {
  logger.add(new transports.Console({ format: devFormat }));
}

/**
 * Create a child logger scoped to a specific module / request.
 * @param {object} meta - Additional default metadata for all log entries.
 */
logger.child = (meta) => logger.child(meta);

module.exports = logger;
```

---

## `src/utils/retry.js`

```js
// src/utils/retry.js
'use strict';

const logger = require('./logger');
const config = require('../../config/config');

/**
 * Exponential backoff with jitter.
 *
 * @param {number} attempt  - Current attempt index (0-based).
 * @param {number} baseMs   - Base delay in milliseconds.
 * @param {number} maxMs    - Maximum delay cap in milliseconds.
 * @returns {number} Delay in milliseconds.
 */
function calcDelay(attempt, baseMs, maxMs) {
  // Full jitter strategy: delay = random(0, min(cap, base * 2^attempt))
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exponential);
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 *
 * @param {Function} fn           - Async function to execute; receives the attempt number (1-based).
 * @param {object}   [opts]       - Override options.
 * @param {number}   [opts.maxAttempts]  - Max total attempts.
 * @param {number}   [opts.baseDelayMs] - Base backoff delay.
 * @param {number}   [opts.maxDelayMs]  - Max backoff delay.
 * @param {Function} [opts.shouldRetry] - Predicate(error) → bool; return false to abort early.
 * @param {string}   [opts.label]       - Label for log messages.
 * @returns {Promise<*>} Resolved value of fn.
 * @throws {Error} Last error after all retries exhausted.
 */
async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? config.retry.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? config.retry.baseDelayMs;
  const maxDelayMs  = opts.maxDelayMs  ?? config.retry.maxDelayMs;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  const label       = opts.label       ?? 'operation';

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      if (attempt > 1) {
        logger.info(`[retry] ${label} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (err) {
      lastError = err;

      const isRetryable = shouldRetry(err);
      const isLastAttempt = attempt === maxAttempts;

      if (!isRetryable || isLastAttempt) {
        logger.error(`[retry] ${label} failed permanently after ${attempt} attempt(s)`, {
          error: err.message,
          stack: err.stack,
          retryable: isRetryable,
        });
        throw err;
      }

      const delayMs = calcDelay(attempt - 1, baseDelayMs, maxDelayMs);
      logger.warn(`[retry] ${label} failed on attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms`, {
        error: err.message,
        attempt,
        delayMs,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Predicate: retry on network / 5xx errors, not on 4xx client errors.
 * Works with axios errors and standard fetch-style errors.
 */
function isTransientError(err) {
  if (err.code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'].includes(err.code)) {
    return true;
  }
  // Axios HTTP response
  if (err.response) {
    return err.response.status >= 500;
  }
  // Generic network errors (no response)
  if (err.isAxiosError && !err.response) {
    return true;
  }
  return false;
}

module.exports = { withRetry, isTransientError, sleep, calcDelay };
```

---

## `src/middleware/auth.js`

```js
// src/middleware/auth.js
'use strict';

const crypto = require('crypto');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Verify Bitrix24 webhook signature.
 *
 * Bitrix24 (and many reverse proxies) sign payloads with HMAC-SHA256:
 *   signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET)
 * and send the hex digest in the configured header.
 *
 * The middleware MUST receive the raw request body buffer, so it expects
 * `req.rawBody` populated by the bodyParser `verify` callback in server.js.
 */
function verifyWebhookSignature(req, res, next) {
  // In development mode, skip signature verification if explicitly disabled
  if (!config.server.isProduction && process.env.SKIP_SIGNATURE_VERIFY === 'true') {
    logger.warn('[auth] Signature verification SKIPPED (development mode)');
    return next();
  }

  const receivedSig = req.headers[config.webhook.signatureHeader];

  if (!receivedSig) {
    logger.warn('[auth] Missing signature header', {
      header: config.webhook.signatureHeader,
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error('[auth] rawBody not available — ensure bodyParser verify callback is configured');
    return res.status(500).json({ error: 'Internal server error' });
  }

  const expectedSig = crypto
    .createHmac('sha256', config.webhook.secret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const receivedBuf = Buffer.from(receivedSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    logger.warn('[auth] Invalid webhook signature', {
      ip: req.ip,
      path: req.path,
      receivedSig: receivedSig.substring(0, 8) + '…',
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  logger.debug('[auth] Webhook signature verified');
  next();
}

module.exports = { verifyWebhookSignature };
```

---

## `src/middleware/rateLimit.js`

```js
// src/middleware/rateLimit.js
'use strict';

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');
const config = require('../../config/config');
const logger = require('../utils/logger');

let limiter;

/**
 * Build and return the rate-limiter middleware.
 * Tries Redis-backed store first; falls back to in-memory if Redis is unavailable.
 */
async function buildRateLimiter() {
  if (limiter) return limiter;

  const baseOptions = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Key by client IP; trusts X-Forwarded-For if behind a proxy
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    },
    handler: (req, res) => {
      logger.warn('[rateLimit] Request rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        limit: config.rateLimit.maxRequests,
        windowMs: config.rateLimit.windowMs,
      });
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      });
    },
    skip: (req) => {
      // Health-check endpoint is never rate-limited
      return req.path === '/health';
    },
  };

  // Attempt Redis-backed store
  if (!config.redis.useFile) {
    try {
      const redisClient = createClient({ url: config.redis.url });
      redisClient.on('error', (err) => {
        logger.error('[rateLimit] Redis client error', { error: err.message });
      });
      await redisClient.connect();

      limiter = rateLimit({
        ...baseOptions,
        store: new RedisStore({
          sendCommand: (...args) => redisClient.sendCommand(args),
        }),
      });

      logger.info('[rateLimit] Using Redis-backed rate limiter', { url: config.redis.url });
      return limiter;
    } catch (err) {
      logger.warn('[rateLimit] Redis unavailable, falling back to in-memory store', {
        error: err.message,
      });
    }
  }

  // Fallback: in-memory store (suitable for single-instance deployment)
  limiter = rateLimit(baseOptions);
  logger.info('[rateLimit] Using in-memory rate limiter');
  return limiter;
}

/**
 * Express middleware factory.
 * Lazily initialises the limiter on first request.
 */
let initPromise = null;

function webhookRateLimit(req, res, next) {
  if (!initPromise) {
    initPromise = buildRateLimiter();
  }
  initPromise
    .then((mw) => mw(req, res, next))
    .catch((err) => {
      logger.error('[rateLimit] Failed to build rate limiter', { error: err.message });
      next(); // Fail open — do not block requests if rate limiter fails to initialise
    });
}

module.exports = { webhookRateLimit, buildRateLimiter };
```

---

## `src/services/lmstudio.js`

```js
// src/services/lmstudio.js
'use strict';

const { OpenAI } = require('openai');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: config.openai.timeout,
});

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — AI-классификатор входящих обращений для типографии FLEX-N-ROLL PRO.

## О компании
FLEX-N-ROLL PRO — профессиональная типография, специализирующаяся на:
- **Широкоформатная печать**: баннеры, плакаты, стенды, ролл-апы (roll-up), X-стенды
- **Интерьерная печать**: декоративные панели, обои, наклейки для интерьера
- **Сувенирная продукция**: кружки, футболки, ежедневники, ручки, брелоки
- **Полиграфия**: визитки, листовки, буклеты, каталоги, папки, блокноты
- **Маркировка и этикетки**: самоклеящиеся этикетки, стикеры, QR-наклейки
- **Срочная печать**: экспресс-заказы с дедлайном до 24 часов
- **Ламинирование**: глянцевое, матовое, антибликовое
- **Постпечатная обработка**: резка, биговка, перфорация, пружина

## Твоя задача
Проанализировать входящее сообщение от клиента и вернуть JSON-объект классификации.

## Поля классификации

### intent (строка, обязательное)
Тип намерения клиента:
- "quote_request"     — запрос коммерческого предложения / расчёт стоимости
- "order_placement"   — готов разместить заказ
- "reorder"          — повторный заказ (упоминает предыдущий заказ)
- "design_question"  — вопрос по макету, файлам, цветовой модели
- "technical_issue"  — проблема с качеством, рекламация
- "delivery_inquiry" — вопрос о доставке или сроках
- "general_inquiry"  — общий вопрос, информация о компании
- "spam"             — нерелевантное сообщение

### product_type (строка, обязательное)
Категория продукта:
- "wide_format"      — широкоформатная печать (баннеры, ролл-апы, стенды)
- "interior"         — интерьерная печать (панели, обои, наклейки)
- "souvenirs"        — сувенирная продукция
- "polygraphy"       — полиграфия (визитки, буклеты, каталоги)
- "labeling"         — маркировка и этикетки
- "express"          — срочный заказ (дедлайн ≤ 24 ч)
- "post_print"       — постпечатная обработка
- "unknown"          — продукт не определён

### urgency (строка, обязательное)
- "critical"  — нужно сегодня или завтра
- "high"      — нужно в течение 2–3 дней
- "medium"    — в течение недели
- "low"       — без жёсткого срока

### route_to (строка, обязательное)
Пул менеджеров для обработки:
- "sales"    — продажи (quote_request, order_placement, reorder)
- "tech"     — технический отдел (design_question, technical_issue)
- "quality"  — контроль качества (рекламации, брак)
- "marking"  — маркировка и этикетки (labeling)

### priority (число 1–5, обязательное)
1 = HOT (критично, срочно), 5 = COLD (низкий приоритет):
- 1: срочный заказ, рекламация, готов оплатить прямо сейчас
- 2: высокая вероятность сделки, дедлайн ≤ 3 дней
- 3: стандартный запрос на КП, средние сроки
- 4: информационный запрос, нет чёткого дедлайна
- 5: спам, холодный лид, нерелевантный запрос

### auto_reply (строка, обязательное)
Готовый текст автоответа клиенту на том же языке, что и входящее сообщение.
Стиль: профессиональный, дружелюбный, без шаблонных клише. 1–3 предложения.
Укажи, что заявка принята и менеджер свяжется в течение времени согласно SLA.

### extracted_data (объект, обязательное)
Структурированные данные, извлечённые из сообщения:
{
  "quantity":       <число или null>,           // тираж / количество
  "dimensions":     <строка или null>,          // размеры, например "1000×2000 мм"
  "material":       <строка или null>,          // материал/носитель
  "deadline":       <строка или null>,          // срок в свободной форме
  "budget":         <число или null>,           // бюджет в рублях
  "contact_name":   <строка или null>,          // имя клиента
  "contact_phone":  <строка или null>,          // телефон
  "contact_email":  <строка или null>,          // email
  "has_files":      <boolean>,                  // есть ли вложенные файлы
  "file_names":     <массив строк или []>,      // имена файлов
  "company":        <строка или null>,          // название компании
  "notes":          <строка или null>           // прочие важные детали
}

## Формат ответа
Верни ТОЛЬКО валидный JSON без markdown-блоков, без пояснений.
Пример структуры:
{
  "intent": "quote_request",
  "product_type": "wide_format",
  "urgency": "high",
  "route_to": "sales",
  "priority": 2,
  "auto_reply": "Спасибо за обращение! Ваша заявка принята, менеджер свяжется с вами в течение 4 часов.",
  "extracted_data": {
    "quantity": 50,
    "dimensions": "800×2000 мм",
    "material": "баннерная ткань 440 г/м²",
    "deadline": "к пятнице",
    "budget": null,
    "contact_name": "Алексей",
    "contact_phone": null,
    "contact_email": null,
    "has_files": false,
    "file_names": [],
    "company": "ООО Ромашка",
    "notes": "Срочно, мероприятие в субботу"
  }
}`;

/**
 * Classify an incoming client message using GPT-4.
 *
 * @param {object} params
 * @param {string} params.message        - Main message text.
 * @param {string} [params.contactName]  - Client's name (if known).
 * @param {string} [params.contactPhone] - Client's phone.
 * @param {string} [params.contactEmail] - Client's email.
 * @param {string[]} [params.fileNames]  - Names of attached files.
 * @returns {Promise<ClassificationResult>}
 */
async function classifyMessage({ message, contactName, contactPhone, contactEmail, fileNames = [] }) {
  const userContent = buildUserContent({ message, contactName, contactPhone, contactEmail, fileNames });

  logger.info('[openai] Classifying message', {
    messageLength: message.length,
    hasFiles: fileNames.length > 0,
  });

  const rawResponse = await withRetry(
    async (attempt) => {
      logger.debug(`[lmstudio] LLM API call attempt ${attempt}`);
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
      });
      return completion.choices[0].message.content;
    },
    {
      label: 'openai.classify',
      shouldRetry: (err) => {
        // Retry on network errors and 429 rate-limit; not on 4xx auth errors
        if (err.status === 429) return true;
        if (err.status >= 400 && err.status < 500) return false;
        return isTransientError(err);
      },
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (parseErr) {
    logger.error('[openai] Failed to parse GPT-4 response as JSON', {
      raw: rawResponse?.substring(0, 500),
    });
    throw new Error(`GPT-4 returned non-JSON response: ${parseErr.message}`);
  }

  // Validate required fields
  const required = ['intent', 'product_type', 'urgency', 'route_to', 'priority', 'auto_reply', 'extracted_data'];
  const missing = required.filter((f) => !(f in parsed));
  if (missing.length) {
    logger.error('[openai] GPT-4 response missing required fields', { missing, parsed });
    throw new Error(`GPT-4 response missing fields: ${missing.join(', ')}`);
  }

  // Clamp priority to 1–5
  parsed.priority = Math.min(5, Math.max(1, parseInt(parsed.priority, 10)));

  logger.info('[openai] Classification complete', {
    intent: parsed.intent,
    product_type: parsed.product_type,
    priority: parsed.priority,
    route_to: parsed.route_to,
  });

  return parsed;
}

/**
 * Build the user message content to send to GPT-4.
 */
function buildUserContent({ message, contactName, contactPhone, contactEmail, fileNames }) {
  const lines = ['## Входящее сообщение', message];

  if (contactName || contactPhone || contactEmail) {
    lines.push('\n## Контактные данные клиента');
    if (contactName)  lines.push(`Имя: ${contactName}`);
    if (contactPhone) lines.push(`Телефон: ${contactPhone}`);
    if (contactEmail) lines.push(`Email: ${contactEmail}`);
  }

  if (fileNames.length > 0) {
    lines.push('\n## Прикреплённые файлы');
    fileNames.forEach((f) => lines.push(`- ${f}`));
  }

  return lines.join('\n');
}

module.exports = { classifyMessage, SYSTEM_PROMPT };
```

---

## `src/services/bitrix.js`

```js
// src/services/bitrix.js
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

// ─── Token storage ────────────────────────────────────────────────────────────
let _tokens = {
  accessToken:  config.bitrix.accessToken,
  refreshToken: config.bitrix.refreshToken,
};

function loadTokensFromFile() {
  try {
    const dir = path.dirname(config.bitrix.tokenFile);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(config.bitrix.tokenFile)) {
      const data = JSON.parse(fs.readFileSync(config.bitrix.tokenFile, 'utf8'));
      _tokens = { ...data };
      logger.debug('[bitrix] Tokens loaded from file');
    }
  } catch (err) {
    logger.warn('[bitrix] Could not load tokens from file', { error: err.message });
  }
}

function saveTokensToFile() {
  try {
    const dir = path.dirname(config.bitrix.tokenFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.bitrix.tokenFile, JSON.stringify(_tokens, null, 2), 'utf8');
    logger.debug('[bitrix] Tokens saved to file');
  } catch (err) {
    logger.error('[bitrix] Could not save tokens to file', { error: err.message });
  }
}

// Attempt to bootstrap tokens from file on module load
loadTokensFromFile();

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/**
 * Returns the OAuth2 authorisation URL.
 * Direct users here to obtain the initial code.
 */
function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     config.bitrix.clientId,
    response_type: 'code',
    redirect_uri:  config.bitrix.redirectUri,
  });
  return `https://${config.bitrix.portalDomain}/oauth/authorize/?${params.toString()}`;
}

/**
 * Exchange an authorisation code for access + refresh tokens.
 * Call this once from your /oauth/callback route.
 */
async function exchangeCode(code) {
  const url = `https://${config.bitrix.portalDomain}/oauth/token/`;
  const params = {
    grant_type:    'authorization_code',
    client_id:     config.bitrix.clientId,
    client_secret: config.bitrix.clientSecret,
    redirect_uri:  config.bitrix.redirectUri,
    code,
  };

  const response = await axios.get(url, { params, timeout: config.bitrix.timeout });
  _tokens = {
    accessToken:  response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
  saveTokensToFile();
  logger.info('[bitrix] OAuth tokens obtained via code exchange');
  return _tokens;
}

/**
 * Refresh the access token using the stored refresh token.
 */
async function refreshAccessToken() {
  logger.info('[bitrix] Refreshing access token…');
  const url = `https://${config.bitrix.portalDomain}/oauth/token/`;
  const params = {
    grant_type:    'refresh_token',
    client_id:     config.bitrix.clientId,
    client_secret: config.bitrix.clientSecret,
    refresh_token: _tokens.refreshToken,
  };

  const response = await axios.get(url, { params, timeout: config.bitrix.timeout });
  _tokens = {
    accessToken:  response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
  saveTokensToFile();
  logger.info('[bitrix] Access token refreshed successfully');
  return _tokens.accessToken;
}

// ─── REST API client ──────────────────────────────────────────────────────────

const baseURL = (domain) => `https://${domain}/rest/`;

/**
 * Call a Bitrix24 REST API method.
 * Automatically refreshes the access token on 401 and retries once.
 *
 * @param {string} method - e.g. 'crm.lead.update'
 * @param {object} params - Method parameters
 * @returns {Promise<*>}  - The `result` field of the API response
 */
async function callBitrix(method, params = {}) {
  return withRetry(
    async (attempt) => {
      try {
        const url = `${baseURL(config.bitrix.portalDomain)}${method}`;
        const body = { ...params, auth: _tokens.accessToken };

        logger.debug(`[bitrix] Calling ${method}`, { attempt });

        const response = await axios.post(url, body, {
          timeout: config.bitrix.timeout,
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.data.error) {
          const err = new Error(`Bitrix24 API error: ${response.data.error} — ${response.data.error_description}`);
          err.bitrixError = response.data.error;
          throw err;
        }

        return response.data.result;
      } catch (err) {
        // If Bitrix24 returns EXPIRED_TOKEN, refresh and retry
        if (err.bitrixError === 'expired_token' || (err.response && err.response.status === 401)) {
          logger.warn('[bitrix] Token expired, refreshing…');
          await refreshAccessToken();
          // Re-throw to trigger retry
          const retryErr = new Error('Token refreshed, retrying');
          retryErr.code = 'TOKEN_REFRESHED';
          throw retryErr;
        }
        throw err;
      }
    },
    {
      label: `bitrix.${method}`,
      shouldRetry: (err) => {
        if (err.code === 'TOKEN_REFRESHED') return true;
        return isTransientError(err);
      },
    }
  );
}

// ─── CRM operations ───────────────────────────────────────────────────────────

/**
 * Update a lead's fields in Bitrix24.
 *
 * @param {number|string} leadId
 * @param {object} fields - Key/value map of CRM fields to update
 */
async function updateLead(leadId, fields) {
  logger.info('[bitrix] Updating lead', { leadId, fields: Object.keys(fields) });
  return callBitrix('crm.lead.update', {
    id:     leadId,
    fields,
  });
}

/**
 * Create a task in Bitrix24.
 *
 * @param {object} taskData
 * @param {string}        taskData.title
 * @param {string}        taskData.description
 * @param {number|string} taskData.responsibleId - Assignee user ID
 * @param {Date}          taskData.deadline
 * @param {number|string} [taskData.leadId]      - Related CRM lead ID
 */
async function createTask({ title, description, responsibleId, deadline, leadId }) {
  logger.info('[bitrix] Creating task', { title, responsibleId, deadline });

  const fields = {
    TITLE:          title,
    DESCRIPTION:    description,
    RESPONSIBLE_ID: responsibleId,
    DEADLINE:       formatBitrixDate(deadline),
    PRIORITY:       '1', // High priority
  };

  // Attach to lead via UF field if provided
  if (leadId) {
    fields['UF_CRM_TASK'] = [`L_${leadId}`];
  }

  return callBitrix('tasks.task.add', { fields });
}

/**
 * Send a message in Bitrix24 Open Lines (IM).
 *
 * @param {string|number} dialogId - Dialog/chat ID from the webhook event
 * @param {string}        text     - Message text
 */
async function sendImMessage(dialogId, text) {
  logger.info('[bitrix] Sending IM message', { dialogId });
  return callBitrix('im.message.add', {
    DIALOG_ID: dialogId,
    MESSAGE:   text,
  });
}

/**
 * Retrieve a lead by ID.
 * @param {number|string} leadId
 */
async function getLead(leadId) {
  return callBitrix('crm.lead.get', { id: leadId });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a JS Date to Bitrix24 expected ISO 8601 string.
 * Bitrix24 REST expects: "YYYY-MM-DDTHH:MM:SS+HH:MM"
 */
function formatBitrixDate(date) {
  return date.toISOString().replace('Z', '+00:00');
}

/**
 * Calculate a task deadline based on SLA priority.
 * @param {number} priority - 1 (HOT) to 5 (COLD)
 * @returns {Date}
 */
function calculateDeadline(priority) {
  const hoursToAdd = config.sla[priority] ?? config.sla[4];
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hoursToAdd);
  return deadline;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  callBitrix,
  updateLead,
  createTask,
  sendImMessage,
  getLead,
  calculateDeadline,
  formatBitrixDate,
};
```

---

## `src/services/routing.js`

```js
// src/services/routing.js
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');

// Mapping from route_to label → manager pool name
const ROUTE_MAP = {
  sales:   'sales',
  tech:    'tech',
  quality: 'quality',
  marking: 'marking',
};

// Defaults for unknown / unmapped routes
const DEFAULT_POOL = 'sales';

// ─── Round-robin counter store ────────────────────────────────────────────────
// Uses Redis if available, otherwise a JSON file.

let _redisClient = null;
let _fileCounters = {};

async function _initRedis() {
  if (_redisClient) return _redisClient;
  if (config.redis.useFile) return null;

  try {
    const { createClient } = require('redis');
    const client = createClient({ url: config.redis.url });
    client.on('error', (err) => logger.error('[routing] Redis error', { error: err.message }));
    await client.connect();
    _redisClient = client;
    logger.info('[routing] Connected to Redis for round-robin counters');
    return client;
  } catch (err) {
    logger.warn('[routing] Redis unavailable for routing counters; using file fallback', {
      error: err.message,
    });
    _redisClient = null;
    return null;
  }
}

function _loadFileCounters() {
  try {
    const dir = path.dirname(config.redis.counterFile);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(config.redis.counterFile)) {
      _fileCounters = JSON.parse(fs.readFileSync(config.redis.counterFile, 'utf8'));
    }
  } catch (err) {
    logger.warn('[routing] Could not load counter file', { error: err.message });
  }
}

function _saveFileCounters() {
  try {
    const dir = path.dirname(config.redis.counterFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.redis.counterFile, JSON.stringify(_fileCounters, null, 2), 'utf8');
  } catch (err) {
    logger.error('[routing] Could not save counter file', { error: err.message });
  }
}

_loadFileCounters();

/**
 * Atomically increment a counter for a pool and return the new value.
 * Used to implement round-robin assignment.
 */
async function _incrementCounter(pool) {
  const key = `fnr:routing:${pool}`;

  const redis = await _initRedis();
  if (redis) {
    try {
      return Number(await redis.incr(key));
    } catch (err) {
      logger.warn('[routing] Redis incr failed, falling back to file', { error: err.message });
    }
  }

  // File fallback
  _fileCounters[key] = (_fileCounters[key] || 0) + 1;
  _saveFileCounters();
  return _fileCounters[key];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Select the next manager for a given pool using round-robin.
 *
 * @param {string} pool - Pool name: 'sales' | 'tech' | 'quality' | 'marking'
 * @returns {Promise<number>} Bitrix24 user ID of the selected manager
 */
async function getNextManager(pool) {
  const normalised = (ROUTE_MAP[pool] || DEFAULT_POOL);
  const managers   = config.managers[normalised];

  if (!managers || managers.length === 0) {
    logger.warn('[routing] No managers configured for pool, using default', { pool: normalised });
    return config.managers[DEFAULT_POOL][0];
  }

  if (managers.length === 1) {
    return managers[0];
  }

  const counter = await _incrementCounter(normalised);
  const index   = (counter - 1) % managers.length;
  const manager = managers[index];

  logger.info('[routing] Assigned manager via round-robin', {
    pool: normalised,
    counter,
    index,
    managerId: manager,
  });

  return manager;
}

/**
 * Resolve the pool name from a GPT-4 classification result.
 *
 * @param {object} classification - Output of classifyMessage()
 * @returns {string} Pool name
 */
function resolvePool(classification) {
  const { route_to, intent } = classification;

  // Direct route_to takes priority
  if (route_to && ROUTE_MAP[route_to]) {
    return ROUTE_MAP[route_to];
  }

  // Fallback mapping by intent
  const intentMap = {
    quote_request:   'sales',
    order_placement: 'sales',
    reorder:         'sales',
    design_question: 'tech',
    technical_issue: 'quality',
    delivery_inquiry:'sales',
    general_inquiry: 'sales',
    spam:            'sales',
  };

  return intentMap[intent] || DEFAULT_POOL;
}

/**
 * Build a human-readable task title based on classification.
 */
function buildTaskTitle(classification, leadId) {
  const intentLabels = {
    quote_request:    'Запрос КП',
    order_placement:  'Новый заказ',
    reorder:          'Повторный заказ',
    design_question:  'Вопрос по макету',
    technical_issue:  'Рекламация',
    delivery_inquiry: 'Запрос по доставке',
    general_inquiry:  'Общий запрос',
    spam:             'Спам',
  };

  const productLabels = {
    wide_format: 'Широкоформатная печать',
    interior:    'Интерьерная печать',
    souvenirs:   'Сувениры',
    polygraphy:  'Полиграфия',
    labeling:    'Маркировка',
    express:     'Срочный заказ',
    post_print:  'Постпечать',
    unknown:     'Продукт не определён',
  };

  const intentLabel   = intentLabels[classification.intent]      || classification.intent;
  const productLabel  = productLabels[classification.product_type] || classification.product_type;
  const priorityLabel = classification.priority === 1 ? ' [HOT]' : '';

  return `[Лид #${leadId}]${priorityLabel} ${intentLabel} — ${productLabel}`;
}

/**
 * Build the task description from the classification and extracted data.
 */
function buildTaskDescription(classification, leadId) {
  const { extracted_data: d } = classification;
  const lines = [
    `Лид: #${leadId}`,
    `Намерение: ${classification.intent}`,
    `Продукт: ${classification.product_type}`,
    `Срочность: ${classification.urgency}`,
    `Приоритет: P${classification.priority}`,
    '',
    '─── Данные из заявки ───',
  ];

  if (d.contact_name)  lines.push(`Клиент: ${d.contact_name}`);
  if (d.company)       lines.push(`Компания: ${d.company}`);
  if (d.contact_phone) lines.push(`Телефон: ${d.contact_phone}`);
  if (d.contact_email) lines.push(`Email: ${d.contact_email}`);
  if (d.quantity)      lines.push(`Тираж: ${d.quantity}`);
  if (d.dimensions)    lines.push(`Размеры: ${d.dimensions}`);
  if (d.material)      lines.push(`Материал: ${d.material}`);
  if (d.deadline)      lines.push(`Срок клиента: ${d.deadline}`);
  if (d.budget)        lines.push(`Бюджет: ${d.budget} руб.`);
  if (d.has_files && d.file_names.length) {
    lines.push(`Файлы: ${d.file_names.join(', ')}`);
  }
  if (d.notes) lines.push(`Примечания: ${d.notes}`);

  return lines.join('\n');
}

module.exports = {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
  ROUTE_MAP,
};
```

---

## `src/routes/webhook.js`

```js
// src/routes/webhook.js
'use strict';

const express = require('express');
const router = express.Router();

const logger = require('../utils/logger');
const { classifyMessage } = require('../services/lmstudio');
const {
  updateLead,
  createTask,
  sendImMessage,
  calculateDeadline,
} = require('../services/bitrix');
const {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
} = require('../services/routing');

// ─── Event dispatcher ─────────────────────────────────────────────────────────

/**
 * POST /webhook
 * Main entry point for all Bitrix24 webhook events.
 * Bitrix24 sends event data as URL-encoded or JSON body.
 */
router.post('/', async (req, res) => {
  // Respond immediately to prevent Bitrix24 timeout (max ~5 s)
  res.status(200).json({ ok: true });

  const body = req.body || {};
  const event = body.event || body.EVENT;

  if (!event) {
    logger.warn('[webhook] Received request with no event field', { body });
    return;
  }

  logger.info('[webhook] Event received', { event });

  try {
    switch (event.toUpperCase()) {
      case 'ONCRMLEADADD':
        await handleCrmLeadAdd(body);
        break;

      case 'ONIMCONNECTORMESSAGEADD':
        await handleImMessageAdd(body);
        break;

      default:
        logger.warn('[webhook] Unhandled event type', { event });
    }
  } catch (err) {
    logger.error('[webhook] Unhandled error in event processing', {
      event,
      error: err.message,
      stack: err.stack,
    });
  }
});

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle onCrmLeadAdd — a new lead was created in Bitrix24 CRM.
 */
async function handleCrmLeadAdd(body) {
  // Bitrix24 wraps event data under data[FIELDS] or data[LEAD]
  const data   = body.data || body.DATA || {};
  const fields = data.FIELDS || data.fields || data;
  const leadId = fields.ID || fields.id;

  if (!leadId) {
    logger.warn('[webhook:crmLeadAdd] Missing lead ID in event payload', { fields });
    return;
  }

  logger.info('[webhook:crmLeadAdd] Processing new lead', { leadId });

  // Extract contact / message data from the lead fields
  const message = [
    fields.COMMENTS,
    fields.TITLE,
    fields.SOURCE_DESCRIPTION,
  ].filter(Boolean).join('\n\n') || '(нет описания)';

  const contactName  = [fields.NAME, fields.SECOND_NAME, fields.LAST_NAME].filter(Boolean).join(' ') || null;
  const contactPhone = (fields.PHONE && fields.PHONE[0]?.VALUE) || null;
  const contactEmail = (fields.EMAIL && fields.EMAIL[0]?.VALUE) || null;

  await processLeadClassification({
    leadId,
    message,
    contactName,
    contactPhone,
    contactEmail,
    fileNames: [],
    dialogId: null,
  });
}

/**
 * Handle onImConnectorMessageAdd — a new message arrived via Open Lines / connector.
 */
async function handleImMessageAdd(body) {
  const data    = body.data || body.DATA || {};
  const message = data.MESSAGE || data.message || data.CONTENT || '';
  const leadId  = data.CRM_ENTITY_ID || data.crm_entity_id || null;
  const dialogId = data.DIALOG_ID || data.dialog_id || null;

  // Extract attachments
  const files    = data.FILES || data.files || data.ATTACHMENTS || [];
  const fileNames = Array.isArray(files)
    ? files.map((f) => f.NAME || f.name || String(f)).filter(Boolean)
    : [];

  // Contact data (from connector user)
  const connectorUser = data.USER || data.user || {};
  const contactName   = connectorUser.NAME  || connectorUser.name  || null;
  const contactPhone  = connectorUser.PHONE || connectorUser.phone || null;
  const contactEmail  = connectorUser.EMAIL || connectorUser.email || null;

  logger.info('[webhook:imMessage] Processing IM message', { leadId, dialogId, fileCount: fileNames.length });

  if (!message) {
    logger.warn('[webhook:imMessage] Empty message body, skipping');
    return;
  }

  await processLeadClassification({
    leadId,
    message,
    contactName,
    contactPhone,
    contactEmail,
    fileNames,
    dialogId,
  });
}

// ─── Core orchestration ───────────────────────────────────────────────────────

/**
 * Full pipeline: classify → route → update lead → create task → auto-reply.
 */
async function processLeadClassification({
  leadId,
  message,
  contactName,
  contactPhone,
  contactEmail,
  fileNames,
  dialogId,
}) {
  // Step 1: Classify with GPT-4
  let classification;
  try {
    classification = await classifyMessage({
      message,
      contactName,
      contactPhone,
      contactEmail,
      fileNames,
    });
  } catch (err) {
    logger.error('[pipeline] GPT-4 classification failed', { leadId, error: err.message });
    // Still send a generic auto-reply if we have a dialog
    if (dialogId) {
      await safeCall(() =>
        sendImMessage(dialogId, 'Ваше сообщение получено. Менеджер свяжется с вами в ближайшее время.')
      );
    }
    return;
  }

  const { intent, product_type, urgency, route_to, priority, auto_reply, extracted_data } = classification;

  logger.info('[pipeline] Classification result', { leadId, intent, product_type, priority, route_to });

  // Step 2: Resolve pool & select manager
  const pool      = resolvePool(classification);
  const managerId = await getNextManager(pool);

  logger.info('[pipeline] Manager assigned', { leadId, pool, managerId });

  // Step 3: Update lead fields in Bitrix24
  if (leadId) {
    const crmFields = buildCrmFields(classification, managerId);
    await safeCall(
      () => updateLead(leadId, crmFields),
      `[pipeline] Failed to update lead ${leadId}`
    );
  }

  // Step 4: Create SLA task
  if (leadId) {
    const deadline = calculateDeadline(priority);
    const taskTitle = buildTaskTitle(classification, leadId);
    const taskDescription = buildTaskDescription(classification, leadId);

    await safeCall(
      () => createTask({
        title:         taskTitle,
        description:   taskDescription,
        responsibleId: managerId,
        deadline,
        leadId,
      }),
      '[pipeline] Failed to create task'
    );
  }

  // Step 5: Send auto-reply
  if (dialogId && auto_reply) {
    await safeCall(
      () => sendImMessage(dialogId, auto_reply),
      '[pipeline] Failed to send auto-reply'
    );
  }

  logger.info('[pipeline] Lead processing complete', { leadId, dialogId, priority });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map GPT-4 classification to Bitrix24 CRM field names.
 * Adjust field names to match your Bitrix24 configuration / custom fields.
 */
function buildCrmFields(classification, managerId) {
  const { intent, product_type, urgency, priority, extracted_data: d } = classification;

  const fields = {
    // Standard Bitrix24 CRM fields
    ASSIGNED_BY_ID: managerId,

    // Custom fields (UF_) — adjust names to your Bitrix24 installation
    UF_CRM_REQUEST_TYPE:   intent,
    UF_CRM_PRODUCT_TYPE:   product_type,
    UF_CRM_URGENCY:        urgency,
    UF_CRM_AI_PRIORITY:    String(priority),

    // Source comment
    COMMENTS: `[AI] Классифицировано: ${intent} / ${product_type} / P${priority}`,
  };

  // Populate contact fields if extracted
  if (d.contact_name)  fields.NAME  = d.contact_name;
  if (d.contact_phone) fields.PHONE = [{ VALUE: d.contact_phone, VALUE_TYPE: 'WORK' }];
  if (d.contact_email) fields.EMAIL = [{ VALUE: d.contact_email, VALUE_TYPE: 'WORK' }];
  if (d.company)       fields.COMPANY_TITLE = d.company;

  // Optionally set budget
  if (d.budget) {
    fields.OPPORTUNITY = d.budget;
    fields.CURRENCY_ID = 'RUB';
  }

  return fields;
}

/**
 * Execute an async call, logging errors without propagating.
 * Used to ensure one failed step doesn't abort the entire pipeline.
 */
async function safeCall(fn, label = '[pipeline:safeCall]') {
  try {
    return await fn();
  } catch (err) {
    logger.error(`${label}: ${err.message}`, { stack: err.stack });
    return null;
  }
}

module.exports = router;
```

---

## `src/server.js`

```js
// src/server.js
'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const helmet     = require('helmet');

const config    = require('../config/config');
const logger    = require('./utils/logger');
const { verifyWebhookSignature } = require('./middleware/auth');
const { webhookRateLimit }       = require('./middleware/rateLimit');
const webhookRouter              = require('./routes/webhook');
const { getAuthUrl, exchangeCode } = require('./services/bitrix');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// Trust first proxy (e.g. nginx, Cloudflare) for correct client IP in rate limiting
app.set('trust proxy', 1);

// ─── Raw body capture (required for HMAC verification) ───────────────────────
app.use(
  bodyParser.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: '5mb',
    verify: (req, _res, buf) => {
      if (!req.rawBody) req.rawBody = buf;
    },
  })
);

// ─── Health check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'flex-n-roll-webhook',
    timestamp: new Date().toISOString(),
    env: config.server.nodeEnv,
  });
});

// ─── OAuth 2.0 routes ─────────────────────────────────────────────────────────

/**
 * GET /oauth/init
 * Redirects the administrator to Bitrix24 OAuth consent screen.
 * Visit this URL once to bootstrap tokens.
 */
app.get('/oauth/init', (_req, res) => {
  const url = getAuthUrl();
  logger.info('[oauth] Redirecting to Bitrix24 auth URL');
  res.redirect(url);
});

/**
 * GET /oauth/callback
 * Bitrix24 redirects here with ?code=... after user grants access.
 */
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  try {
    await exchangeCode(code);
    logger.info('[oauth] Tokens obtained and saved');
    res.json({ ok: true, message: 'OAuth tokens saved. You may close this tab.' });
  } catch (err) {
    logger.error('[oauth] Token exchange failed', { error: err.message });
    res.status(500).json({ error: 'Token exchange failed', detail: err.message });
  }
});

// ─── Webhook routes ───────────────────────────────────────────────────────────
app.use(
  '/webhook',
  webhookRateLimit,
  verifyWebhookSignature,
  webhookRouter
);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('[server] Unhandled Express error', {
    error: err.message,
    stack: err.stack,
    path:  req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = config.server.port;

const server = app.listen(PORT, () => {
  logger.info(`[server] FLEX-N-ROLL webhook listening on port ${PORT}`, {
    env:  config.server.nodeEnv,
    port: PORT,
  });
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`[server] Received ${signal}, shutting down gracefully…`);
  server.close((err) => {
    if (err) {
      logger.error('[server] Error during shutdown', { error: err.message });
      process.exit(1);
    }
    logger.info('[server] Server closed. Goodbye.');
    process.exit(0);
  });

  // Force shutdown after 15 seconds
  setTimeout(() => {
    logger.warn('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = app; // Export for testing
```

---

## `Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only (layer cached separately)
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 webhook

# Copy installed modules and app code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pre-create runtime directories and set ownership
RUN mkdir -p logs data && chown -R webhook:nodejs logs data

USER webhook

EXPOSE 3000

CMD ["node", "src/server.js"]
```

---

## `docker-compose.yml`

```yaml
version: "3.9"

services:
  webhook:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fnr-webhook
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    networks:
      - fnr-net

  redis:
    image: redis:7.2-alpine
    container_name: fnr-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - fnr-net

volumes:
  redis-data:

networks:
  fnr-net:
    driver: bridge
```

---

## `README.md`

```markdown
# FLEX-N-ROLL PRO — Bitrix24 × OpenAI Webhook

Production-ready Node.js/Express сервер для интеграции Битрикс24 с OpenAI GPT-4.  
Получает входящие события CRM, классифицирует запросы через GPT-4, обновляет лиды,
назначает менеджеров (round-robin), создаёт задачи по SLA и отправляет автоответы.

---

## Быстрый старт

### Требования

- Node.js ≥ 20
- Redis 7+ (опционально, иначе используется файловый fallback)
- Доступ к интернету для OpenAI API и Bitrix24

### 1. Клонировать и установить зависимости

```bash
git clone <repo-url> flex-n-roll-webhook
cd flex-n-roll-webhook
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Открыть .env и заполнить все обязательные поля
```

Обязательные переменные:

| Переменная | Описание |
|---|---|
| `WEBHOOK_SECRET` | Секрет для проверки HMAC-подписи |
| `OPENAI_API_KEY` | Ключ OpenAI API |
| `BITRIX_CLIENT_ID` | Client ID OAuth-приложения Bitrix24 |
| `BITRIX_CLIENT_SECRET` | Client Secret OAuth-приложения Bitrix24 |
| `BITRIX_PORTAL_DOMAIN` | Домен портала, напр. `mycompany.bitrix24.ru` |
| `BITRIX_REDIRECT_URI` | URI callback, напр. `https://yourserver.com/oauth/callback` |

### 3. OAuth-авторизация Bitrix24 (один раз)

```bash
npm start
# Открыть в браузере:
# http://localhost:3000/oauth/init
# → авторизоваться на портале → токены сохранятся автоматически
```

### 4. Запуск (локально)

```bash
npm run dev    # режим разработки (nodemon)
npm start      # production
```

### 5. Запуск через Docker Compose

```bash
docker compose up -d
docker compose logs -f webhook
```

---

## Архитектура

```
Bitrix24 Event
      │
      ▼
POST /webhook
      │
  [Rate Limit] ──── 429 Too Many Requests
      │
  [HMAC Auth] ────── 401 Unauthorized
      │
  routes/webhook.js
      │
      ├─ onCrmLeadAdd
      └─ onImConnectorMessageAdd
                │
      processLeadClassification()
                │
      services/openai.js (GPT-4)
                │
      ┌─────────┴──────────┐
      │                    │
services/bitrix.js   services/routing.js
crm.lead.update()    Round-robin manager
tasks.task.add()     Redis / file counter
im.message.add()
```

---

## Эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/health` | Статус сервиса |
| `GET` | `/oauth/init` | Начать OAuth-авторизацию Bitrix24 |
| `GET` | `/oauth/callback` | Callback Bitrix24 OAuth |
| `POST` | `/webhook` | Входящие события Bitrix24 |

---

## Поддерживаемые события Bitrix24

| Событие | Описание |
|---|---|
| `onCrmLeadAdd` | Создание нового лида в CRM |
| `onImConnectorMessageAdd` | Новое сообщение в Open Lines |

---

## Маршрутизация менеджеров

| Пул | Менеджеры (ID) | Для каких intent |
|---|---|---|
| `sales`   | 1, 2, 3 | quote_request, order_placement, reorder, delivery_inquiry |
| `tech`    | 4       | design_question |
| `quality` | 5       | technical_issue |
| `marking` | 6       | labeling |

Алгоритм: **round-robin** с атомарным счётчиком в Redis (fallback — JSON-файл).

---

## SLA дедлайны

| Приоритет | Название | Дедлайн |
|---|---|---|
| P1 | HOT | 1 час |
| P2 | — | 4 часа |
| P3 | — | 8 часов |
| P4 | — | 24 часа |
| P5 | COLD | 48 часов |

---

## Retry-логика

- **3 попытки** с **exponential backoff + full jitter**
- База: 500 мс, максимум: 8 000 мс
- Retry: сетевые ошибки, 5xx, 429 (rate limit)
- Не retry: 4xx клиентские ошибки (кроме 429)

---

## Логирование (Winston)

| Файл | Содержимое |
|---|---|
| `logs/combined.log` | Все уровни, ротация 20 MB × 14 дней |
| `logs/error.log` | Только ошибки, 10 MB × 30 дней |
| `logs/exceptions.log` | Необработанные исключения |
| `logs/rejections.log` | Unhandled promise rejections |

В `development` — colorize консоль; в `production` — JSON в консоль + файлы.

---

## Безопасность

- **HMAC-SHA256** верификация каждого вебхук-запроса (timing-safe сравнение)
- **Rate limiting** (60 req/min, настраивается)
- **Helmet** HTTP-заголовки безопасности
- **Non-root Docker** пользователь
- OAuth-токены хранятся в файле вне репозитория
- `.env` не коммитится (добавить в `.gitignore`)

---

## Лицензия

UNLICENSED — внутренний проект FLEX-N-ROLL PRO.
```
```

---

## МОДУЛЬ 3.3 — СТАТУС-БОТ TELEGRAM (Node.js + Telegraf)

> **Промт для Claude Code CLI:**  
> "Создай Node.js проект `flex-n-roll-bot` по следующей структуре. Создай все файлы с полным кодом."

# FLEX-N-ROLL PRO — Telegram Status Bot
## Production-ready код: полный листинг всех файлов

Стек: **Node.js 20, Telegraf v4, Битрикс24 REST API, Express, Winston, rate-limiter-flexible**

---

## Структура проекта

```
flex-n-roll-bot/
├── src/
│   ├── bot.js
│   ├── services/
│   │   ├── bitrix.js
│   │   ├── notify.js
│   │   └── logger.js
│   ├── handlers/
│   │   ├── start.js
│   │   ├── order.js
│   │   ├── nps.js
│   │   └── faq.js
│   ├── webhook/
│   │   └── bitrixWebhook.js
│   └── utils/
│       └── stageMapper.js
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## `package.json`

```json
{
  "name": "flex-n-roll-bot",
  "version": "1.0.0",
  "description": "Telegram-бот для информирования клиентов FLEX-N-ROLL PRO о статусе заказа",
  "main": "src/bot.js",
  "scripts": {
    "start": "node src/bot.js",
    "dev": "nodemon src/bot.js",
    "lint": "eslint src/**/*.js"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "axios": "^1.6.8",
    "express": "^4.18.3",
    "dotenv": "^16.4.5",
    "rate-limiter-flexible": "^5.0.3",
    "winston": "^3.13.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "eslint": "^8.57.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

---

## `.env.example`

```dotenv
# ─── Telegram ────────────────────────────────────────────────
# Токен бота от @BotFather
BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Секрет для защиты вебхук-эндпоинта Telegram (произвольная строка)
TELEGRAM_WEBHOOK_SECRET=change_me_telegram_webhook_secret

# URL вашего сервера (ngrok / публичный домен) — без слеша в конце
BOT_WEBHOOK_URL=https://your-domain.example.com

# ─── Битрикс24 ───────────────────────────────────────────────
# Базовый URL портала (без слеша в конце)
B24_BASE_URL=https://your-portal.bitrix24.ru

# Токен входящего вебхука Битрикс24 (REST API)
# Создать: Портал → Разработчикам → Входящий вебхук
B24_WEBHOOK_TOKEN=xxxxxxxxxxxxxxxxxxxx

# Секрет для проверки входящих вебхуков от Битрикс24
B24_WEBHOOK_SECRET=change_me_b24_webhook_secret

# ─── ID полей сделки ─────────────────────────────────────────
B24_ORDER_NUMBER_FIELD=UF_CRM_ORDER_NUMBER
B24_TELEGRAM_CHATID_FIELD=UF_CRM_TELEGRAM_CHAT_ID
B24_PROOF_PHOTO_FIELD=UF_CRM_PROOF_PHOTO
B24_NPS_SCORE_FIELD=UF_CRM_NPS_SCORE
B24_NPS_COMMENT_FIELD=UF_CRM_NPS_COMMENT

# ─── ID воронки / pipeline ────────────────────────────────────
# ID воронки (категории) сделок
# Посмотреть: crm.dealcategory.list
B24_PIPELINE_ID=1

# ─── Маппинг стадий воронки ───────────────────────────────────
# Получить ID стадий: crm.dealcategory.stages?id=<B24_PIPELINE_ID>
# Примеры ID: C1:STAGE_1, C1:STAGE_2, ...
B24_STAGE_CONTRACT=C1:STAGE_1
B24_STAGE_TECH=C1:STAGE_2
B24_STAGE_PRINT1=C1:STAGE_3
B24_STAGE_PRINT2=C1:STAGE_4
B24_STAGE_QC=C1:STAGE_5
B24_STAGE_READY=C1:STAGE_6
B24_STAGE_SHIPPED=C1:STAGE_7
B24_STAGE_REPEAT=C1:STAGE_8

# ─── Сервер ──────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# ─── Rate limiting ────────────────────────────────────────────
RATE_LIMIT_POINTS=10
RATE_WINDOW_SEC=60
```

---

## `Dockerfile`

```dockerfile
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package files первыми — для кэширования Docker слоёв
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --omit=dev

# Копируем исходный код
COPY src/ ./src/

# Создаём директорию для логов
RUN mkdir -p logs

# Запускаем от непривилегированного пользователя
USER node

EXPOSE 3000

CMD ["node", "src/bot.js"]
```

---

## `docker-compose.yml`

```yaml
version: '3.9'

services:
  bot:
    build: .
    container_name: flex-n-roll-bot
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    volumes:
      - ./logs:/app/logs
    networks:
      - botnet
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${PORT:-3000}/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

networks:
  botnet:
    driver: bridge
```

---

## `src/utils/stageMapper.js`

```js
/**
 * stageMapper.js
 * Маппинг стадий сделки Битрикс24 → текстовый статус для клиента.
 *
 * Битрикс24 использует два формата ID стадий:
 *   1. Системные: NEW, PREPARATION, QUALIFICATION, WON, LOST
 *   2. Пользовательские (в воронке): C{PIPELINE_ID}:STAGE_{N}
 *
 * Для получения актуальных ID используйте:
 *   crm.dealcategory.stages?id={PIPELINE_ID}
 */

'use strict';

/**
 * Статический маппинг системных стадий.
 */
const SYSTEM_STAGE_MAP = {
  // ─── Системные стадии ─────────────────────────────────────
  NEW: {
    label: '📋 Новый заказ получен',
    emoji: '📋',
    description: 'Ваш заказ зарегистрирован в системе.',
  },
  PREPARATION: {
    label: '⚙️ Техническая подготовка',
    emoji: '⚙️',
    description: 'Технологи готовят макет к производству.',
  },
  QUALIFICATION: {
    label: '🔍 Квалификация',
    emoji: '🔍',
    description: 'Менеджер уточняет детали заказа.',
  },
  WON: {
    label: '✅ Заказ выполнен',
    emoji: '✅',
    description: 'Заказ успешно выполнен. Спасибо, что выбрали нас!',
  },
  LOST: {
    label: '❌ Заказ отменён',
    emoji: '❌',
    description: 'Заказ был отменён. По вопросам обращайтесь к менеджеру.',
  },
};

/**
 * Описания для стадий, загружаемых из env (B24_STAGE_*).
 */
const ENV_STAGE_DEFINITIONS = {
  B24_STAGE_CONTRACT: {
    label: '📦 В очереди на производство',
    emoji: '📦',
    description: 'Договор подписан, оплата получена. Заказ поставлен в производственную очередь.',
  },
  B24_STAGE_TECH: {
    label: '⚙️ Техническая подготовка',
    emoji: '⚙️',
    description: 'Технологи прорабатывают макет и технические условия.',
  },
  B24_STAGE_PRINT1: {
    label: '🖨️ В печати',
    emoji: '🖨️',
    description: 'Заказ запущен в печать. Этап 1 производства.',
  },
  B24_STAGE_PRINT2: {
    label: '✂️ Финишная обработка',
    emoji: '✂️',
    description: 'Печать завершена. Выполняется финишная обработка (резка, ламинация, сборка).',
  },
  B24_STAGE_QC: {
    label: '🔬 Контроль качества ОТК',
    emoji: '🔬',
    description: 'Отдел технического контроля проверяет готовую продукцию.',
  },
  B24_STAGE_READY: {
    label: '📫 Готов к отгрузке',
    emoji: '📫',
    description: 'Заказ упакован и ожидает отправки.',
  },
  B24_STAGE_SHIPPED: {
    label: '🚚 Отгружен',
    emoji: '🚚',
    description: 'Заказ передан в доставку.',
  },
  B24_STAGE_REPEAT: {
    label: '🏁 Завершён',
    emoji: '🏁',
    description: 'Заказ выполнен и доставлен клиенту.',
  },
};

/**
 * Строит итоговую карту stage_id → info из статики + env.
 * @returns {Map<string, {label, emoji, description}>}
 */
function buildStageMap() {
  const map = new Map(Object.entries(SYSTEM_STAGE_MAP));
  for (const [envKey, stageInfo] of Object.entries(ENV_STAGE_DEFINITIONS)) {
    const stageId = process.env[envKey];
    if (stageId && stageId.trim()) {
      map.set(stageId.trim(), stageInfo);
    }
  }
  return map;
}

// Singleton
let _stageMap = null;

function getStageMap() {
  if (!_stageMap) _stageMap = buildStageMap();
  return _stageMap;
}

/**
 * Получить информацию о стадии по ID.
 * @param {string} stageId
 * @returns {{label: string, emoji: string, description: string}}
 */
function getStageInfo(stageId) {
  const map = getStageMap();
  return (
    map.get(stageId) || {
      label: `📊 Статус: ${stageId}`,
      emoji: '📊',
      description: 'Заказ обрабатывается. Уточните статус у менеджера.',
    }
  );
}

function getStageLabel(stageId) {
  return getStageInfo(stageId).label;
}

function getStageDescription(stageId) {
  return getStageInfo(stageId).description;
}

/**
 * Сформировать полное сообщение о статусе заказа для Telegram.
 * @param {object} deal — объект сделки из Битрикс24
 * @returns {string}
 */
function buildStatusMessage(deal) {
  const stageId = deal.STAGE_ID;
  const { label, description } = getStageInfo(stageId);
  const orderNumber =
    deal[process.env.B24_ORDER_NUMBER_FIELD || 'UF_CRM_ORDER_NUMBER'] || deal.ID;
  const title = deal.TITLE || `Заказ #${orderNumber}`;

  return (
    `*${title}*\n` +
    `\n` +
    `*Статус:* ${label}\n` +
    `${description}\n` +
    `\n` +
    `_Обновлено: ${formatDate(deal.DATE_MODIFY)}_`
  );
}

/**
 * Форматировать дату из Битрикс24.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

module.exports = {
  getStageMap,
  getStageInfo,
  getStageLabel,
  getStageDescription,
  buildStatusMessage,
  formatDate,
};
```

---

## `src/services/logger.js`

```js
/**
 * logger.js
 * Центральный логгер на базе winston.
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_LEVEL =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production' || process.stdout.isTTY) {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
} else {
  logger.add(new transports.Console({ format: format.json() }));
}

module.exports = logger;
```

---

## `src/services/bitrix.js`

```js
/**
 * bitrix.js
 * Клиент для работы с Битрикс24 REST API через входящий вебхук.
 *
 * Документация: https://dev.1c-bitrix.ru/rest_help/
 */

'use strict';

const axios = require('axios');
const logger = require('./logger');

const BASE_URL = process.env.B24_BASE_URL;
const WEBHOOK_TOKEN = process.env.B24_WEBHOOK_TOKEN;
const ORDER_NUMBER_FIELD = process.env.B24_ORDER_NUMBER_FIELD || 'UF_CRM_ORDER_NUMBER';
const TELEGRAM_CHATID_FIELD =
  process.env.B24_TELEGRAM_CHATID_FIELD || 'UF_CRM_TELEGRAM_CHAT_ID';
const PROOF_PHOTO_FIELD = process.env.B24_PROOF_PHOTO_FIELD || 'UF_CRM_PROOF_PHOTO';
const NPS_SCORE_FIELD = process.env.B24_NPS_SCORE_FIELD || 'UF_CRM_NPS_SCORE';
const NPS_COMMENT_FIELD = process.env.B24_NPS_COMMENT_FIELD || 'UF_CRM_NPS_COMMENT';
const PIPELINE_ID = process.env.B24_PIPELINE_ID || '0';

const http = axios.create({
  baseURL: `${BASE_URL}/rest/${WEBHOOK_TOKEN}/`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  logger.debug(`[B24] → ${config.url}`, { params: config.params });
  return config;
});

http.interceptors.response.use(
  (res) => {
    if (res.data.error) {
      const err = new Error(res.data.error_description || res.data.error);
      err.b24Error = res.data.error;
      logger.error(`[B24] API error: ${err.message}`);
      throw err;
    }
    return res;
  },
  (err) => {
    logger.error(`[B24] HTTP error: ${err.message}`);
    throw err;
  }
);

/**
 * Вызов метода Битрикс24 REST API.
 * @param {string} method
 * @param {object} params
 * @returns {Promise<any>}
 */
async function call(method, params = {}) {
  const res = await http.post(`${method}.json`, params);
  return res.data.result;
}

// ─── Сделки ──────────────────────────────────────────────────────────────────

/**
 * Найти сделку по номеру заказа.
 * @param {string} orderNumber
 * @returns {Promise<object|null>}
 */
async function getDealByOrderNumber(orderNumber) {
  const result = await call('crm.deal.list', {
    filter: {
      [ORDER_NUMBER_FIELD]: orderNumber,
      ...(PIPELINE_ID !== '0' ? { CATEGORY_ID: PIPELINE_ID } : {}),
    },
    select: [
      'ID',
      'TITLE',
      'STAGE_ID',
      'DATE_MODIFY',
      'DATE_CREATE',
      'ASSIGNED_BY_ID',
      ORDER_NUMBER_FIELD,
      TELEGRAM_CHATID_FIELD,
      PROOF_PHOTO_FIELD,
      NPS_SCORE_FIELD,
      NPS_COMMENT_FIELD,
    ],
  });
  if (!result || result.length === 0) return null;
  return result[0];
}

/**
 * Получить сделку по ID.
 * @param {string|number} dealId
 * @returns {Promise<object>}
 */
async function getDealById(dealId) {
  return call('crm.deal.get', { id: dealId });
}

/**
 * Обновить поля сделки.
 * @param {string|number} dealId
 * @param {object} fields
 * @returns {Promise<boolean>}
 */
async function updateDeal(dealId, fields) {
  return call('crm.deal.update', { id: dealId, fields });
}

/**
 * Привязать Telegram chat_id к сделке.
 * @param {string|number} dealId
 * @param {string|number} chatId
 */
async function linkTelegramChatId(dealId, chatId) {
  return updateDeal(dealId, { [TELEGRAM_CHATID_FIELD]: String(chatId) });
}

/**
 * Сохранить NPS оценку и комментарий.
 * @param {string|number} dealId
 * @param {number} score
 * @param {string} [comment]
 */
async function saveNps(dealId, score, comment = '') {
  const fields = { [NPS_SCORE_FIELD]: score };
  if (comment) fields[NPS_COMMENT_FIELD] = comment;
  return updateDeal(dealId, fields);
}

// ─── Контакты ────────────────────────────────────────────────────────────────

async function getDealContacts(dealId) {
  return call('crm.deal.contact.items.get', { id: dealId });
}

async function getContact(contactId) {
  return call('crm.contact.get', { id: contactId });
}

// ─── Пользователи ────────────────────────────────────────────────────────────

async function getUser(userId) {
  const result = await call('user.get', { ID: userId });
  return Array.isArray(result) ? result[0] : result;
}

// ─── Файлы ───────────────────────────────────────────────────────────────────

/**
 * Получить прямую ссылку на фото пробной печати.
 * @param {object} deal
 * @returns {string|null}
 */
function extractProofPhotoUrl(deal) {
  const raw = deal[PROOF_PHOTO_FIELD];
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length > 0)
    return raw[0].downloadUrl || raw[0].url || null;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;
  if (typeof raw === 'object' && raw.url) return raw.url;
  return null;
}

// ─── Стадии ──────────────────────────────────────────────────────────────────

async function getDealStages(categoryId = PIPELINE_ID) {
  return call('crm.dealcategory.stages', { id: categoryId });
}

// ─── Timeline ────────────────────────────────────────────────────────────────

async function addTimelineComment(dealId, text) {
  return call('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID: dealId,
      ENTITY_TYPE: 'deal',
      COMMENT: text,
    },
  });
}

module.exports = {
  call,
  getDealByOrderNumber,
  getDealById,
  updateDeal,
  linkTelegramChatId,
  saveNps,
  getDealContacts,
  getContact,
  getUser,
  extractProofPhotoUrl,
  getDealStages,
  addTimelineComment,
  ORDER_NUMBER_FIELD,
  TELEGRAM_CHATID_FIELD,
  PROOF_PHOTO_FIELD,
  NPS_SCORE_FIELD,
  NPS_COMMENT_FIELD,
};
```

---

## `src/services/notify.js`

```js
/**
 * notify.js
 * Сервис push-уведомлений: отправляет сообщения клиентам при смене стадии.
 *
 * Вызывается из bitrixWebhook.js при получении события OnCrmDealUpdate.
 */

'use strict';

const { buildStatusMessage, getStageInfo } = require('../utils/stageMapper');
const { TELEGRAM_CHATID_FIELD, getDealById, addTimelineComment } = require('./bitrix');
const logger = require('./logger');

let _bot = null;

/**
 * Инициализировать сервис экземпляром Telegraf.
 * @param {import('telegraf').Telegraf} botInstance
 */
function init(botInstance) {
  _bot = botInstance;
  logger.info('[Notify] Push notification service initialized.');
}

/**
 * Отправить уведомление об изменении стадии сделки.
 * @param {string|number} dealId
 * @param {string|null} oldStageId
 * @param {string} newStageId
 */
async function notifyStageChange(dealId, oldStageId, newStageId) {
  if (!_bot) {
    logger.warn('[Notify] Bot not initialized, cannot send push notification.');
    return;
  }
  if (oldStageId === newStageId) return;

  let deal;
  try {
    deal = await getDealById(dealId);
  } catch (err) {
    logger.error(`[Notify] Failed to fetch deal #${dealId}: ${err.message}`);
    return;
  }

  const chatId = deal[TELEGRAM_CHATID_FIELD];
  if (!chatId) {
    logger.debug(`[Notify] Deal #${dealId} has no Telegram chat_id, skipping push.`);
    return;
  }

  const { label } = getStageInfo(newStageId);
  const statusText = buildStatusMessage(deal);

  const messageText =
    `🔔 *Статус вашего заказа изменён*\n\n` +
    statusText +
    `\n\n_Если у вас есть вопросы — нажмите /help_`;

  try {
    await _bot.telegram.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: buildStatusKeyboard(newStageId),
    });

    logger.info(`[Notify] Push sent to chat ${chatId} for deal #${dealId}: ${label}`);

    await addTimelineComment(
      dealId,
      `🤖 Бот отправил push-уведомление клиенту (chat_id: ${chatId})\nНовый статус: ${label}`
    ).catch((e) => logger.warn(`[Notify] Timeline comment failed: ${e.message}`));

    // При завершении/отгрузке — запустить NPS-опрос через 2 часа
    if (newStageId === 'WON' || isShippedStage(newStageId)) {
      await scheduleNpsSurvey(chatId, dealId);
    }
  } catch (err) {
    logger.error(`[Notify] Failed to send push to chat ${chatId}: ${err.message}`);
  }
}

/**
 * Запланировать NPS-опрос через 2 часа.
 * В production замените setTimeout на очередь задач (Bull/BullMQ).
 * @param {string|number} chatId
 * @param {string|number} dealId
 */
async function scheduleNpsSurvey(chatId, dealId) {
  const DELAY_MS = 2 * 60 * 60 * 1000;
  logger.info(`[Notify] NPS survey scheduled for chat ${chatId} in 2h`);

  setTimeout(async () => {
    try {
      if (!_bot) return;
      await _bot.telegram.sendMessage(
        chatId,
        `⭐ *Оцените ваш заказ*\n\n` +
          `Ваш заказ выполнен! Нам важно ваше мнение.\n` +
          `Пожалуйста, оцените качество работы по шкале от 1 до 10.`,
        {
          parse_mode: 'Markdown',
          reply_markup: buildNpsKeyboard(dealId),
        }
      );
      logger.info(`[Notify] NPS survey sent to chat ${chatId}`);
    } catch (err) {
      logger.error(`[Notify] Failed to send NPS survey to ${chatId}: ${err.message}`);
    }
  }, DELAY_MS);
}

/**
 * Отправить произвольное сообщение.
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [extra]
 */
async function sendMessage(chatId, text, extra = {}) {
  if (!_bot) {
    logger.warn('[Notify] Bot not initialized.');
    return;
  }
  try {
    await _bot.telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    logger.error(`[Notify] sendMessage to ${chatId} failed: ${err.message}`);
    throw err;
  }
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function isShippedStage(stageId) {
  return stageId === process.env.B24_STAGE_SHIPPED || stageId === 'WON';
}

/**
 * Inline-клавиатура под уведомлением о статусе.
 * @param {string} stageId
 * @returns {object}
 */
function buildStatusKeyboard(stageId) {
  const buttons = [[{ text: '📊 Проверить статус', callback_data: 'check_status' }]];

  const printStages = [
    process.env.B24_STAGE_PRINT1,
    process.env.B24_STAGE_PRINT2,
    process.env.B24_STAGE_QC,
  ].filter(Boolean);

  if (printStages.includes(stageId)) {
    buttons[0].push({ text: '📷 Фото пробной печати', callback_data: 'get_proof_photo' });
  }

  buttons.push([{ text: '❓ FAQ', callback_data: 'faq_main' }]);
  return { inline_keyboard: buttons };
}

/**
 * Inline-клавиатура NPS (оценки 1–10).
 * @param {string|number} dealId
 * @returns {object}
 */
function buildNpsKeyboard(dealId) {
  const row1 = [1, 2, 3, 4, 5].map((n) => ({
    text: String(n),
    callback_data: `nps_score_${dealId}_${n}`,
  }));
  const row2 = [6, 7, 8, 9, 10].map((n) => ({
    text: String(n),
    callback_data: `nps_score_${dealId}_${n}`,
  }));
  return { inline_keyboard: [row1, row2] };
}

module.exports = {
  init,
  notifyStageChange,
  scheduleNpsSurvey,
  sendMessage,
  buildNpsKeyboard,
  buildStatusKeyboard,
};
```

---

## `src/handlers/start.js`

```js
/**
 * handlers/start.js
 * Обработчик команд /start и /help.
 */

'use strict';

const { Markup } = require('telegraf');

/**
 * Главное меню с inline-кнопками.
 */
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Статус заказа', 'action_check_order')],
    [Markup.button.callback('📷 Фото пробной печати', 'get_proof_photo')],
    [Markup.button.callback('⭐ Оставить отзыв (NPS)', 'action_nps')],
    [Markup.button.callback('❓ FAQ', 'faq_main')],
  ]);
}

/**
 * Обработчик /start.
 */
async function handleStart(ctx) {
  const name = ctx.from.first_name || 'клиент';
  await ctx.replyWithMarkdown(
    `👋 Добро пожаловать, *${name}*!\n\n` +
      `Я бот типографии *FLEX\\-N\\-ROLL PRO*.\n` +
      `Помогу узнать статус заказа, прислать фото пробной печати и ответить на вопросы.\n\n` +
      `*Что я умею:*\n` +
      `• Показывать статус заказа по его номеру\n` +
      `• Присылать push-уведомления при смене статуса\n` +
      `• Отправлять фото пробной печати\n` +
      `• Отвечать на часто задаваемые вопросы\n\n` +
      `Выберите действие ниже или просто отправьте номер заказа:`,
    mainMenuKeyboard()
  );
}

/**
 * Обработчик /help.
 */
async function handleHelp(ctx) {
  await ctx.replyWithMarkdown(
    `*Справка по командам:*\n\n` +
      `/start — Главное меню\n` +
      `/status — Проверить статус заказа\n` +
      `/proof — Запросить фото пробной печати\n` +
      `/nps — Оставить отзыв о заказе\n` +
      `/faq — Часто задаваемые вопросы\n` +
      `/help — Эта справка\n\n` +
      `Или просто отправьте *номер заказа* (например: \`12345\`), и я покажу его статус.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Callback: вернуться в главное меню.
 */
async function handleMainMenuCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(`🏠 *Главное меню*\n\nВыберите действие:`, mainMenuKeyboard());
}

/**
 * Callback: инициировать проверку заказа.
 */
async function handleCheckOrderCallback(ctx) {
  await ctx.answerCbQuery();
  ctx.session = ctx.session || {};
  ctx.session.awaitingOrderNumber = true;
  await ctx.replyWithMarkdown(
    `📦 *Проверка статуса заказа*\n\n` +
      `Отправьте номер вашего заказа (только цифры или формат «ФЛ-ХХХХ»):`,
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'action_main_menu')]])
  );
}

module.exports = {
  handleStart,
  handleHelp,
  handleMainMenuCallback,
  handleCheckOrderCallback,
  mainMenuKeyboard,
};
```

---

## `src/handlers/order.js`

```js
/**
 * handlers/order.js
 * Обработка номера заказа: поиск в Битрикс24, отображение статуса,
 * привязка Telegram chat_id, фото пробной печати.
 */

'use strict';

const { Markup } = require('telegraf');
const bitrix = require('../services/bitrix');
const { buildStatusMessage, getStageInfo } = require('../utils/stageMapper');
const { buildStatusKeyboard } = require('../services/notify');
const logger = require('../services/logger');

// Номер заказа: цифры, или формат ФЛ-1234 / FL-1234 / FNR-1234
const ORDER_NUMBER_REGEX = /^(ФЛ|FL|FNR|FNRP)?[-–]?\d{1,10}$/i;

/**
 * Middleware: проверяет, является ли текст номером заказа.
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function orderMiddleware(ctx, next) {
  const text = ctx.message?.text?.trim();
  if (!text) return next();

  const isOrderNumber = ORDER_NUMBER_REGEX.test(text);
  const awaitingOrder = ctx.session?.awaitingOrderNumber;

  if (!isOrderNumber && !awaitingOrder) return next();

  if (ctx.session) ctx.session.awaitingOrderNumber = false;
  await handleOrderLookup(ctx, text);
}

/**
 * Основная логика поиска и отображения заказа.
 * @param {import('telegraf').Context} ctx
 * @param {string} orderNumber
 */
async function handleOrderLookup(ctx, orderNumber) {
  const chatId = ctx.from.id;
  const normalizedOrder = normalizeOrderNumber(orderNumber);

  const loadingMsg = await ctx.reply('🔍 Ищу ваш заказ...');

  let deal;
  try {
    deal = await bitrix.getDealByOrderNumber(normalizedOrder);
  } catch (err) {
    logger.error(`[Order] B24 error for order ${normalizedOrder}: ${err.message}`);
    await deleteMessage(ctx, loadingMsg);
    await ctx.replyWithMarkdown(
      `⚠️ Не удалось связаться с сервером. Попробуйте позже или обратитесь к менеджеру.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Попробовать снова', `retry_order_${normalizedOrder}`)],
      ])
    );
    return;
  }

  await deleteMessage(ctx, loadingMsg);

  if (!deal) {
    await ctx.replyWithMarkdown(
      `❌ *Заказ не найден*\n\n` +
        `Заказ с номером *${normalizedOrder}* не найден в системе.\n\n` +
        `Убедитесь, что номер введён верно. Если проблема сохраняется — обратитесь к менеджеру.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Ввести другой номер', 'action_check_order')],
        [Markup.button.callback('📞 Контакты', 'faq_contacts')],
      ])
    );
    return;
  }

  // ─── Проверка принадлежности заказа ───────────────────────────────────────
  const ownerChatId = deal[bitrix.TELEGRAM_CHATID_FIELD];

  if (ownerChatId && String(ownerChatId) !== String(chatId)) {
    logger.warn(`[Order] Chat ${chatId} tried to access deal #${deal.ID} owned by ${ownerChatId}`);
    await ctx.replyWithMarkdown(
      `⛔ *Доступ запрещён*\n\n` +
        `Этот заказ уже привязан к другому аккаунту.\n` +
        `Если вы уверены, что это ваш заказ — обратитесь к менеджеру.`,
      Markup.inlineKeyboard([[Markup.button.callback('📞 Контакты', 'faq_contacts')]])
    );
    return;
  }

  // ─── Привязка chat_id ──────────────────────────────────────────────────────
  if (!ownerChatId) {
    try {
      await bitrix.linkTelegramChatId(deal.ID, chatId);
      ctx.session = ctx.session || {};
      ctx.session.dealId = deal.ID;
      ctx.session.orderNumber = normalizedOrder;
      logger.info(`[Order] Linked chat ${chatId} to deal #${deal.ID}`);
    } catch (err) {
      logger.warn(`[Order] Failed to link chat_id for deal #${deal.ID}: ${err.message}`);
    }
  } else {
    ctx.session = ctx.session || {};
    ctx.session.dealId = deal.ID;
    ctx.session.orderNumber = normalizedOrder;
  }

  // ─── Отправка статуса ─────────────────────────────────────────────────────
  const statusText = buildStatusMessage(deal);
  await ctx.replyWithMarkdown(statusText, {
    reply_markup: buildStatusKeyboard(deal.STAGE_ID),
  });

  logger.info(`[Order] Status check: chat ${chatId}, order ${normalizedOrder}, stage ${deal.STAGE_ID}`);
}

/**
 * Callback «Проверить статус» из push-уведомления.
 */
async function handleCheckStatusCallback(ctx) {
  await ctx.answerCbQuery('Получаю актуальный статус...');
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(`ℹ️ Отправьте номер заказа, чтобы я мог показать статус.`);
    return;
  }

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await ctx.reply('⚠️ Не удалось получить статус. Попробуйте позже.');
    return;
  }

  const statusText = buildStatusMessage(deal);
  await ctx.replyWithMarkdown(statusText, {
    reply_markup: buildStatusKeyboard(deal.STAGE_ID),
  });
}

/**
 * Обработчик команды /status.
 */
async function handleStatusCommand(ctx) {
  const dealId = ctx.session?.dealId;

  if (dealId) {
    await handleOrderLookup(ctx, ctx.session.orderNumber || dealId);
  } else {
    ctx.session = ctx.session || {};
    ctx.session.awaitingOrderNumber = true;
    await ctx.replyWithMarkdown(
      `📦 Отправьте номер заказа для проверки статуса:`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'action_main_menu')]])
    );
  }
}

/**
 * Обработчик запроса фото пробной печати.
 */
async function handleProofPhotoRequest(ctx) {
  await ctx.answerCbQuery?.();
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Сначала введите номер заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  const loadingMsg = await ctx.reply('📷 Загружаю фото...');

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await deleteMessage(ctx, loadingMsg);
    await ctx.reply('⚠️ Не удалось загрузить данные заказа.');
    return;
  }

  await deleteMessage(ctx, loadingMsg);

  const photoUrl = bitrix.extractProofPhotoUrl(deal);
  if (!photoUrl) {
    await ctx.replyWithMarkdown(
      `📷 *Фото ещё недоступно*\n\n` +
        `Пробная печать для вашего заказа ещё не готова или не загружена.\n` +
        `Мы уведомим вас, когда фото появится.`
    );
    return;
  }

  try {
    await ctx.replyWithPhoto(photoUrl, {
      caption:
        `📷 *Фото пробной печати*\n` +
        `Заказ: ${ctx.session.orderNumber || dealId}\n\n` +
        `Если у вас есть замечания — свяжитесь с менеджером.`,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.error(`[Order] Failed to send proof photo: ${err.message}`);
    await ctx.replyWithMarkdown(
      `⚠️ Не удалось загрузить фото из системы.\n[Открыть фото по ссылке](${photoUrl})`
    );
  }
}

/**
 * Callback retry_order_<number>.
 */
async function handleRetryOrderCallback(ctx) {
  await ctx.answerCbQuery();
  const data = ctx.callbackQuery?.data || '';
  const orderNumber = data.replace('retry_order_', '');
  if (orderNumber) await handleOrderLookup(ctx, orderNumber);
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function normalizeOrderNumber(raw) {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

async function deleteMessage(ctx, msg) {
  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
  } catch (_) {}
}

module.exports = {
  orderMiddleware,
  handleOrderLookup,
  handleCheckStatusCallback,
  handleStatusCommand,
  handleProofPhotoRequest,
  handleRetryOrderCallback,
};
```

---

## `src/handlers/nps.js`

```js
/**
 * handlers/nps.js
 * NPS-опрос: оценка 1–10, открытый вопрос при оценке < 7,
 * сохранение в полях сделки Битрикс24.
 */

'use strict';

const { Markup } = require('telegraf');
const bitrix = require('../services/bitrix');
const { buildNpsKeyboard } = require('../services/notify');
const logger = require('../services/logger');

const NPS_LOW_SCORE_THRESHOLD = 7;

/**
 * Обработчик команды /nps.
 */
async function handleNpsCommand(ctx) {
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Для прохождения опроса сначала введите номер вашего заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await ctx.reply('⚠️ Не удалось загрузить данные заказа. Попробуйте позже.');
    return;
  }

  const existingScore = deal[bitrix.NPS_SCORE_FIELD];
  if (existingScore) {
    await ctx.replyWithMarkdown(
      `✅ Вы уже оценили этот заказ на *${existingScore}* из 10.\nСпасибо за ваш отзыв!`
    );
    return;
  }

  await sendNpsSurvey(ctx, dealId);
}

/**
 * Отправить сообщение NPS-опроса.
 * @param {import('telegraf').Context} ctx
 * @param {string|number} dealId
 */
async function sendNpsSurvey(ctx, dealId) {
  await ctx.replyWithMarkdown(
    `⭐ *Оцените наш сервис*\n\n` +
      `Насколько вы готовы порекомендовать типографию *FLEX-N-ROLL PRO* своим коллегам?\n\n` +
      `*1* — точно не порекомендую\n` +
      `*10* — обязательно порекомендую\n\n` +
      `Выберите оценку:`,
    buildNpsKeyboard(dealId)
  );
}

/**
 * Callback nps_score_{dealId}_{score}.
 */
async function handleNpsScoreCallback(ctx) {
  await ctx.answerCbQuery('Спасибо за оценку!');

  const data = ctx.callbackQuery?.data || '';
  const match = data.match(/^nps_score_(\d+)_(\d+)$/);
  if (!match) return;

  const dealId = match[1];
  const score = parseInt(match[2], 10);

  try {
    await bitrix.saveNps(dealId, score);
    logger.info(`[NPS] Score ${score} saved for deal #${dealId} from chat ${ctx.from.id}`);
  } catch (err) {
    logger.error(`[NPS] Failed to save score for deal #${dealId}: ${err.message}`);
    await ctx.replyWithMarkdown(`⚠️ Не удалось сохранить оценку. Попробуйте позже.`);
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.npsScore = score;
  ctx.session.npsDealId = dealId;
  ctx.session.awaitingNpsComment = score < NPS_LOW_SCORE_THRESHOLD;

  if (score < NPS_LOW_SCORE_THRESHOLD) {
    await ctx.replyWithMarkdown(
      `😔 Жаль, что вы поставили *${score}* из 10.\n\n` +
        `Расскажите, пожалуйста, что именно вас не устроило? Ваш отзыв поможет нам стать лучше.\n\n` +
        `_(Напишите комментарий текстом или нажмите «Пропустить»)_`,
      Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Пропустить', `nps_skip_comment_${dealId}`)],
      ])
    );
  } else if (score >= 9) {
    await ctx.replyWithMarkdown(
      `🎉 Спасибо за высокую оценку — *${score}* из 10!\n\n` +
        `Будем рады, если вы порекомендуете нас коллегам!`,
      Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
    );
  } else {
    await ctx.replyWithMarkdown(
      `👍 Спасибо за оценку *${score}* из 10!\n\n` +
        `Если хотите поделиться пожеланиями — напишите нам.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💬 Написать менеджеру', 'faq_contacts')],
        [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
      ])
    );
  }
}

/**
 * Callback nps_skip_comment_{dealId}.
 */
async function handleNpsSkipCommentCallback(ctx) {
  await ctx.answerCbQuery();
  if (ctx.session) ctx.session.awaitingNpsComment = false;
  await ctx.replyWithMarkdown(
    `Хорошо! Ваша оценка сохранена.\nЕсли захотите дополнить — обращайтесь к менеджеру.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Middleware: перехватывает текстовый комментарий после низкой оценки.
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function npsCommentMiddleware(ctx, next) {
  if (!ctx.session?.awaitingNpsComment) return next();

  const comment = ctx.message?.text?.trim();
  if (!comment) return next();

  const dealId = ctx.session.npsDealId;
  const score = ctx.session.npsScore;
  ctx.session.awaitingNpsComment = false;

  if (!dealId) return next();

  try {
    await bitrix.saveNps(dealId, score, comment);
    logger.info(`[NPS] Comment saved for deal #${dealId}`);
  } catch (err) {
    logger.error(`[NPS] Failed to save comment for deal #${dealId}: ${err.message}`);
    await ctx.reply('⚠️ Не удалось сохранить комментарий. Попробуйте позже.');
    return;
  }

  await ctx.replyWithMarkdown(
    `✅ *Спасибо за ваш отзыв!*\n\n` +
      `Мы обязательно учтём ваши пожелания и постараемся улучшить качество работы.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Callback action_nps из главного меню.
 */
async function handleNpsCallback(ctx) {
  await ctx.answerCbQuery();
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Сначала введите номер заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  await sendNpsSurvey(ctx, dealId);
}

module.exports = {
  handleNpsCommand,
  handleNpsCallback,
  handleNpsScoreCallback,
  handleNpsSkipCommentCallback,
  npsCommentMiddleware,
  sendNpsSurvey,
};
```

---

## `src/handlers/faq.js`

```js
/**
 * handlers/faq.js
 * FAQ раздел с inline-кнопками.
 */

'use strict';

const { Markup } = require('telegraf');

const FAQ_ITEMS = {
  min_quantity: {
    title: '📦 Минимальный тираж',
    text:
      `📦 *Минимальный тираж*\n\n` +
      `Минимальный тираж для большинства видов продукции — *1 000 штук*.\n\n` +
      `*Исключения:*\n` +
      `• Пакеты с логотипом: от 500 шт.\n` +
      `• Этикетки: от 1 000 шт.\n` +
      `• Ролл-апы и баннеры: от 1 шт.\n` +
      `• Наклейки фигурные: от 500 шт.\n\n` +
      `При тираже свыше 10 000 шт. действует *скидка от 15%*.`,
  },

  production_time: {
    title: '⏱️ Сроки производства',
    text:
      `⏱️ *Сроки производства*\n\n` +
      `Стандартные сроки — *5–14 рабочих дней* с момента согласования макета и оплаты.\n\n` +
      `*По видам продукции:*\n` +
      `• Визитки, листовки: 3–5 р.дн.\n` +
      `• Этикетки, стикеры: 5–7 р.дн.\n` +
      `• Пакеты, упаковка: 7–14 р.дн.\n` +
      `• Брендированная одежда: 10–14 р.дн.\n\n` +
      `*Срочное производство* (+50% к стоимости): 1–3 р.дн. при наличии мощностей.`,
  },

  materials: {
    title: '🔬 Материалы',
    text:
      `🔬 *Материалы*\n\n` +
      `*Бумага и картон:*\n` +
      `• Мелованная матовая / глянцевая (80–400 г/м²)\n` +
      `• Офсетная (60–160 г/м²)\n` +
      `• Крафт-бумага, дизайнерские виды\n\n` +
      `*Плёнки и самоклейка:*\n` +
      `• BOPP глянец/мат/soft touch\n` +
      `• Полипропиленовые и ПЭТ-плёнки\n` +
      `• Прозрачный и белый vinyl\n\n` +
      `*Ткани:*\n` +
      `• Хлопок 100%, Cotton/PE\n` +
      `• Полиэстер, флаговая ткань\n` +
      `• Брезент, сетка для наружной рекламы\n\n` +
      `По запросу — работа с давальческим сырьём.`,
  },

  delivery: {
    title: '🚚 Доставка',
    text:
      `🚚 *Доставка*\n\n` +
      `*Самовывоз:* бесплатно. Пн–Пт 9:00–18:00.\n\n` +
      `*По городу:* курьером от 500 ₽, день в день или следующий р.день.\n\n` +
      `*По России:* СДЭК, Деловые Линии, ПЭК, Почта России.\n` +
      `Стоимость по тарифам перевозчика.\n\n` +
      `*В СНГ:* по запросу (СДЭК / EMS).\n\n` +
      `Тяжёлые заказы (>30 кг) — транспортные компании, уточните у менеджера.`,
  },

  contacts: {
    title: '📞 Контакты менеджера',
    text:
      `📞 *Контакты*\n\n` +
      `*Менеджер по заказам:*\n` +
      `Telegram: @flex_manager\n` +
      `WhatsApp: +7 (XXX) XXX-XX-XX\n` +
      `E-mail: orders@flex-n-roll.pro\n\n` +
      `*Режим работы:*\n` +
      `Пн–Пт: 9:00–18:00 (МСК)\n` +
      `Сб: 10:00–14:00 (МСК)\n` +
      `Вс: выходной\n\n` +
      `📧 Сотрудничество: partner@flex-n-roll.pro`,
  },
};

function faqMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Минимальный тираж', 'faq_min_quantity')],
    [Markup.button.callback('⏱️ Сроки производства', 'faq_production_time')],
    [Markup.button.callback('🔬 Материалы', 'faq_materials')],
    [Markup.button.callback('🚚 Доставка', 'faq_delivery')],
    [Markup.button.callback('📞 Контакты менеджера', 'faq_contacts')],
    [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
  ]);
}

function faqBackKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Назад в FAQ', 'faq_main')],
    [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
  ]);
}

async function handleFaqCommand(ctx) {
  await ctx.replyWithMarkdown(
    `❓ *Часто задаваемые вопросы*\n\nВыберите интересующий раздел:`,
    faqMainKeyboard()
  );
}

async function handleFaqMainCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `❓ *Часто задаваемые вопросы*\n\nВыберите интересующий раздел:`,
    faqMainKeyboard()
  );
}

/**
 * Фабрика обработчиков FAQ-разделов.
 * @param {string} section — ключ из FAQ_ITEMS
 */
function faqSectionHandler(section) {
  return async (ctx) => {
    await ctx.answerCbQuery();
    const item = FAQ_ITEMS[section];
    if (!item) {
      await ctx.reply('Раздел не найден.');
      return;
    }
    await ctx.replyWithMarkdown(item.text, faqBackKeyboard());
  };
}

module.exports = {
  handleFaqCommand,
  handleFaqMainCallback,
  faqSectionHandler,
  faqMainKeyboard,
  FAQ_ITEMS,
};
```

---

## `src/webhook/bitrixWebhook.js`

```js
/**
 * webhook/bitrixWebhook.js
 * Express-роутер для приёма вебхуков от Битрикс24.
 *
 * Подписка: Портал → Разработчикам → Исходящий вебхук
 * URL: https://your-domain.example.com/webhook/bitrix?secret=<B24_WEBHOOK_SECRET>
 * События: ONCRMDEALADD, ONCRMDEALUPDATE
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const { notifyStageChange } = require('../services/notify');
const logger = require('../services/logger');

const router = express.Router();
const WEBHOOK_SECRET = process.env.B24_WEBHOOK_SECRET || '';

// ─── Верификация запроса ──────────────────────────────────────────────────────

/**
 * Проверить shared secret из query-параметра или заголовка.
 * В URL вебхука добавьте: ?secret=<B24_WEBHOOK_SECRET>
 */
function verifyBitrixRequest(req, res, next) {
  if (!WEBHOOK_SECRET) {
    logger.warn('[Webhook] B24_WEBHOOK_SECRET not set! Webhook is unprotected.');
    return next();
  }

  const provided =
    req.query.secret ||
    req.headers['x-webhook-secret'] ||
    req.body?.secret;

  if (!provided || !safeCompare(provided, WEBHOOK_SECRET)) {
    logger.warn(`[Webhook] Unauthorized request from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function safeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ─── Основной обработчик ──────────────────────────────────────────────────────

/**
 * POST /webhook/bitrix
 *
 * Битрикс24 шлёт application/x-www-form-urlencoded.
 * Поля в теле: event, data[FIELDS][ID], data[FIELDS][STAGE_ID],
 *              data[PREVIOUS_VALUES][STAGE_ID], ts, auth[...]
 */
router.post('/', verifyBitrixRequest, async (req, res) => {
  const body = req.body || {};

  const event = body.event || body.EVENT;
  const dealId =
    body['data[FIELDS][ID]'] ||
    body?.data?.FIELDS?.ID;
  const prevStageId =
    body['data[PREVIOUS_VALUES][STAGE_ID]'] ||
    body?.data?.PREVIOUS_VALUES?.STAGE_ID;
  const currentStageId =
    body['data[FIELDS][STAGE_ID]'] ||
    body?.data?.FIELDS?.STAGE_ID;

  logger.debug(
    `[Webhook] Event: ${event}, deal: ${dealId}, stage: ${prevStageId} → ${currentStageId}`
  );

  // Немедленно отвечаем 200 — Б24 ждёт быстрый ответ
  res.status(200).json({ ok: true });

  if (!dealId) return;

  const isUpdate = /onCrmDealUpdate/i.test(event);
  const isNew = /onCrmDealAdd/i.test(event);

  if (isUpdate && prevStageId && currentStageId && prevStageId !== currentStageId) {
    setImmediate(() => {
      notifyStageChange(dealId, prevStageId, currentStageId).catch((err) =>
        logger.error(`[Webhook] notifyStageChange failed for deal #${dealId}: ${err.message}`)
      );
    });
  } else if (isNew) {
    setImmediate(() => {
      notifyStageChange(dealId, null, currentStageId || 'NEW').catch((err) =>
        logger.error(`[Webhook] notifyStageChange (new) failed for #${dealId}: ${err.message}`)
      );
    });
  }
});

// GET — проверка доступности эндпоинта
router.get('/', (_req, res) => {
  res.json({ status: 'Bitrix24 webhook endpoint active' });
});

module.exports = router;
```

---

## `src/bot.js`

```js
/**
 * bot.js
 * Главная точка входа: инициализация бота, middleware stack,
 * регистрация обработчиков, запуск Express-сервера.
 */

'use strict';

require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const express = require('express');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const logger = require('./services/logger');
const notifyService = require('./services/notify');
const bitrixWebhookRouter = require('./webhook/bitrixWebhook');

const { handleStart, handleHelp, handleMainMenuCallback, handleCheckOrderCallback, mainMenuKeyboard } = require('./handlers/start');
const { orderMiddleware, handleCheckStatusCallback, handleStatusCommand, handleProofPhotoRequest, handleRetryOrderCallback } = require('./handlers/order');
const { handleFaqCommand, handleFaqMainCallback, faqSectionHandler } = require('./handlers/faq');
const { handleNpsCommand, handleNpsCallback, handleNpsScoreCallback, handleNpsSkipCommentCallback, npsCommentMiddleware } = require('./handlers/nps');

// ─── Валидация конфигурации ───────────────────────────────────────────────────

function validateConfig() {
  const required = ['BOT_TOKEN', 'B24_BASE_URL', 'B24_WEBHOOK_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
validateConfig();

// ─── Telegraf Bot ─────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: { webhookReply: false },
});

notifyService.init(bot);

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_POINTS || '10', 10),
  duration: parseInt(process.env.RATE_WINDOW_SEC || '60', 10),
});

async function rateLimitMiddleware(ctx, next) {
  const key = ctx.from?.id;
  if (!key) return next();
  try {
    await rateLimiter.consume(key);
    return next();
  } catch {
    logger.warn(`[RateLimit] Chat ${key} exceeded rate limit`);
    await ctx.reply('⏳ Слишком много запросов. Подождите немного и попробуйте снова.');
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

// Сессия (in-memory; в production замените на telegraf-session-redis)
bot.use(
  session({
    defaultSession: () => ({
      dealId: null,
      orderNumber: null,
      awaitingOrderNumber: false,
      awaitingNpsComment: false,
      npsScore: null,
      npsDealId: null,
    }),
  })
);

// Rate limiting
bot.use(rateLimitMiddleware);

// Глобальная обработка ошибок
bot.catch((err, ctx) => {
  logger.error(`[Bot] Unhandled error for ${ctx.updateType}: ${err.message}`, { stack: err.stack });
  ctx.reply('⚠️ Внутренняя ошибка. Попробуйте позже или обратитесь к менеджеру.').catch(() => {});
});

// ─── Команды ─────────────────────────────────────────────────────────────────

bot.start(handleStart);
bot.help(handleHelp);
bot.command('status', handleStatusCommand);
bot.command('proof', handleProofPhotoRequest);
bot.command('nps', handleNpsCommand);
bot.command('faq', handleFaqCommand);

// ─── Callbacks ────────────────────────────────────────────────────────────────

bot.action('action_main_menu', handleMainMenuCallback);
bot.action('action_check_order', handleCheckOrderCallback);

bot.action('check_status', handleCheckStatusCallback);
bot.action('get_proof_photo', handleProofPhotoRequest);
bot.action(/^retry_order_(.+)$/, handleRetryOrderCallback);

bot.action('faq_main', handleFaqMainCallback);
bot.action('faq_min_quantity', faqSectionHandler('min_quantity'));
bot.action('faq_production_time', faqSectionHandler('production_time'));
bot.action('faq_materials', faqSectionHandler('materials'));
bot.action('faq_delivery', faqSectionHandler('delivery'));
bot.action('faq_contacts', faqSectionHandler('contacts'));

bot.action('action_nps', handleNpsCallback);
bot.action(/^nps_score_\d+_\d+$/, handleNpsScoreCallback);
bot.action(/^nps_skip_comment_\d+$/, handleNpsSkipCommentCallback);

// ─── Text middleware (порядок важен!) ─────────────────────────────────────────

bot.on('text', npsCommentMiddleware);    // 1. NPS комментарий
bot.on('text', orderMiddleware);         // 2. Номер заказа

// Fallback
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;
  await ctx.replyWithMarkdown(
    `🤔 Не понял ваше сообщение.\n\nОтправьте *номер заказа* или выберите действие:`,
    mainMenuKeyboard()
  );
});

// ─── Express сервер ───────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

const TELEGRAM_WEBHOOK_PATH = `/tg-webhook/${process.env.BOT_TOKEN}`;
app.use(TELEGRAM_WEBHOOK_PATH, bot.webhookCallback(TELEGRAM_WEBHOOK_PATH));

app.use('/webhook/bitrix', bitrixWebhookRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Запуск ───────────────────────────────────────────────────────────────────

async function start() {
  const server = app.listen(PORT, () => {
    logger.info(`[Server] Listening on port ${PORT}`);
  });

  const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

  if (BOT_WEBHOOK_URL) {
    // Production: webhook
    const webhookUrl = `${BOT_WEBHOOK_URL}${TELEGRAM_WEBHOOK_PATH}`;
    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      allowed_updates: ['message', 'callback_query'],
    });
    logger.info(`[Bot] Webhook set: ${webhookUrl}`);
  } else {
    // Development: long polling
    await bot.telegram.deleteWebhook();
    bot.launch();
    logger.info('[Bot] Long polling started (development mode)');
  }

  await bot.telegram.setMyCommands([
    { command: 'start',  description: 'Главное меню' },
    { command: 'status', description: 'Статус заказа' },
    { command: 'proof',  description: 'Фото пробной печати' },
    { command: 'nps',    description: 'Оценить наш сервис' },
    { command: 'faq',    description: 'Часто задаваемые вопросы' },
    { command: 'help',   description: 'Справка по командам' },
  ]);

  logger.info('[Bot] FLEX-N-ROLL PRO bot started successfully.');

  const shutdown = async (signal) => {
    logger.info(`[Bot] Received ${signal}. Shutting down...`);
    bot.stop(signal);
    server.close(() => {
      logger.info('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error(`[Bot] Fatal startup error: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
```

---

## `README.md`

```markdown
# FLEX-N-ROLL PRO — Telegram Status Bot

Telegram-бот для информирования клиентов типографии **FLEX-N-ROLL PRO** о статусе заказа.

## Функционал

| Функция | Описание |
|---|---|
| 📦 Статус заказа | Клиент вводит номер → бот показывает текущий статус из Битрикс24 |
| 🔔 Push-уведомления | Авто-уведомление при смене стадии сделки через вебхук Б24 |
| 📷 Фото пробной печати | Бот присылает фото из поля сделки |
| ⭐ NPS-опрос | Оценка 1–10, открытый вопрос при оценке < 7, сохранение в Б24 |
| ❓ FAQ | Тираж, сроки, материалы, доставка, контакты с inline-кнопками |
| 🔗 Привязка chat_id | Telegram chat_id → поле сделки в Битрикс24 |
| 🛡️ Защита | Rate limiting, проверка принадлежности заказа |

---

## Быстрый старт

### 1. Установить зависимости

```bash
git clone <repo>
cd flex-n-roll-bot
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Заполните .env (см. таблицу ниже)
```

### 3. Найти ID стадий вашей воронки

```bash
curl "https://your-portal.bitrix24.ru/rest/<WEBHOOK_TOKEN>/crm.dealcategory.stages?id=<PIPELINE_ID>"
```

Скопируйте `STATUS_ID` каждой стадии в `B24_STAGE_*` переменные.

### 4. Запустить локально (long polling)

```bash
# Не устанавливайте BOT_WEBHOOK_URL — запустится в режиме polling
npm start
# с hot-reload:
npm run dev
```

### 5. Production (webhook + Docker)

```bash
docker-compose up -d
```

---

## Поля сделки в Битрикс24

Добавьте в **CRM → Настройки → Пользовательские поля сделки**:

| Поле | Тип | Описание |
|---|---|---|
| `UF_CRM_ORDER_NUMBER` | Строка | Номер заказа |
| `UF_CRM_TELEGRAM_CHAT_ID` | Строка | Telegram chat_id (заполняет бот) |
| `UF_CRM_PROOF_PHOTO` | Файл | Фото пробной печати |
| `UF_CRM_NPS_SCORE` | Число | NPS оценка (1–10) |
| `UF_CRM_NPS_COMMENT` | Строка | Комментарий к NPS |

---

## Настройка вебхука Битрикс24

1. **Портал → Разработчикам → Исходящий вебхук**
2. Событие: `ONCRMDEALADD` и `ONCRMDEALUPDATE`
3. URL: `https://your-domain.example.com/webhook/bitrix?secret=<B24_WEBHOOK_SECRET>`

---

## Production checklist

- [ ] Заменить in-memory сессии на Redis (`telegraf-session-redis`)
- [ ] Заменить `setTimeout` для NPS на очередь задач (Bull/BullMQ)
- [ ] SSL-сертификат (Let's Encrypt)
- [ ] Reverse proxy (Nginx / Traefik)
- [ ] Мониторинг (Prometheus / Sentry)
- [ ] Firewall: разрешить вебхук Б24 только с IP серверов Битрикс24
```

---

## Маппинг стадий — сводная таблица

| Переменная `.env` | Клиентский статус | Описание |
|---|---|---|
| `NEW` (системная) | 📋 Новый заказ получен | Сделка только создана |
| `B24_STAGE_CONTRACT` | 📦 В очереди на производство | Договор и оплата |
| `B24_STAGE_TECH` / `PREPARATION` | ⚙️ Техническая подготовка | Технологи прорабатывают макет |
| `QUALIFICATION` | 🔍 Квалификация | Менеджер уточняет детали |
| `B24_STAGE_PRINT1` | 🖨️ В печати | Производство, этап 1 |
| `B24_STAGE_PRINT2` | ✂️ Финишная обработка | Производство, этап 2 |
| `B24_STAGE_QC` | 🔬 Контроль качества ОТК | Производство, этап 3 |
| `B24_STAGE_READY` | 📫 Готов к отгрузке | Отгрузка, не отправлен |
| `B24_STAGE_SHIPPED` | 🚚 Отгружен | Отгрузка, отправлен |
| `B24_STAGE_REPEAT` / `WON` | 🏁 Завершён | Повторные продажи |
| `LOST` | ❌ Заказ отменён | — |

---

## Архитектура потока данных

```
Клиент (Telegram)
    │
    ▼
[Telegraf Bot]
    │  /start, /status, номер заказа
    │
    ▼
[handlers/order.js]
    │  crm.deal.list (по номеру заказа)
    │  crm.deal.update (chat_id)
    ▼
[services/bitrix.js] ←──── Битрикс24 REST API
    │
    ▼
Ответ клиенту (статус + inline-кнопки)

─────────────────────────────────────────

Битрикс24 (смена стадии)
    │
    ▼ POST /webhook/bitrix
[webhook/bitrixWebhook.js]
    │
    ▼
[services/notify.js]
    │  crm.deal.get (chat_id из поля)
    │  telegram.sendMessage
    ▼
Клиент получает push-уведомление
    │
    └─ (если WON/SHIPPED) ──► NPS-опрос через 2 часа
```

---

## МОДУЛЬ 4.2 — AI-АНАЛИТИКА ПРОДАЖ (Python + scikit-learn)

> **Промт для Claude Code CLI:**  
> "Создай Python проект `flex-n-roll-analytics` по следующей структуре. Создай все файлы с полным кодом."

# 4.2 Python AI-аналитика — FLEX-N-ROLL PRO
## Production-ready код всех модулей

**Стек:** Python 3.11+, pandas, scikit-learn, mlxtend, requests, schedule, tenacity, redis, joblib

**Структура проекта:**
```
flex-n-roll-analytics/
├── main.py                    # Entry point (scheduler)
├── config.py                  # Конфигурация
├── modules/
│   ├── bitrix_client.py       # Битрикс24 REST API клиент
│   ├── deal_predictor.py      # Прогноз вероятности закрытия
│   ├── cross_sell.py          # Рекомендации cross-sell
│   ├── churn_detector.py      # Churn prediction
│   ├── contact_optimizer.py   # Оптимальное время контакта
│   └── report_sender.py       # Отправка результатов в Б24
├── models/                    # Сохранённые ML-модели (.pkl)
├── reports/                   # Локальные копии отчётов
├── logs/                      # Лог-файлы
├── requirements.txt
├── .env.example
├── docker-compose.yml
└── Dockerfile
```

---

## config.py

```python
"""
config.py — Централизованная конфигурация проекта FLEX-N-ROLL Analytics.
Параметры читаются из переменных окружения (файл .env).
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем .env из корня проекта
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")


# ---------------------------------------------------------------------------
# Битрикс24
# ---------------------------------------------------------------------------
BITRIX_WEBHOOK_URL: str = os.environ["BITRIX_WEBHOOK_URL"]
# Пример: https://yourcompany.bitrix24.ru/rest/1/abc123xyz/

# Таймаут HTTP-запросов к Б24, секунды
BITRIX_REQUEST_TIMEOUT: int = int(os.getenv("BITRIX_REQUEST_TIMEOUT", "30"))

# Размер страницы при пагинации (максимум 50 по API Б24)
BITRIX_PAGE_SIZE: int = 50

# Максимальное количество повторных попыток при ошибке сети
BITRIX_MAX_RETRIES: int = int(os.getenv("BITRIX_MAX_RETRIES", "3"))

# Задержка между повторными попытками, секунды
BITRIX_RETRY_DELAY: float = float(os.getenv("BITRIX_RETRY_DELAY", "2.0"))

# ---------------------------------------------------------------------------
# Кастомные поля сделок в Б24 (UF_CRM_*)
# ---------------------------------------------------------------------------
FIELD_WIN_PROBABILITY: str = os.getenv("FIELD_WIN_PROBABILITY", "UF_CRM_WIN_PROBABILITY")
FIELD_CHURN_RISK: str      = os.getenv("FIELD_CHURN_RISK",      "UF_CRM_CHURN_RISK")
FIELD_CROSS_SELL: str      = os.getenv("FIELD_CROSS_SELL",      "UF_CRM_CROSS_SELL")
FIELD_CONTACT_TIME: str    = os.getenv("FIELD_CONTACT_TIME",    "UF_CRM_BEST_CONTACT_TIME")

# ---------------------------------------------------------------------------
# Типы продуктов типографии (для one-hot и cross-sell)
# ---------------------------------------------------------------------------
PRODUCT_TYPES: list[str] = [
    "самоклейка",
    "термохром",
    "AR_этикетка",
    "DataMatrix",
    "sleeve",
    "гибридная_флексо_цифра",
    "флексопечать",
    "цифровая_печать",
    "офсет",
    "тиснение",
]

# Маппинг стадий сделки на порядковый номер (ordinal encoding)
STAGE_ORDER: dict[str, int] = {
    "NEW":           1,
    "PREPARATION":   2,
    "PREPAYMENT_INVOICE": 3,
    "EXECUTING":     4,
    "FINAL_INVOICE": 5,
    "WON":           6,   # успешно закрыта
    "LOSE":          0,   # проиграна
    "APOLOGY":       0,
}

# ---------------------------------------------------------------------------
# Сегменты клиентов
# ---------------------------------------------------------------------------
CUSTOMER_SEGMENTS: list[str] = ["A", "B", "C", "D"]  # A — самые ценные

# ---------------------------------------------------------------------------
# Churn-пороги
# ---------------------------------------------------------------------------
# Снижение частоты заказов за 6 мес., при котором присваивается HIGH risk
CHURN_HIGH_FREQ_DROP: float  = float(os.getenv("CHURN_HIGH_FREQ_DROP", "0.30"))
# Снижение частоты для MEDIUM risk
CHURN_MED_FREQ_DROP: float   = float(os.getenv("CHURN_MED_FREQ_DROP", "0.15"))
# Снижение среднего чека, при котором добавляется риск
CHURN_CHECK_DROP: float      = float(os.getenv("CHURN_CHECK_DROP", "0.20"))
# Дней без заказа для HIGH
CHURN_HIGH_DAYS_SILENT: int  = int(os.getenv("CHURN_HIGH_DAYS_SILENT", "180"))
# Дней без заказа для MEDIUM
CHURN_MED_DAYS_SILENT: int   = int(os.getenv("CHURN_MED_DAYS_SILENT", "90"))

# ---------------------------------------------------------------------------
# Планировщик
# ---------------------------------------------------------------------------
SCHEDULER_DAILY_PREDICT_TIME:  str = os.getenv("SCHEDULER_DAILY_PREDICT_TIME",  "07:00")
SCHEDULER_DAILY_CHURN_TIME:    str = os.getenv("SCHEDULER_DAILY_CHURN_TIME",    "08:00")
SCHEDULER_WEEKLY_CROSSSELL_DAY:str = os.getenv("SCHEDULER_WEEKLY_CROSSSELL_DAY","monday")
SCHEDULER_MONTHLY_RETRAIN_DAY: int = int(os.getenv("SCHEDULER_MONTHLY_RETRAIN_DAY", "1"))

# ---------------------------------------------------------------------------
# Пути к файлам моделей
# ---------------------------------------------------------------------------
MODELS_DIR: Path = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_DEAL_PREDICTOR: Path   = MODELS_DIR / "deal_predictor.pkl"
MODEL_CROSS_SELL: Path       = MODELS_DIR / "cross_sell_matrix.pkl"
MODEL_CHURN: Path            = MODELS_DIR / "churn_detector.pkl"
MODEL_CONTACT_OPT: Path      = MODELS_DIR / "contact_optimizer.pkl"

# ---------------------------------------------------------------------------
# Кэш
# ---------------------------------------------------------------------------
# Использовать Redis если доступен, иначе файловый fallback
USE_REDIS: bool      = os.getenv("USE_REDIS", "false").lower() == "true"
REDIS_URL: str       = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 час

CACHE_DIR: Path = BASE_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Логирование
# ---------------------------------------------------------------------------
LOG_LEVEL: str  = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE: Path  = BASE_DIR / "logs" / "analytics.log"
LOG_FILE.parent.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Отчёты / уведомления
# ---------------------------------------------------------------------------
# ID ответственного пользователя в Б24 (для постановки задач)
DEFAULT_RESPONSIBLE_ID: int = int(os.getenv("DEFAULT_RESPONSIBLE_ID", "1"))

# Группа Б24 для публикации сводного отчёта (0 = не публиковать)
REPORT_GROUP_ID: int = int(os.getenv("REPORT_GROUP_ID", "0"))
```

---

## requirements.txt

```text
# Core
python-dotenv==1.0.1
requests==2.31.0
urllib3==2.2.1

# Data
pandas==2.2.2
numpy==1.26.4

# ML
scikit-learn==1.4.2
joblib==1.4.2
mlxtend==0.23.1        # association rules для cross-sell

# Scheduler
schedule==1.2.1

# Cache (опционально)
redis==5.0.4

# Logging / utils
colorlog==6.8.2
tenacity==8.3.0        # retry decorator
```

---

## .env.example

```dotenv
# ---------------------------------------------------------------------------
# Битрикс24 — обязательно
# ---------------------------------------------------------------------------
BITRIX_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/your_token_here/

# ---------------------------------------------------------------------------
# Тайминги HTTP
# ---------------------------------------------------------------------------
BITRIX_REQUEST_TIMEOUT=30
BITRIX_MAX_RETRIES=3
BITRIX_RETRY_DELAY=2.0

# ---------------------------------------------------------------------------
# Пользовательские поля сделок
# ---------------------------------------------------------------------------
FIELD_WIN_PROBABILITY=UF_CRM_WIN_PROBABILITY
FIELD_CHURN_RISK=UF_CRM_CHURN_RISK
FIELD_CROSS_SELL=UF_CRM_CROSS_SELL
FIELD_CONTACT_TIME=UF_CRM_BEST_CONTACT_TIME

# ---------------------------------------------------------------------------
# Churn-пороги
# ---------------------------------------------------------------------------
CHURN_HIGH_FREQ_DROP=0.30
CHURN_MED_FREQ_DROP=0.15
CHURN_CHECK_DROP=0.20
CHURN_HIGH_DAYS_SILENT=180
CHURN_MED_DAYS_SILENT=90

# ---------------------------------------------------------------------------
# Планировщик
# ---------------------------------------------------------------------------
SCHEDULER_DAILY_PREDICT_TIME=07:00
SCHEDULER_DAILY_CHURN_TIME=08:00
SCHEDULER_WEEKLY_CROSSSELL_DAY=monday
SCHEDULER_MONTHLY_RETRAIN_DAY=1

# ---------------------------------------------------------------------------
# Redis (опционально)
# ---------------------------------------------------------------------------
USE_REDIS=false
REDIS_URL=redis://redis:6379/0
CACHE_TTL_SECONDS=3600

# ---------------------------------------------------------------------------
# Битрикс24 — пользователи
# ---------------------------------------------------------------------------
DEFAULT_RESPONSIBLE_ID=1
REPORT_GROUP_ID=0

# ---------------------------------------------------------------------------
# Логирование
# ---------------------------------------------------------------------------
LOG_LEVEL=INFO
```

---

## docker-compose.yml

```yaml
version: "3.9"

services:
  analytics:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: flex-n-roll-analytics
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./models:/app/models       # сохранение ML-моделей
      - ./logs:/app/logs           # лог-файлы
      - ./.cache:/app/.cache       # файловый кэш
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - analytics-net

  redis:
    image: redis:7-alpine
    container_name: flex-n-roll-redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - analytics-net
    volumes:
      - redis-data:/data

networks:
  analytics-net:
    driver: bridge

volumes:
  redis-data:
```

---

## Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Системные зависимости (scipy требует build-tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Создаём директории для артефактов
RUN mkdir -p models logs .cache

CMD ["python", "main.py"]
```

---

## modules/bitrix_client.py

```python
"""
bitrix_client.py — Клиент для Битрикс24 REST API.

Возможности:
- Получение активных сделок с пагинацией (start=0, шаг 50)
- Получение истории активностей (звонки, письма)
- Обновление полей сделок (crm.deal.update)
- Создание задач менеджерам (tasks.task.add)
- Кэширование: Redis если доступен, иначе файловый JSON-кэш
- Автоматические retry через tenacity
"""

import json
import logging
import hashlib
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

try:
    import redis as redis_lib
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Вспомогательный кэш
# ---------------------------------------------------------------------------

class FileCache:
    """Простой файловый JSON-кэш с TTL."""

    def __init__(self, cache_dir: Path, ttl: int = 3600):
        self.cache_dir = cache_dir
        self.ttl = ttl
        cache_dir.mkdir(exist_ok=True)

    def _key_path(self, key: str) -> Path:
        hashed = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed}.json"

    def get(self, key: str) -> Any | None:
        path = self._key_path(key)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if time.time() - data["ts"] > self.ttl:
                path.unlink(missing_ok=True)
                return None
            return data["value"]
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        path = self._key_path(key)
        try:
            path.write_text(
                json.dumps({"ts": time.time(), "value": value}, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("FileCache.set error: %s", exc)


class RedisCache:
    """Обёртка над redis с автоматическим сериализацией JSON."""

    def __init__(self, url: str, ttl: int = 3600):
        self.ttl = ttl
        self._client = redis_lib.from_url(url, decode_responses=True)

    def get(self, key: str) -> Any | None:
        try:
            raw = self._client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.warning("RedisCache.get error: %s", exc)
            return None

    def set(self, key: str, value: Any) -> None:
        try:
            self._client.setex(key, self.ttl, json.dumps(value, ensure_ascii=False))
        except Exception as exc:
            logger.warning("RedisCache.set error: %s", exc)


def _build_cache():
    """Создаёт Redis-кэш если доступен, иначе файловый."""
    if config.USE_REDIS and REDIS_AVAILABLE:
        try:
            cache = RedisCache(config.REDIS_URL, ttl=config.CACHE_TTL_SECONDS)
            cache._client.ping()
            logger.info("Используется Redis-кэш: %s", config.REDIS_URL)
            return cache
        except Exception as exc:
            logger.warning("Redis недоступен (%s), переключаемся на файловый кэш", exc)
    logger.info("Используется файловый кэш: %s", config.CACHE_DIR)
    return FileCache(config.CACHE_DIR, ttl=config.CACHE_TTL_SECONDS)


# ---------------------------------------------------------------------------
# Основной клиент
# ---------------------------------------------------------------------------

class BitrixClient:
    """
    Клиент Битрикс24 REST API.

    Пример использования:
        client = BitrixClient()
        deals = client.get_active_deals()
        client.update_deal(42, {"UF_CRM_WIN_PROBABILITY": 85})
    """

    def __init__(self):
        self.webhook = config.BITRIX_WEBHOOK_URL.rstrip("/")
        self.timeout = config.BITRIX_REQUEST_TIMEOUT
        self.page_size = config.BITRIX_PAGE_SIZE
        self.cache = _build_cache()
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    # ------------------------------------------------------------------
    # Внутренние методы
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(config.BITRIX_MAX_RETRIES),
        wait=wait_exponential(
            multiplier=config.BITRIX_RETRY_DELAY, min=1, max=30
        ),
        retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
        reraise=True,
    )
    def _call(self, method: str, params: dict | None = None) -> dict:
        """
        Выполняет один вызов REST API Битрикс24.

        :param method: Метод API, например 'crm.deal.list'
        :param params: Параметры запроса
        :return: Распакованный JSON-ответ
        """
        url = f"{self.webhook}/{method}.json"
        params = params or {}
        try:
            response = self._session.post(url, json=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if "error" in data:
                raise ValueError(
                    f"Б24 API error [{data['error']}]: {data.get('error_description', '')}"
                )
            return data
        except requests.HTTPError as exc:
            logger.error("HTTP ошибка %s для %s: %s", exc.response.status_code, method, exc)
            raise
        except ValueError:
            raise
        except Exception as exc:
            logger.error("Неожиданная ошибка при вызове %s: %s", method, exc)
            raise

    def _paginate(self, method: str, params: dict, result_key: str = "result") -> list[dict]:
        """
        Постранично получает все записи с поддержкой пагинации Б24.
        Б24 возвращает максимум 50 записей за запрос (start=0..N).

        :param method:     Метод API
        :param params:     Базовые параметры
        :param result_key: Ключ в ответе с массивом данных
        :return: Список всех записей
        """
        all_items: list[dict] = []
        start = 0

        while True:
            page_params = {**params, "start": start}
            data = self._call(method, page_params)
            items = data.get(result_key, [])
            all_items.extend(items)

            total = int(data.get("total", 0))
            logger.debug(
                "%s: получено %d / %d записей (start=%d)",
                method, len(all_items), total, start,
            )

            # Б24 возвращает next в data["next"] или считаем вручную
            if "next" in data:
                start = data["next"]
            elif len(all_items) < total:
                start += self.page_size
            else:
                break

        return all_items

    # ------------------------------------------------------------------
    # Публичные методы — чтение
    # ------------------------------------------------------------------

    def get_active_deals(self, extra_filter: dict | None = None) -> list[dict]:
        """
        Возвращает все активные (незакрытые) сделки.

        :param extra_filter: Дополнительные условия фильтрации
        """
        cache_key = "active_deals"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Сделки получены из кэша (%d шт.)", len(cached))
            return cached

        base_filter = {
            "CLOSED": "N",          # только открытые
            "!=STAGE_ID": "LOSE",   # исключаем проигранные
        }
        if extra_filter:
            base_filter.update(extra_filter)

        params = {
            "filter": base_filter,
            "select": [
                "ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "CURRENCY_ID",
                "CONTACT_ID", "COMPANY_ID", "ASSIGNED_BY_ID",
                "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
                "TYPE_ID", "SOURCE_ID",
                config.FIELD_WIN_PROBABILITY,
                config.FIELD_CHURN_RISK,
                config.FIELD_CROSS_SELL,
                config.FIELD_CONTACT_TIME,
                "UF_CRM_PRODUCT_TYPE",   # тип продукта типографии
                "UF_CRM_SEGMENT",        # сегмент клиента
            ],
        }
        deals = self._paginate("crm.deal.list", params)
        self.cache.set(cache_key, deals)
        logger.info("Получено активных сделок: %d", len(deals))
        return deals

    def get_closed_deals(self, days_back: int = 365) -> list[dict]:
        """
        Возвращает закрытые сделки за последние N дней.
        Используется для обучения моделей.

        :param days_back: Количество дней в прошлое
        """
        cache_key = f"closed_deals_{days_back}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Закрытые сделки получены из кэша (%d шт.)", len(cached))
            return cached

        since = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00")

        params = {
            "filter": {
                "CLOSED": "Y",
                ">=DATE_MODIFY": since,
            },
            "select": [
                "ID", "TITLE", "STAGE_ID", "OPPORTUNITY",
                "CONTACT_ID", "COMPANY_ID",
                "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
                "UF_CRM_PRODUCT_TYPE", "UF_CRM_SEGMENT",
            ],
        }
        deals = self._paginate("crm.deal.list", params)
        self.cache.set(cache_key, deals)
        logger.info("Получено закрытых сделок: %d (за %d дней)", len(deals), days_back)
        return deals

    def get_activities(
        self,
        entity_type: str = "CRM_DEAL",
        deal_ids: list[int] | None = None,
        days_back: int = 180,
    ) -> list[dict]:
        """
        Возвращает историю активностей (звонки, письма).

        :param entity_type: Тип сущности ('CRM_DEAL', 'CRM_CONTACT')
        :param deal_ids:    Список ID сделок для фильтрации
        :param days_back:   Глубина истории в днях
        """
        cache_key = f"activities_{entity_type}_{days_back}_{hash(tuple(deal_ids or []))}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.debug("Активности получены из кэша (%d шт.)", len(cached))
            return cached

        since = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00")

        flt: dict = {
            ">=CREATED": since,
            "BINDINGS": [{"ENTITY_TYPE": entity_type}],
        }
        if deal_ids:
            flt["OWNER_ID"] = deal_ids

        params = {
            "filter": flt,
            "select": [
                "ID", "TYPE_ID", "SUBJECT", "CREATED", "DEADLINE",
                "OWNER_ID", "OWNER_TYPE_ID", "RESPONSIBLE_ID",
                "DIRECTION",   # 1=входящий, 2=исходящий
                "COMPLETED",
            ],
        }
        activities = self._paginate("crm.activity.list", params)
        self.cache.set(cache_key, activities)
        logger.info("Получено активностей: %d", len(activities))
        return activities

    def get_company_deals(self, company_id: int) -> list[dict]:
        """Возвращает все сделки по компании (для расчёта LTV и истории)."""
        params = {
            "filter": {"COMPANY_ID": company_id},
            "select": ["ID", "OPPORTUNITY", "STAGE_ID", "DATE_MODIFY", "CLOSED"],
        }
        return self._paginate("crm.deal.list", params)

    def get_contacts(self) -> list[dict]:
        """Возвращает список всех контактов для churn-анализа."""
        cache_key = "contacts_all"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "select": ["ID", "NAME", "LAST_NAME", "COMPANY_ID", "ASSIGNED_BY_ID"],
        }
        contacts = self._paginate("crm.contact.list", params)
        self.cache.set(cache_key, contacts)
        logger.info("Получено контактов: %d", len(contacts))
        return contacts

    # ------------------------------------------------------------------
    # Публичные методы — запись
    # ------------------------------------------------------------------

    def update_deal(self, deal_id: int, fields: dict) -> bool:
        """
        Обновляет поля сделки.

        :param deal_id: ID сделки
        :param fields:  Словарь обновляемых полей
        :return: True если успешно
        """
        try:
            self._call("crm.deal.update", {"id": deal_id, "fields": fields})
            logger.debug("Сделка #%d обновлена: %s", deal_id, list(fields.keys()))
            return True
        except Exception as exc:
            logger.error("Ошибка обновления сделки #%d: %s", deal_id, exc)
            return False

    def create_task(
        self,
        title: str,
        description: str,
        responsible_id: int,
        deadline: datetime | None = None,
        deal_id: int | None = None,
    ) -> int | None:
        """
        Создаёт задачу менеджеру.

        :param title:          Название задачи
        :param description:    Описание
        :param responsible_id: ID ответственного в Б24
        :param deadline:       Срок исполнения
        :param deal_id:        Привязка к сделке (UF_CRM)
        :return: ID созданной задачи или None
        """
        fields: dict = {
            "TITLE": title,
            "DESCRIPTION": description,
            "RESPONSIBLE_ID": responsible_id,
            "ALLOW_TIME_TRACKING": "N",
        }
        if deadline:
            fields["DEADLINE"] = deadline.strftime("%Y-%m-%dT%H:%M:%S+03:00")
        if deal_id:
            fields["UF_CRM_TASK"] = [f"CRM_DEAL_{deal_id}"]

        try:
            data = self._call("tasks.task.add", {"fields": fields})
            task_id = data.get("result", {}).get("task", {}).get("id")
            logger.info("Задача создана: #%s — %s", task_id, title)
            return int(task_id) if task_id else None
        except Exception as exc:
            logger.error("Ошибка создания задачи '%s': %s", title, exc)
            return None

    def post_to_feed(self, message: str, group_id: int = 0) -> bool:
        """
        Публикует сообщение в живую ленту (для сводных отчётов).

        :param message:  Текст сообщения
        :param group_id: ID группы (0 = лента новостей)
        :return: True если успешно
        """
        params: dict = {"POST_TITLE": "Analytics Report", "MESSAGE": message}
        if group_id:
            params["DEST"] = [f"SG{group_id}"]

        try:
            self._call("log.blogpost.add", params)
            logger.info("Сообщение опубликовано в живую ленту")
            return True
        except Exception as exc:
            logger.error("Ошибка публикации в ленту: %s", exc)
            return False

    def invalidate_cache(self) -> None:
        """Принудительно сбрасывает кэш (вызывается перед переобучением)."""
        if isinstance(self.cache, RedisCache):
            try:
                self.cache._client.flushdb()
                logger.info("Redis кэш очищен")
            except Exception as exc:
                logger.warning("Ошибка очистки Redis: %s", exc)
        elif isinstance(self.cache, FileCache):
            for f in config.CACHE_DIR.glob("*.json"):
                f.unlink(missing_ok=True)
            logger.info("Файловый кэш очищен")
```

---

## modules/deal_predictor.py

```python
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
```

---

## modules/cross_sell.py

```python
"""
cross_sell.py — Cross-sell рекомендации для типографии FLEX-N-ROLL PRO.

Алгоритм:
  1. Строим матрицу заказов клиент × продукт (binary)
  2. Применяем mlxtend Apriori (min_support=0.1)
  3. Генерируем association rules (min_confidence=0.5)
  4. Дополнительные бизнес-правила типографии:
       самоклейка → AR или термохром
       нет маркировки → DataMatrix
       sleeve → гибридная_флексо_цифра
  5. Для каждой активной сделки находим релевантные рекомендации
  6. Создаём задачу менеджеру в Б24 со списком рекомендаций
"""

import logging
from datetime import datetime, timedelta
from typing import NamedTuple

import numpy as np
import pandas as pd
import joblib
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Бизнес-правила типографии
# ---------------------------------------------------------------------------

BUSINESS_RULES: list[dict] = [
    {
        "if_product": "самоклейка",
        "recommend": ["AR_этикетка", "термохром"],
        "reason": "Клиенты, заказывающие самоклейку, часто добавляют AR или термохром для premium-эффекта",
    },
    {
        "if_no_product": "DataMatrix",
        "recommend": ["DataMatrix"],
        "reason": "Клиент не использует DataMatrix-маркировку — обязательная для большинства групп товаров с 2024 г.",
    },
    {
        "if_product": "sleeve",
        "recommend": ["гибридная_флексо_цифра"],
        "reason": "Sleeve-заказчики выигрывают от гибридной технологии: флексо-фон + цифровые переменные данные",
    },
]

MARKING_PRODUCTS = {"DataMatrix"}

# ---------------------------------------------------------------------------
# Структуры данных
# ---------------------------------------------------------------------------

class CrossSellRecommendation(NamedTuple):
    company_id: int
    deal_id: int
    manager_id: int
    current_products: list[str]
    recommended_products: list[str]
    confidence: float
    reason: str
    task_created: bool


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------

def _extract_products(deal: dict) -> list[str]:
    """Извлекает список продуктов из поля сделки."""
    raw = str(deal.get("UF_CRM_PRODUCT_TYPE") or "").strip().lower()
    if not raw:
        return []
    tokens = [t.strip() for t in raw.replace(";", ",").replace("\n", ",").split(",")]
    return [t for t in tokens if t]


def _build_transaction_matrix(deals: list[dict]) -> pd.DataFrame:
    """
    Строит бинарную матрицу сделка × продукт для mlxtend.

    :param deals: Список сделок
    :return: DataFrame с bool-значениями
    """
    transactions = []
    for deal in deals:
        products = _extract_products(deal)
        if products:
            transactions.append(products)

    if not transactions:
        return pd.DataFrame()

    te = TransactionEncoder()
    te_arr = te.fit_transform(transactions)
    df = pd.DataFrame(te_arr, columns=te.columns_)
    return df


def _group_by_company(deals: list[dict]) -> dict[int, list[str]]:
    """Возвращает словарь {company_id: [все_продукты_компании]}."""
    result: dict[int, list[str]] = {}
    for deal in deals:
        cid = int(deal.get("COMPANY_ID") or 0)
        if cid == 0:
            continue
        products = _extract_products(deal)
        if cid not in result:
            result[cid] = []
        result[cid].extend(products)
    return result


# ---------------------------------------------------------------------------
# Основной класс
# ---------------------------------------------------------------------------

class CrossSellEngine:
    """
    Движок cross-sell рекомендаций.

    Использует:
      - Ассоциативные правила (Apriori) из истории заказов
      - Жёсткие бизнес-правила типографии
    """

    def __init__(self, client: BitrixClient):
        self.client = client
        self.rules: pd.DataFrame | None = None
        self._load_model()

    def _save_model(self) -> None:
        if self.rules is not None:
            joblib.dump(self.rules, config.MODEL_CROSS_SELL)
            logger.info("Модель cross_sell сохранена: %s", config.MODEL_CROSS_SELL)

    def _load_model(self) -> None:
        if config.MODEL_CROSS_SELL.exists():
            try:
                self.rules = joblib.load(config.MODEL_CROSS_SELL)
                logger.info("Модель cross_sell загружена: %d правил", len(self.rules))
            except Exception as exc:
                logger.warning("Не удалось загрузить cross_sell модель: %s", exc)
                self.rules = None

    def train(self, days_back: int = 730, min_support: float = 0.1) -> dict:
        """
        Строит матрицу ассоциативных правил на истории заказов.

        :param days_back:    Глубина истории
        :param min_support:  Минимальная поддержка
        :return: Статистика обучения
        """
        logger.info(
            "Обучение CrossSell (history=%d дней, min_support=%.2f)...",
            days_back, min_support,
        )

        closed_deals = self.client.get_closed_deals(days_back=days_back)
        active_deals = self.client.get_active_deals()
        all_deals = closed_deals + active_deals

        df = _build_transaction_matrix(all_deals)
        if df.empty:
            logger.warning("Нет транзакций с заполненным типом продукта.")
            self.rules = pd.DataFrame()
            return {"rules_count": 0, "transactions": 0}

        logger.info("Транзакций для Apriori: %d", len(df))

        frequent_sets = apriori(df, min_support=min_support, use_colnames=True)
        if frequent_sets.empty:
            frequent_sets = apriori(df, min_support=0.05, use_colnames=True)

        if frequent_sets.empty:
            self.rules = pd.DataFrame()
            self._save_model()
            return {"rules_count": 0, "transactions": len(df)}

        rules = association_rules(frequent_sets, metric="confidence", min_threshold=0.5)
        rules = rules.sort_values("lift", ascending=False)

        self.rules = rules
        self._save_model()

        logger.info("CrossSell обучен: %d правил из %d транзакций", len(rules), len(df))
        return {
            "rules_count": len(rules),
            "transactions": len(df),
            "frequent_sets": len(frequent_sets),
        }

    def _apply_association_rules(
        self,
        current_products: set[str],
    ) -> list[tuple[str, float, str]]:
        """Применяет ассоциативные правила к набору продуктов клиента."""
        recommendations: list[tuple[str, float, str]] = []

        if self.rules is None or self.rules.empty:
            return recommendations

        for _, rule in self.rules.iterrows():
            antecedent = set(rule["antecedents"])
            consequent = set(rule["consequents"])

            if antecedent <= current_products and not consequent & current_products:
                for prod in consequent:
                    if prod not in current_products:
                        reason = (
                            f"Клиенты, заказывающие {', '.join(antecedent)}, "
                            f"также заказывают {prod} "
                            f"(confidence={rule['confidence']:.0%}, lift={rule['lift']:.2f})"
                        )
                        recommendations.append((prod, float(rule["confidence"]), reason))

        best: dict[str, tuple[float, str]] = {}
        for prod, conf, reason in recommendations:
            if prod not in best or conf > best[prod][0]:
                best[prod] = (conf, reason)

        return [(prod, conf, reason) for prod, (conf, reason) in best.items()]

    def _apply_business_rules(
        self,
        current_products: set[str],
        all_company_products: set[str],
    ) -> list[tuple[str, float, str]]:
        """Применяет жёсткие бизнес-правила типографии."""
        recommendations: list[tuple[str, float, str]] = []

        for rule in BUSINESS_RULES:
            if "if_product" in rule:
                if rule["if_product"] in current_products or rule["if_product"] in all_company_products:
                    for prod in rule["recommend"]:
                        if prod not in all_company_products:
                            recommendations.append((prod, 0.85, rule["reason"]))
            elif "if_no_product" in rule:
                has_marking = bool(MARKING_PRODUCTS & all_company_products)
                if not has_marking:
                    for prod in rule["recommend"]:
                        recommendations.append((prod, 0.9, rule["reason"]))

        return recommendations

    def recommend_and_create_tasks(self) -> list[CrossSellRecommendation]:
        """
        Генерирует рекомендации для всех активных сделок
        и создаёт задачи менеджерам в Б24.

        :return: Список рекомендаций
        """
        logger.info("Запуск генерации cross-sell рекомендаций...")

        active_deals = self.client.get_active_deals()
        closed_deals = self.client.get_closed_deals(days_back=730)
        all_deals = active_deals + closed_deals

        company_products = _group_by_company(all_deals)

        results: list[CrossSellRecommendation] = []
        processed_companies: set[int] = set()

        for deal in active_deals:
            deal_id = int(deal["ID"])
            company_id = int(deal.get("COMPANY_ID") or 0)
            manager_id = int(deal.get("ASSIGNED_BY_ID") or config.DEFAULT_RESPONSIBLE_ID)

            if company_id in processed_companies:
                continue
            processed_companies.add(company_id)

            current_products = set(_extract_products(deal))
            all_company_prods = set(company_products.get(company_id, []))

            assoc_recs = self._apply_association_rules(current_products)
            biz_recs   = self._apply_business_rules(current_products, all_company_prods)

            all_recs: dict[str, tuple[float, str]] = {}
            for prod, conf, reason in biz_recs + assoc_recs:
                if prod not in all_company_prods:
                    if prod not in all_recs or conf > all_recs[prod][0]:
                        all_recs[prod] = (conf, reason)

            if not all_recs:
                continue

            recommended = sorted(all_recs.items(), key=lambda x: x[1][0], reverse=True)

            rec_lines = "\n".join(
                f"  • {prod} (уверенность {conf:.0%}): {reason}"
                for prod, (conf, reason) in recommended
            )
            task_title = f"Cross-sell: рекомендации для компании #{company_id}"
            task_desc = (
                f"AI-аналитика выявила возможности для доп. продаж.\n\n"
                f"Сделка: #{deal_id}\n"
                f"Текущие продукты: {', '.join(current_products) or 'не указаны'}\n\n"
                f"Рекомендации:\n{rec_lines}\n\n"
                f"Сгенерировано: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
            )
            deadline = datetime.now() + timedelta(days=3)

            task_created = bool(
                self.client.create_task(
                    title=task_title,
                    description=task_desc,
                    responsible_id=manager_id,
                    deadline=deadline,
                    deal_id=deal_id,
                )
            )

            top_rec_str = ", ".join(p for p, _ in recommended[:3])
            self.client.update_deal(deal_id, {config.FIELD_CROSS_SELL: top_rec_str})

            results.append(CrossSellRecommendation(
                company_id=company_id,
                deal_id=deal_id,
                manager_id=manager_id,
                current_products=list(current_products),
                recommended_products=[p for p, _ in recommended],
                confidence=recommended[0][1][0] if recommended else 0.0,
                reason=recommended[0][1][1] if recommended else "",
                task_created=task_created,
            ))

        logger.info(
            "Cross-sell завершён: %d рекомендаций, задач создано: %d",
            len(results),
            sum(1 for r in results if r.task_created),
        )
        return results
```

---

## modules/churn_detector.py

```python
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
```

---

## modules/contact_optimizer.py

```python
"""
contact_optimizer.py — Определение оптимального времени контакта с клиентом.

Алгоритм:
  1. Получаем историю активностей из Б24 (звонки, письма)
  2. Фильтруем: только успешные (DIRECTION=1 или COMPLETED=Y)
  3. Для каждого клиента строим тепловую карту (7 дней × 24 часа)
  4. Топ-1 ячейка = оптимальное время
  5. Записываем в UF_CRM_BEST_CONTACT_TIME сделки

Типы активностей Б24:
  2 = Звонок | 3 = Email | 6 = Письмо
"""

import logging
from datetime import datetime
from typing import NamedTuple

import numpy as np
import pandas as pd
import joblib

import config
from modules.bitrix_client import BitrixClient

logger = logging.getLogger(__name__)

RELEVANT_ACTIVITY_TYPES = {2, 3, 6}
DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


class ContactWindow(NamedTuple):
    company_id: int
    deal_id: int
    day_of_week: int
    day_name: str
    hour: int
    time_label: str
    confidence: float
    total_contacts: int
    written_to_b24: bool


def _parse_activity_datetime(activity: dict) -> datetime | None:
    """Парсит дату/время активности из поля CREATED."""
    raw = activity.get("CREATED") or activity.get("DEADLINE") or ""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def _is_successful_activity(activity: dict) -> bool:
    """Успешная активность: входящий контакт (DIRECTION=1) или COMPLETED=Y."""
    direction = str(activity.get("DIRECTION", "")).strip()
    completed = str(activity.get("COMPLETED", "")).strip().upper()
    return direction == "1" or completed == "Y"


def _build_contact_heatmap(activities: list[dict], owner_id: int) -> np.ndarray | None:
    """
    Строит тепловую карту 7×24 для конкретного владельца (сделки).

    :return: Матрица 7×24 или None если нет данных
    """
    heatmap = np.zeros((7, 24), dtype=int)
    count = 0

    for act in activities:
        try:
            act_owner = int(act.get("OWNER_ID", 0))
        except (ValueError, TypeError):
            act_owner = 0

        if act_owner != owner_id:
            continue

        try:
            act_type = int(act.get("TYPE_ID", 0))
        except (ValueError, TypeError):
            act_type = 0

        if act_type not in RELEVANT_ACTIVITY_TYPES:
            continue

        if not _is_successful_activity(act):
            continue

        dt = _parse_activity_datetime(act)
        if dt is None:
            continue

        heatmap[dt.weekday(), dt.hour] += 1
        count += 1

    return heatmap if count > 0 else None


def _find_best_window(heatmap: np.ndarray) -> tuple[int, int, float]:
    """
    Находит день + час с максимальной активностью.

    :return: (day_of_week, hour, confidence)
    """
    total = heatmap.sum()
    if total == 0:
        return 2, 10, 0.0  # дефолт: среда 10:00

    best_flat = int(np.argmax(heatmap))
    best_day  = best_flat // 24
    best_hour = best_flat % 24
    confidence = float(heatmap[best_day, best_hour]) / float(total)
    return best_day, best_hour, confidence


class ContactOptimizer:
    """
    Определяет оптимальное время контакта с клиентом
    на основе истории активностей в Б24.
    """

    def __init__(self, client: BitrixClient):
        self.client = client
        self._contact_windows: dict[int, tuple[int, int, float]] = {}
        self._load_model()

    def _save_model(self) -> None:
        joblib.dump(self._contact_windows, config.MODEL_CONTACT_OPT)
        logger.info("Модель contact_optimizer сохранена: %d записей", len(self._contact_windows))

    def _load_model(self) -> None:
        if config.MODEL_CONTACT_OPT.exists():
            try:
                self._contact_windows = joblib.load(config.MODEL_CONTACT_OPT)
                logger.info(
                    "Модель contact_optimizer загружена: %d компаний",
                    len(self._contact_windows),
                )
            except Exception as exc:
                logger.warning("Не удалось загрузить contact_optimizer: %s", exc)
                self._contact_windows = {}

    def fit(self, days_back: int = 365) -> dict:
        """
        Строит оптимальные окна контакта по истории активностей.

        :param days_back: Глубина истории
        :return: Статистика
        """
        logger.info("ContactOptimizer.fit() — анализ %d дней истории...", days_back)

        active_deals = self.client.get_active_deals()
        activities   = self.client.get_activities(days_back=days_back)

        deal_to_company: dict[int, int] = {
            int(deal["ID"]): int(deal.get("COMPANY_ID") or 0)
            for deal in active_deals
        }

        company_heatmaps: dict[int, np.ndarray] = {}

        for deal in active_deals:
            did = int(deal["ID"])
            cid = deal_to_company.get(did, 0)
            if cid == 0:
                continue

            heatmap = _build_contact_heatmap(activities, owner_id=did)
            if heatmap is None:
                continue

            if cid not in company_heatmaps:
                company_heatmaps[cid] = np.zeros((7, 24), dtype=int)
            company_heatmaps[cid] += heatmap

        self._contact_windows = {}
        for cid, heatmap in company_heatmaps.items():
            day, hour, conf = _find_best_window(heatmap)
            self._contact_windows[cid] = (day, hour, conf)

        self._save_model()

        logger.info(
            "ContactOptimizer.fit() завершён: %d компаний обработано",
            len(self._contact_windows),
        )
        return {
            "companies_analyzed": len(self._contact_windows),
            "activities_used": len(activities),
        }

    def optimize_and_update(self) -> list[ContactWindow]:
        """
        Обновляет поля оптимального контакта для всех активных сделок.

        :return: Список результатов
        """
        logger.info("Запуск ContactOptimizer.optimize_and_update()...")

        self.fit(days_back=365)

        active_deals = self.client.get_active_deals()
        results: list[ContactWindow] = []
        processed: set[int] = set()

        for deal in active_deals:
            deal_id = int(deal["ID"])
            cid     = int(deal.get("COMPANY_ID") or 0)

            if cid in processed:
                continue
            processed.add(cid)

            if cid in self._contact_windows:
                day, hour, conf = self._contact_windows[cid]
            else:
                day, hour, conf = 2, 10, 0.0

            day_name   = DAYS_RU[day]
            time_label = f"{day_name} {hour:02d}:00–{(hour+1) % 24:02d}:00"

            written = self.client.update_deal(
                deal_id, {config.FIELD_CONTACT_TIME: time_label}
            )

            results.append(ContactWindow(
                company_id=cid,
                deal_id=deal_id,
                day_of_week=day,
                day_name=day_name,
                hour=hour,
                time_label=time_label,
                confidence=conf,
                total_contacts=0,
                written_to_b24=written,
            ))

        logger.info(
            "ContactOptimizer завершён: %d компаний, обновлено в Б24: %d",
            len(results),
            sum(1 for r in results if r.written_to_b24),
        )
        return results

    def get_best_time(self, company_id: int) -> str:
        """Возвращает строку оптимального времени для компании."""
        if company_id in self._contact_windows:
            day, hour, _ = self._contact_windows[company_id]
        else:
            day, hour = 2, 10

        return f"{DAYS_RU[day]} {hour:02d}:00–{(hour+1) % 24:02d}:00"
```

---

## modules/report_sender.py

```python
"""
report_sender.py — Формирование и отправка сводных отчётов в Битрикс24.

Возможности:
  - Ежедневный дайджест прогнозов сделок
  - Еженедельный cross-sell отчёт
  - Ежедневный churn-отчёт
  - Публикация в живую ленту или сохранение локально
  - Отчёт о переобучении моделей
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import config
from modules.bitrix_client import BitrixClient
from modules.deal_predictor import PredictionResult
from modules.cross_sell import CrossSellRecommendation
from modules.churn_detector import ChurnResult, RISK_HIGH, RISK_MEDIUM, RISK_LOW
from modules.contact_optimizer import ContactWindow

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def _format_predict_report(results: list[PredictionResult]) -> str:
    """Формирует текст дайджеста прогнозов сделок."""
    now_str = datetime.now().strftime("%d.%m.%Y")
    total   = len(results)

    high   = [r for r in results if r.probability_pct >= 70]
    medium = [r for r in results if 40 <= r.probability_pct < 70]
    low    = [r for r in results if r.probability_pct < 40]

    lines = [
        f"📊 [Прогноз закрытия сделок] {now_str}",
        f"Всего активных сделок: {total}",
        f"🟢 Высокая вероятность (≥70%): {len(high)}",
        f"🟡 Средняя (40–69%): {len(medium)}",
        f"🔴 Низкая (<40%): {len(low)}",
        "",
    ]

    if high:
        lines.append("▶ Топ-сделки для финализации:")
        for r in sorted(high, key=lambda x: -x.probability_pct)[:10]:
            factors = ", ".join(r.top_factors[:3])
            lines.append(f"  • Сделка #{r.deal_id}: {r.probability_pct}% [{factors}]")
        lines.append("")

    if low:
        lines.append("▶ Сделки под угрозой (требуют внимания):")
        for r in sorted(low, key=lambda x: x.probability_pct)[:10]:
            lines.append(f"  • Сделка #{r.deal_id}: {r.probability_pct}%")
        lines.append("")

    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_churn_report(results: list[ChurnResult]) -> str:
    """Формирует текст churn-отчёта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    high_list   = [r for r in results if r.churn_risk == RISK_HIGH]
    medium_list = [r for r in results if r.churn_risk == RISK_MEDIUM]

    lines = [
        f"🚨 [Churn Detection] {now_str}",
        f"HIGH риск: {len(high_list)} клиентов",
        f"MEDIUM риск: {len(medium_list)} клиентов",
        "",
    ]

    if high_list:
        lines.append("▶ КРИТИЧНО — требуют немедленного контакта:")
        for r in high_list[:15]:
            lines.append(
                f"  • {r.company_name} (#{r.company_id}): "
                f"{r.days_since_last_order} дней без заказа, "
                f"тренд {r.freq_trend_pct:+.0f}%, "
                f"ML-score {r.ml_churn_probability:.0%}"
            )
        lines.append("")

    if medium_list:
        lines.append("▶ ВНИМАНИЕ — средний риск:")
        for r in medium_list[:10]:
            lines.append(
                f"  • {r.company_name} (#{r.company_id}): "
                f"{r.days_since_last_order} дней без заказа"
            )
        lines.append("")

    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_crosssell_report(results: list[CrossSellRecommendation]) -> str:
    """Формирует текст cross-sell отчёта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    lines = [
        f"🛒 [Cross-Sell Рекомендации] {now_str}",
        f"Сгенерировано рекомендаций: {len(results)}",
        f"Задач менеджерам создано: {sum(1 for r in results if r.task_created)}",
        "",
    ]

    for r in results[:20]:
        rec_str = ", ".join(r.recommended_products[:3])
        lines.append(
            f"  • Компания #{r.company_id} (сделка #{r.deal_id}): "
            f"→ {rec_str} (conf {r.confidence:.0%})"
        )

    lines.append("")
    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


def _format_contact_report(results: list[ContactWindow]) -> str:
    """Формирует краткий отчёт об оптимальных временах контакта."""
    now_str = datetime.now().strftime("%d.%m.%Y")

    lines = [
        f"🕐 [Оптимальное время контакта] {now_str}",
        f"Обработано компаний: {len(results)}",
        "",
    ]
    for r in results[:15]:
        conf_str = f"{r.confidence:.0%}" if r.confidence > 0 else "нет данных"
        lines.append(
            f"  • Компания #{r.company_id}: {r.time_label} (уверенность: {conf_str})"
        )

    lines.append("")
    lines.append(f"Источник: AI-аналитика FLEX-N-ROLL PRO | {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    return "\n".join(lines)


class ReportSender:
    """Отправляет сводные отчёты в Битрикс24 и сохраняет локальные копии."""

    def __init__(self, client: BitrixClient):
        self.client = client

    def _save_local(self, filename: str, text: str, data: Any = None) -> Path:
        """Сохраняет текстовый отчёт и (опционально) JSON-данные локально."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        txt_path = REPORTS_DIR / f"{ts}_{filename}.txt"
        txt_path.write_text(text, encoding="utf-8")

        if data is not None:
            json_path = REPORTS_DIR / f"{ts}_{filename}.json"
            json_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
            logger.debug("Отчёт (JSON) сохранён: %s", json_path)

        logger.debug("Отчёт (TXT) сохранён: %s", txt_path)
        return txt_path

    def _send_to_feed(self, message: str) -> bool:
        """Публикует в живую ленту если настроен group_id."""
        if config.REPORT_GROUP_ID > 0:
            return self.client.post_to_feed(message, group_id=config.REPORT_GROUP_ID)
        return False

    def send_predict_report(self, results: list[PredictionResult]) -> bool:
        if not results:
            return False
        text = _format_predict_report(results)
        self._save_local("predict_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Отчёт по прогнозам %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_churn_report(self, results: list[ChurnResult]) -> bool:
        if not results:
            return False
        text = _format_churn_report(results)
        self._save_local("churn_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Churn отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_crosssell_report(self, results: list[CrossSellRecommendation]) -> bool:
        if not results:
            return False
        text = _format_crosssell_report(results)
        self._save_local("crosssell_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Cross-sell отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_contact_report(self, results: list[ContactWindow]) -> bool:
        if not results:
            return False
        text = _format_contact_report(results)
        self._save_local("contact_report", text, [r._asdict() for r in results])
        ok = self._send_to_feed(text)
        logger.info("Contact отчёт %s", "отправлен" if ok else "сохранён локально")
        return ok

    def send_retrain_summary(self, metrics: dict) -> bool:
        """Уведомляет об итогах ежемесячного переобучения моделей."""
        lines = [
            f"🤖 [Переобучение моделей] {datetime.now().strftime('%d.%m.%Y')}",
            "",
        ]
        for model_name, m in metrics.items():
            lines.append(f"▶ {model_name}:")
            for k, v in m.items():
                lines.append(f"  {k}: {v}")
            lines.append("")

        lines.append("Источник: AI-аналитика FLEX-N-ROLL PRO")
        text = "\n".join(lines)

        self._save_local("retrain_summary", text, metrics)
        ok = self._send_to_feed(text)
        logger.info("Отчёт о переобучении %s", "отправлен" if ok else "сохранён локально")
        return ok
```

---

## main.py

```python
"""
main.py — Точка входа и планировщик задач FLEX-N-ROLL Analytics.

Расписание:
  - Ежедневно 07:00  → Прогноз закрытия сделок
  - Ежедневно 08:00  → Churn detection
  - Ежедневно 09:00  → Оптимальное время контакта
  - Еженедельно Пн   → Cross-sell рекомендации
  - Ежемесячно 1-е   → Полное переобучение всех моделей
"""

import logging
import logging.handlers
import sys
import time
from datetime import datetime
from pathlib import Path

import schedule

import config


def _setup_logging() -> None:
    """Настраивает форматированное логирование в файл и консоль."""
    try:
        from colorlog import ColoredFormatter
        console_fmt = ColoredFormatter(
            "%(log_color)s%(asctime)s [%(levelname)-8s] %(name)s: %(message)s%(reset)s",
            datefmt="%H:%M:%S",
            log_colors={
                "DEBUG":    "cyan",
                "INFO":     "green",
                "WARNING":  "yellow",
                "ERROR":    "red",
                "CRITICAL": "bold_red",
            },
        )
    except ImportError:
        console_fmt = logging.Formatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )

    file_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(config.LOG_LEVEL)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_fmt)
    root.addHandler(console_handler)

    # Ротируемый файл (10 МБ × 5 файлов)
    file_handler = logging.handlers.RotatingFileHandler(
        config.LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(file_fmt)
    root.addHandler(file_handler)


logger = logging.getLogger(__name__)


def _init_components():
    """Создаёт все компоненты аналитики."""
    from modules.bitrix_client import BitrixClient
    from modules.deal_predictor import DealPredictor
    from modules.cross_sell import CrossSellEngine
    from modules.churn_detector import ChurnDetector
    from modules.contact_optimizer import ContactOptimizer
    from modules.report_sender import ReportSender

    client    = BitrixClient()
    predictor = DealPredictor(client)
    cross_sell = CrossSellEngine(client)
    churn     = ChurnDetector(client)
    optimizer = ContactOptimizer(client)
    reporter  = ReportSender(client)

    return client, predictor, cross_sell, churn, optimizer, reporter


# ---------------------------------------------------------------------------
# Задачи планировщика
# ---------------------------------------------------------------------------

def job_predict_deals(predictor, reporter) -> None:
    """Ежедневно 07:00 — прогноз вероятности закрытия сделок."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Прогноз закрытия сделок [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if predictor.model is None:
            logger.info("Модель не найдена. Запускаем начальное обучение...")
            metrics = predictor.train()
            logger.info("Обучение завершено: %s", metrics)
        results = predictor.predict_and_update()
        reporter.send_predict_report(results)
        logger.info("Прогноз завершён: %d сделок", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_predict_deals: %s", exc, exc_info=True)


def job_churn_detection(churn, reporter) -> None:
    """Ежедневно 08:00 — проверка churn-риска."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Churn Detection [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if churn.model is None:
            logger.info("Churn модель не найдена. Запускаем обучение...")
            metrics = churn.train()
            logger.info("Обучение churn: %s", metrics)
        results = churn.detect_and_update()
        reporter.send_churn_report(results)
        high_count = sum(1 for r in results if r.churn_risk == "HIGH")
        logger.info("Churn detection завершён: всего=%d, HIGH=%d", len(results), high_count)
    except Exception as exc:
        logger.error("ОШИБКА в job_churn_detection: %s", exc, exc_info=True)


def job_contact_optimizer(optimizer, reporter) -> None:
    """Ежедневно 09:00 — обновление оптимального времени контакта."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Contact Optimizer [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        results = optimizer.optimize_and_update()
        reporter.send_contact_report(results)
        logger.info("Contact optimizer завершён: %d компаний", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_contact_optimizer: %s", exc, exc_info=True)


def job_cross_sell(cross_sell, reporter) -> None:
    """Еженедельно в понедельник — cross-sell рекомендации."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Cross-Sell Рекомендации [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)
    try:
        if cross_sell.rules is None:
            logger.info("Cross-sell модель не найдена. Запускаем обучение...")
            metrics = cross_sell.train()
            logger.info("Cross-sell обучен: %s", metrics)
        results = cross_sell.recommend_and_create_tasks()
        reporter.send_crosssell_report(results)
        logger.info("Cross-sell завершён: %d рекомендаций", len(results))
    except Exception as exc:
        logger.error("ОШИБКА в job_cross_sell: %s", exc, exc_info=True)


def job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter) -> None:
    """Ежемесячно 1-е число — полное переобучение всех моделей."""
    logger.info("=" * 60)
    logger.info("ЗАДАЧА: Полное переобучение моделей [%s]", datetime.now().strftime("%d.%m.%Y %H:%M"))
    logger.info("=" * 60)

    client.invalidate_cache()  # Сброс кэша для получения свежих данных
    all_metrics: dict = {}

    for name, fn, kwargs in [
        ("DealPredictor",    predictor.train,   {"days_back": 365}),
        ("ChurnDetector",    churn.train,        {"days_back": 730}),
        ("CrossSell",        cross_sell.train,   {"days_back": 730}),
        ("ContactOptimizer", optimizer.fit,      {"days_back": 365}),
    ]:
        try:
            logger.info("Переобучение %s...", name)
            m = fn(**kwargs)
            all_metrics[name] = m
            logger.info("%s: %s", name, m)
        except Exception as exc:
            logger.error("Ошибка переобучения %s: %s", name, exc, exc_info=True)
            all_metrics[name] = {"error": str(exc)}

    reporter.send_retrain_summary(all_metrics)
    logger.info("Переобучение завершено. Итоги: %s", all_metrics)


# ---------------------------------------------------------------------------
# Точка входа
# ---------------------------------------------------------------------------

def main() -> None:
    """Запускает планировщик задач аналитики."""
    _setup_logging()

    logger.info("╔══════════════════════════════════════════════════════╗")
    logger.info("║       FLEX-N-ROLL Analytics — запуск планировщика   ║")
    logger.info("╚══════════════════════════════════════════════════════╝")
    logger.info("Webhook: %s***", config.BITRIX_WEBHOOK_URL[:30])

    client, predictor, cross_sell, churn, optimizer, reporter = _init_components()

    # Регистрируем ежедневные задачи
    schedule.every().day.at(config.SCHEDULER_DAILY_PREDICT_TIME).do(
        job_predict_deals, predictor=predictor, reporter=reporter
    )
    schedule.every().day.at(config.SCHEDULER_DAILY_CHURN_TIME).do(
        job_churn_detection, churn=churn, reporter=reporter
    )
    schedule.every().day.at("09:00").do(
        job_contact_optimizer, optimizer=optimizer, reporter=reporter
    )

    # Еженедельная задача (понедельник)
    schedule.every().monday.at("10:00").do(
        job_cross_sell, cross_sell=cross_sell, reporter=reporter
    )

    # Ежемесячная задача — schedule не поддерживает напрямую,
    # проверяем через ежедневную задачу в 03:00
    def _monthly_check():
        if datetime.now().day == config.SCHEDULER_MONTHLY_RETRAIN_DAY:
            job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter)

    schedule.every().day.at("03:00").do(_monthly_check)

    # Первичное обучение если модели отсутствуют
    if predictor.model is None or churn.model is None:
        logger.info("Необученные модели — запуск первичного обучения...")
        job_full_retrain(client, predictor, cross_sell, churn, optimizer, reporter)

    logger.info("Планировщик запущен. Зарегистрировано задач: %d", len(schedule.get_jobs()))
    logger.info("Ожидание (Ctrl+C для остановки)...")

    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        logger.info("Получен сигнал остановки. Выход.")
    except Exception as exc:
        logger.critical("Критическая ошибка в главном цикле: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

---

## models/.gitkeep

```
# Директория для сохранённых ML-моделей (.pkl файлы)
# Файлы моделей генерируются при первом запуске и при ежемесячном переобучении
# Не добавляйте *.pkl в .gitignore — они нужны для холодного старта

# Ожидаемые файлы после первого обучения:
#   deal_predictor.pkl       — ансамбль RF+LR
#   churn_detector.pkl       — GradientBoosting churn
#   cross_sell_matrix.pkl    — матрица ассоциативных правил
#   contact_optimizer.pkl    — тепловые карты контактов
```

---

## README.md

# FLEX-N-ROLL Analytics — AI-аналитика продаж типографии

Production-ready Python-система AI-аналитики для типографии **FLEX-N-ROLL PRO**
с интеграцией Битрикс24 REST API.

---

## Возможности

| Модуль | Функция | Расписание |
|--------|---------|------------|
| `deal_predictor` | Прогноз вероятности закрытия сделки (RF + LR ensemble) | Ежедневно 07:00 |
| `churn_detector` | Обнаружение риска потери клиента (HIGH/MEDIUM/LOW) | Ежедневно 08:00 |
| `contact_optimizer` | Оптимальное время звонка/письма по клиенту | Ежедневно 09:00 |
| `cross_sell` | Cross-sell рекомендации (Apriori + бизнес-правила) | Каждый понедельник |
| `main` (scheduler) | Переобучение всех моделей | 1-е число месяца |

---

## Быстрый старт

### 1. Настройка

```bash
git clone <repo-url> flex-n-roll-analytics
cd flex-n-roll-analytics
cp .env.example .env
# Укажите BITRIX_WEBHOOK_URL и другие параметры
nano .env
```

### 2. Пользовательские поля в Б24

CRM → Настройки → Поля сделок → Добавить поле:

| Поле | Тип | Код |
|------|-----|-----|
| Вероятность AI | Число | UF_CRM_WIN_PROBABILITY |
| Churn Risk AI | Строка | UF_CRM_CHURN_RISK |
| Cross-sell AI | Строка | UF_CRM_CROSS_SELL |
| Лучшее время | Строка | UF_CRM_BEST_CONTACT_TIME |
| Тип продукта | Строка | UF_CRM_PRODUCT_TYPE |
| Сегмент | Строка | UF_CRM_SEGMENT |

Права webhook: `crm` (read+write), `task`, `log`.

### 3. Запуск через Docker

```bash
docker-compose up -d
docker-compose logs -f analytics
```

### 4. Локальный запуск

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## Архитектура модулей

### `bitrix_client.py`
Retry через tenacity (3 попытки, exp backoff). Двухуровневый кэш: Redis → файловый JSON. Пагинация: `start=0..N` с шагом 50.

### `deal_predictor.py`
`VotingClassifier(RF×200 + LR, soft, weights=[2,1])`. Фичи: 17 признаков (стадия, сумма, продукт×10, история, активности, сегмент). Метрика: ROC-AUC.

### `cross_sell.py`
`mlxtend.Apriori(min_support=0.1)` + 3 жёстких бизнес-правила типографии. Создаёт задачи менеджерам с дедлайном +3 дня.

### `churn_detector.py`
Пороговые правила (PRIMARY) + `GradientBoostingClassifier` (вероятностный скоринг). HIGH-риск → задача менеджеру с дедлайном +1 день.

### `contact_optimizer.py`
Тепловая карта 7×24 из истории активностей. Фильтр: `DIRECTION=1` или `COMPLETED=Y`. Дефолт: Ср 10:00.

### `report_sender.py`
Все отчёты сохраняются в `/reports/` (`.txt` + `.json`). Публикация в живую ленту Б24 при `REPORT_GROUP_ID > 0`.

---

## Мониторинг

```bash
# Логи в реальном времени
tail -f logs/analytics.log

# Docker
docker-compose logs -f analytics
```

Ротация логов: 10 МБ × 5 файлов.

---

## Стек

| Библиотека | Версия | Назначение |
|------------|--------|------------|
| Python | 3.11+ | Runtime |
| pandas | 2.2.2 | Данные |
| scikit-learn | 1.4.2 | ML-модели |
| mlxtend | 0.23.1 | Apriori / association rules |
| requests | 2.31.0 | HTTP Б24 |
| tenacity | 8.3.0 | Retry-логика |
| schedule | 1.2.1 | Планировщик |
| redis | 5.0.4 | Кэш (опц.) |
| joblib | 1.4.2 | Сериализация |
| colorlog | 6.8.2 | Цветные логи |

---

*FLEX-N-ROLL PRO Analytics © 2025*

---

## МОДУЛЬ 4.3 — АНАЛИЗ КОММУНИКАЦИЙ (Whisper + GPT-4)

> **Промт для Claude Code CLI:**  
> "Создай Node.js проект `flex-n-roll-commanalysis` по следующей структуре. Создай все файлы с полным кодом."

# 4.3 AI-анализ коммуникаций — FLEX-N-ROLL PRO

Полный production-ready код системы AI-анализа коммуникаций для отдела продаж типографии.

**Стек:** Node.js 18+ · Express 4 · OpenAI Whisper API · GPT-4o · Битрикс24 REST API · ffmpeg · node-cron · Winston

**Структура проекта:**
```
flex-n-roll-commanalysis/
├── src/
│   ├── server.js
│   ├── services/
│   │   ├── whisper.js
│   │   ├── callAnalyzer.js
│   │   ├── chatAnalyzer.js
│   │   └── bitrix.js
│   ├── prompts/
│   │   ├── scriptCheck.js
│   │   ├── sentiment.js
│   │   └── dataExtract.js
│   └── utils/
│       ├── scorer.js
│       ├── reporter.js
│       └── logger.js
├── scheduler/
│   └── dailyBatch.js
├── config.js
├── package.json
├── .env.example
└── README.md
```

---

## `package.json`

```json
{
  "name": "flex-n-roll-commanalysis",
  "version": "1.0.0",
  "description": "AI-анализ коммуникаций отдела продаж типографии FLEX-N-ROLL PRO",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "scheduler": "node scheduler/dailyBatch.js",
    "scheduler:dev": "nodemon scheduler/dailyBatch.js"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "form-data": "^4.0.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "openai": "^4.29.2",
    "winston": "^3.12.0",
    "ffmpeg-static": "^5.2.0",
    "fluent-ffmpeg": "^2.1.2",
    "tmp": "^0.2.3",
    "dayjs": "^1.11.10"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## `.env.example`

```bash
# =============================================
# FLEX-N-ROLL PRO — AI Communications Analysis
# =============================================

# OpenAI
OPENAI_API_KEY=sk-...

# Битрикс24
BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.ru/rest/1/your_token/
BITRIX24_PORTAL=https://your-domain.bitrix24.ru

# Сервер
PORT=3000
NODE_ENV=production

# Логирование
LOG_LEVEL=info
LOG_DIR=./logs

# Ежедневная рассылка отчётов руководителю
REPORT_MANAGER_USER_ID=1          # ID руководителя в Б24
REPORT_EMAIL=director@flex-n-roll.by

# Лимиты и настройки
WHISPER_CHUNK_SIZE_MB=24           # Лимит чанка (Whisper API = 25MB)
GPT_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
DEFAULT_LANGUAGE=ru                # ru | be

# Временная папка для аудио
TMP_DIR=/tmp/commanalysis
```

---

## `config.js`

```js
'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');

// ── Валидация обязательных переменных ──────────────────────────────────────
const REQUIRED = ['OPENAI_API_KEY', 'BITRIX24_WEBHOOK_URL'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error(`[config] Отсутствуют переменные окружения: ${missing.join(', ')}`);
}

// ── Создание временной директории ─────────────────────────────────────────
const TMP_DIR = process.env.TMP_DIR || '/tmp/commanalysis';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Создание директории логов ──────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR || './logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

module.exports = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    apiKey:       process.env.OPENAI_API_KEY,
    gptModel:     process.env.GPT_MODEL     || 'gpt-4o',
    whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
  },

  // ── Битрикс24 ─────────────────────────────────────────────────────────────
  bitrix: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL.replace(/\/$/, ''),
    portal:     process.env.BITRIX24_PORTAL || '',
  },

  // ── Сервер ────────────────────────────────────────────────────────────────
  server: {
    port:     parseInt(process.env.PORT || '3000', 10),
    nodeEnv:  process.env.NODE_ENV || 'development',
  },

  // ── Аудио / Whisper ───────────────────────────────────────────────────────
  audio: {
    chunkSizeMB: parseFloat(process.env.WHISPER_CHUNK_SIZE_MB || '24'),
    tmpDir:      TMP_DIR,
    defaultLang: process.env.DEFAULT_LANGUAGE || 'ru',
    supportedLangs: ['ru', 'be'],
  },

  // ── Отчёты ────────────────────────────────────────────────────────────────
  reports: {
    managerUserId: process.env.REPORT_MANAGER_USER_ID || '1',
    email:         process.env.REPORT_EMAIL || '',
  },

  // ── Логирование ───────────────────────────────────────────────────────────
  logging: {
    level:  process.env.LOG_LEVEL || 'info',
    logDir: LOG_DIR,
  },
};
```

---

## `src/utils/logger.js`

```js
'use strict';

/**
 * logger.js — Winston logger для всего приложения
 */

const winston = require('winston');
const path    = require('path');
const config  = require('../../config');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Консоль с цветами
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),
    // Файл: все логи
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'app.log'),
      maxsize:  10 * 1024 * 1024,  // 10 MB rotate
      maxFiles: 5,
      tailable: true,
    }),
    // Файл: только ошибки
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'error.log'),
      level:    'error',
      maxsize:  5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;
```

---

## `src/server.js`

```js
'use strict';

const express  = require('express');
const morgan   = require('morgan');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const config   = require('../config');
const logger   = require('./utils/logger');

const whisperService   = require('./services/whisper');
const callAnalyzer     = require('./services/callAnalyzer');
const chatAnalyzer     = require('./services/chatAnalyzer');
const bitrixClient     = require('./services/bitrix');
const reporter         = require('./utils/reporter');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Multer (загрузка аудио) ────────────────────────────────────────────────
const upload = multer({
  dest: config.audio.tmpDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 * Проверка живости сервиса
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────────────────────
//  ЗВОНКИ
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/calls/analyze-by-deal
 * Тело: { dealId: string, language?: "ru"|"be" }
 * Полный цикл: скачать запись из Б24 → транскрибировать → анализировать → сохранить карточку
 */
app.post('/api/calls/analyze-by-deal', async (req, res) => {
  const { dealId, language } = req.body;
  if (!dealId) return res.status(400).json({ error: 'dealId required' });

  try {
    logger.info(`[calls] Запуск анализа сделки dealId=${dealId}`);

    // 1. Получить данные звонка из Б24
    const callInfo = await bitrixClient.getCallByDealId(dealId);
    if (!callInfo) {
      return res.status(404).json({ error: 'Запись звонка не найдена' });
    }

    // 2. Транскрибация
    const transcript = await whisperService.transcribeFromBitrix(
      callInfo.RECORD_URL,
      { language: language || config.audio.defaultLang, dealId }
    );

    // 3. Анализ
    const analysisResult = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo,
    });

    // 4. Сохранить поля в сделке
    await bitrixClient.updateDealFields(dealId, {
      UF_TRANSCRIPT: transcript.text.substring(0, 4000),
      UF_CALL_SCORE: analysisResult.overall_score,
      UF_SENTIMENT:  analysisResult.sentiment.overall_tone,
    });

    // 5. Создать HTML-карточку и сохранить как комментарий
    const managerInfo = await bitrixClient.getUserById(callInfo.PORTAL_USER_ID);
    const contactInfo = await bitrixClient.getContactByDealId(dealId);

    const card = reporter.buildCard({
      dealId,
      date: callInfo.CALL_START_DATE || new Date().toISOString(),
      manager: managerInfo?.NAME || 'Менеджер',
      client: contactInfo?.NAME || 'Клиент',
      type: 'call',
      analysis: analysisResult,
    });

    await bitrixClient.addTimelineComment(dealId, card.html);

    logger.info(`[calls] Анализ завершён dealId=${dealId} score=${analysisResult.overall_score}`);
    res.json({ success: true, dealId, analysis: analysisResult });

  } catch (err) {
    logger.error(`[calls] Ошибка dealId=${dealId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/calls/analyze-upload
 * Multipart: audio file + dealId + managerId + clientName
 * Прямая загрузка аудио без Б24-записи
 */
app.post('/api/calls/analyze-upload', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Аудиофайл не приложен' });

  const { dealId, managerId, clientName, language } = req.body;
  const tmpPath = req.file.path;

  try {
    logger.info(`[calls/upload] dealId=${dealId} file=${req.file.originalname}`);

    // Транскрибация загруженного файла
    const transcript = await whisperService.transcribeFile(tmpPath, {
      language: language || config.audio.defaultLang,
      originalName: req.file.originalname,
    });

    // Анализ
    const analysisResult = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo: { PORTAL_USER_ID: managerId },
    });

    // HTML-карточка
    const card = reporter.buildCard({
      dealId,
      date: new Date().toISOString(),
      manager: managerId  || 'Менеджер',
      client:  clientName || 'Клиент',
      type: 'call',
      analysis: analysisResult,
    });

    if (dealId) {
      await bitrixClient.updateDealFields(dealId, {
        UF_TRANSCRIPT: transcript.text.substring(0, 4000),
        UF_CALL_SCORE: analysisResult.overall_score,
        UF_SENTIMENT:  analysisResult.sentiment.overall_tone,
      });
      await bitrixClient.addTimelineComment(dealId, card.html);
    }

    res.json({ success: true, dealId, analysis: analysisResult, cardHtml: card.html });

  } catch (err) {
    logger.error(`[calls/upload] Ошибка: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    // Удалить временный файл
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  ЧАТ / ПЕРЕПИСКА
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/chats/analyze
 * Тело: { dealId: string, messages: [{role, text, timestamp}] }
 * Или  : { dealId: string }  — автозагрузка из Б24 CRM
 */
app.post('/api/chats/analyze', async (req, res) => {
  const { dealId, messages } = req.body;
  if (!dealId) return res.status(400).json({ error: 'dealId required' });

  try {
    logger.info(`[chats] Анализ переписки dealId=${dealId}`);

    let msgs = messages;
    if (!msgs || !msgs.length) {
      // Загрузить историю из Б24
      msgs = await bitrixClient.getChatMessagesByDealId(dealId);
    }
    if (!msgs || !msgs.length) {
      return res.status(404).json({ error: 'Сообщения не найдены' });
    }

    const analysisResult = await chatAnalyzer.analyzeChat({ dealId, messages: msgs });

    const managerInfo = await bitrixClient.getUserById(analysisResult.managerId);
    const contactInfo = await bitrixClient.getContactByDealId(dealId);

    const card = reporter.buildCard({
      dealId,
      date: new Date().toISOString(),
      manager: managerInfo?.NAME || 'Менеджер',
      client: contactInfo?.NAME || 'Клиент',
      type: 'chat',
      analysis: analysisResult,
    });

    await bitrixClient.addTimelineComment(dealId, card.html);

    logger.info(`[chats] Анализ завершён dealId=${dealId}`);
    res.json({ success: true, dealId, analysis: analysisResult });

  } catch (err) {
    logger.error(`[chats] Ошибка dealId=${dealId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  WEBHOOK ОТ БИТРИКС24
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhook/bitrix
 * Обработчик событий Б24:
 *   - ONCRMDEALADD       → запланировать анализ
 *   - ONVOXIMPLANTCALLEND → немедленно транскрибировать
 */
app.post('/api/webhook/bitrix', async (req, res) => {
  // Сразу ответить Б24, дальше обрабатывать асинхронно
  res.sendStatus(200);

  const event = req.body?.event || req.body?.EVENT;
  const data  = req.body?.data  || req.body?.DATA || {};

  logger.info(`[webhook] Событие: ${event}`);

  try {
    if (event === 'ONVOXIMPLANTCALLEND' || event === 'OnVoximplantCallEnd') {
      const callId = data?.CALL_ID;
      const dealId = data?.CRM_ENTITY_ID;
      if (callId && dealId) {
        // Небольшая задержка — запись может ещё записываться
        setTimeout(async () => {
          try {
            const callInfo = await bitrixClient.getCallInfo(callId);
            if (callInfo?.RECORD_URL) {
              const transcript = await whisperService.transcribeFromBitrix(
                callInfo.RECORD_URL,
                { language: config.audio.defaultLang, dealId }
              );
              const analysis = await callAnalyzer.analyzeCall({ transcript, dealId, callInfo });
              const card = reporter.buildCard({
                dealId,
                date: callInfo.CALL_START_DATE || new Date().toISOString(),
                manager: callInfo.PORTAL_USER_ID || 'Менеджер',
                client: callInfo.CRM_ENTITY_ID   || 'Клиент',
                type: 'call',
                analysis,
              });
              await bitrixClient.updateDealFields(dealId, {
                UF_TRANSCRIPT: transcript.text.substring(0, 4000),
                UF_CALL_SCORE: analysis.overall_score,
                UF_SENTIMENT:  analysis.sentiment.overall_tone,
              });
              await bitrixClient.addTimelineComment(dealId, card.html);
              logger.info(`[webhook] Обработан звонок callId=${callId}`);
            }
          } catch (e) {
            logger.error(`[webhook] Ошибка обработки callId=${callId}: ${e.message}`);
          }
        }, 10_000); // 10 секунд на запись файла
      }
    }
  } catch (err) {
    logger.error(`[webhook] Ошибка: ${err.message}`);
  }
});

// ── 404 / Error handlers ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  logger.error(`[server] Необработанная ошибка: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Запуск ─────────────────────────────────────────────────────────────────
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`FLEX-N-ROLL CommAnalysis API запущен на порту ${PORT}`);
});

module.exports = app; // для тестов
```

---

## `src/services/whisper.js`

```js
'use strict';

/**
 * whisper.js — Транскрибация аудиозаписей через OpenAI Whisper API
 *
 * Возможности:
 *  - Скачивание записи из Битрикс24
 *  - Автоматическое чанкование файлов >25 MB через ffmpeg
 *  - Поддержка языков: ru, be
 *  - Сохранение транскрипта в поле сделки (опционально)
 */

const fs        = require('fs');
const path      = require('path');
const axios     = require('axios');
const ffmpeg    = require('fluent-ffmpeg');
const ffmpegBin = require('ffmpeg-static');
const tmp       = require('tmp');
const { OpenAI } = require('openai');
const config    = require('../../config');
const logger    = require('../utils/logger');
const bitrix    = require('./bitrix');

// Подключить бинарник ffmpeg
ffmpeg.setFfmpegPath(ffmpegBin);

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Константы ─────────────────────────────────────────────────────────────
const CHUNK_SIZE_BYTES = config.audio.chunkSizeMB * 1024 * 1024;
const SUPPORTED_LANGS  = config.audio.supportedLangs;

// ─────────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Скачать файл по URL в локальный временный файл.
 * @param {string} url   — URL аудио (может быть с Basic-auth из Б24)
 * @param {string} destPath — куда сохранить
 * @returns {Promise<string>} путь к файлу
 */
async function downloadFile(url, destPath) {
  logger.debug(`[whisper] Скачиваем: ${url}`);
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 120_000,
    headers: {
      // Б24 иногда требует cookie / token — добавляется через webhookUrl
      'User-Agent': 'FlexNRollCommAnalysis/1.0',
    },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error',  reject);
  });

  const stat = fs.statSync(destPath);
  logger.debug(`[whisper] Загружено ${(stat.size / 1024 / 1024).toFixed(1)} MB → ${destPath}`);
  return destPath;
}

/**
 * Конвертировать аудио в mp3 16 kHz (оптимально для Whisper).
 * @param {string} inputPath
 * @returns {Promise<string>} путь к сконвертированному файлу
 */
function convertToMp3(inputPath) {
  const outPath = inputPath.replace(/\.[^.]+$/, '_converted.mp3');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate('32k')
      .output(outPath)
      .on('end',   () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Получить длительность аудио в секундах через ffprobe.
 * @param {string} filePath
 * @returns {Promise<number>}
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Разделить аудиофайл на чанки не более CHUNK_SIZE_BYTES.
 * Разделяем по времени, зная битрейт.
 * @param {string} filePath
 * @returns {Promise<string[]>} массив путей к чанкам
 */
async function splitAudioIntoChunks(filePath) {
  const stat      = fs.statSync(filePath);
  const totalSize = stat.size;

  if (totalSize <= CHUNK_SIZE_BYTES) {
    logger.debug(`[whisper] Файл ${(totalSize/1024/1024).toFixed(1)} MB — чанкование не нужно`);
    return [filePath];
  }

  const duration    = await getAudioDuration(filePath);
  const numChunks   = Math.ceil(totalSize / CHUNK_SIZE_BYTES);
  const chunkSecs   = Math.floor(duration / numChunks);
  const chunkPaths  = [];

  logger.info(`[whisper] Файл ${(totalSize/1024/1024).toFixed(1)} MB → ${numChunks} чанков по ~${chunkSecs}с`);

  for (let i = 0; i < numChunks; i++) {
    const start   = i * chunkSecs;
    const outPath = filePath.replace(/\.mp3$/, `_chunk${i + 1}.mp3`);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(filePath)
        .setStartTime(start)
        .audioCodec('libmp3lame')
        .output(outPath)
        .on('end',   resolve)
        .on('error', reject);

      // Для последнего чанка не задаём duration
      if (i < numChunks - 1) cmd.duration(chunkSecs);
      cmd.run();
    });

    chunkPaths.push(outPath);
  }

  return chunkPaths;
}

// ─────────────────────────────────────────────────────────────────────────
//  ОСНОВНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Отправить ОДИН аудиофайл в Whisper API.
 * @param {string} filePath  — локальный путь
 * @param {string} language  — 'ru' | 'be'
 * @returns {Promise<{ text: string, segments?: object[] }>}
 */
async function transcribeSingleFile(filePath, language = 'ru') {
  const lang = SUPPORTED_LANGS.includes(language) ? language : 'ru';
  logger.debug(`[whisper] Отправляем в Whisper: ${path.basename(filePath)} lang=${lang}`);

  const response = await openai.audio.transcriptions.create({
    file:             fs.createReadStream(filePath),
    model:            config.openai.whisperModel,
    language:         lang,
    response_format: 'verbose_json',  // получим segments с timestamps
    timestamp_granularities: ['segment'],
  });

  return {
    text:     response.text,
    segments: response.segments || [],
    language: response.language,
    duration: response.duration,
  };
}

/**
 * Транскрибировать файл с поддержкой чанкования.
 * @param {string} filePath
 * @param {{ language?: string, originalName?: string }} opts
 * @returns {Promise<{ text: string, segments: object[], duration?: number }>}
 */
async function transcribeFile(filePath, opts = {}) {
  const { language = config.audio.defaultLang } = opts;
  const tmpFiles = [];

  try {
    // Конвертация в mp3
    logger.info(`[whisper] Конвертация ${filePath}`);
    const mp3Path = await convertToMp3(filePath);
    tmpFiles.push(mp3Path);

    // Чанкование при необходимости
    const chunks = await splitAudioIntoChunks(mp3Path);
    // chunks[0] === mp3Path если не нужно делить — добавляем в tmpFiles остальные
    if (chunks.length > 1) tmpFiles.push(...chunks);

    // Транскрибация каждого чанка
    logger.info(`[whisper] Транскрибируем ${chunks.length} чанк(ов)...`);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      logger.debug(`[whisper] Чанк ${i + 1}/${chunks.length}`);
      const r = await transcribeSingleFile(chunks[i], language);
      results.push(r);
    }

    // Объединение результатов
    const combinedText = results.map(r => r.text).join(' ').trim();

    // Пересчитать смещения segments для склейки
    let timeOffset = 0;
    const allSegments = [];
    for (const r of results) {
      for (const seg of (r.segments || [])) {
        allSegments.push({
          ...seg,
          start: seg.start + timeOffset,
          end:   seg.end   + timeOffset,
        });
      }
      timeOffset += r.duration || 0;
    }

    logger.info(`[whisper] Транскрипт готов: ${combinedText.length} символов`);
    return { text: combinedText, segments: allSegments, duration: timeOffset };

  } finally {
    // Очистка временных файлов (не удаляем входной filePath — это забота вызывающего)
    for (const f of tmpFiles) {
      try { if (fs.existsSync(f) && f !== filePath) fs.unlinkSync(f); } catch (_) {}
    }
  }
}

/**
 * Скачать запись звонка из Битрикс24 и транскрибировать.
 * @param {string} recordUrl  — URL записи из telephony.externalcall.show
 * @param {{ language?: string, dealId?: string }} opts
 * @returns {Promise<{ text: string, segments: object[], duration?: number }>}
 */
async function transcribeFromBitrix(recordUrl, opts = {}) {
  const { language = config.audio.defaultLang, dealId } = opts;

  // Создать временный файл для скачивания
  const tmpFile = tmp.fileSync({
    dir:    config.audio.tmpDir,
    prefix: `call_${dealId || 'unknown'}_`,
    postfix: '.tmp',
    keep: false,
  });

  try {
    logger.info(`[whisper] Скачиваем запись dealId=${dealId} url=${recordUrl}`);

    // Попробовать скачать напрямую; если 403 — через Б24 webhook
    let localPath;
    try {
      localPath = await downloadFile(recordUrl, tmpFile.name);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        // Перезапросить защищённую ссылку через Б24 API
        logger.warn('[whisper] Прямое скачивание отклонено, запрашиваем через Б24...');
        const signed = await bitrix.getSignedAudioUrl(recordUrl, dealId);
        localPath = await downloadFile(signed, tmpFile.name);
      } else {
        throw err;
      }
    }

    const result = await transcribeFile(localPath, { language });

    // Сохранить транскрипт в поле сделки (первые 4000 символов — лимит поля Б24)
    if (dealId && result.text) {
      await bitrix.updateDealFields(dealId, {
        UF_TRANSCRIPT: result.text.substring(0, 4000),
      }).catch(e => logger.warn(`[whisper] Не удалось сохранить транскрипт в Б24: ${e.message}`));
    }

    return result;

  } finally {
    try { fs.unlinkSync(tmpFile.name); } catch (_) {}
  }
}

/**
 * Транскрибировать звонок по ID из Битрикс24 (telephony.externalcall.show).
 * @param {string} callId
 * @param {{ language?: string }} opts
 */
async function transcribeByCallId(callId, opts = {}) {
  const callInfo = await bitrix.getCallInfo(callId);
  if (!callInfo?.RECORD_URL) {
    throw new Error(`[whisper] Запись для callId=${callId} не найдена`);
  }
  return transcribeFromBitrix(callInfo.RECORD_URL, {
    language: opts.language || config.audio.defaultLang,
    dealId:   callInfo.CRM_ENTITY_ID,
  });
}

module.exports = {
  transcribeFile,
  transcribeFromBitrix,
  transcribeByCallId,
  // Экспорт утилит для тестов
  _splitAudioIntoChunks: splitAudioIntoChunks,
  _convertToMp3:         convertToMp3,
};
```

---

## `src/services/callAnalyzer.js`

```js
'use strict';

/**
 * callAnalyzer.js — GPT-4 анализ транскрипта звонка
 *
 * Выполняет:
 *  1. Проверку скрипта продаж по 7 критериям
 *  2. Sentiment-анализ
 *  3. Извлечение ключевых данных (передаётся в dataExtract)
 */

const { OpenAI } = require('openai');
const config     = require('../../config');
const logger     = require('../utils/logger');
const scorer     = require('../utils/scorer');
const { SCRIPT_CHECK_PROMPT }  = require('../prompts/scriptCheck');
const { SENTIMENT_PROMPT }     = require('../prompts/sentiment');
const { DATA_EXTRACT_PROMPT }  = require('../prompts/dataExtract');
const bitrix = require('./bitrix');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Утилита для безопасного JSON-парсинга GPT-ответа ──────────────────────
function safeParseJson(text) {
  // GPT иногда оборачивает JSON в ```json ... ```
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    logger.warn(`[callAnalyzer] JSON parse error: ${e.message}\nRaw: ${text.substring(0, 300)}`);
    throw new Error(`GPT вернул невалидный JSON: ${e.message}`);
  }
}

// ── GPT вызов с retry ─────────────────────────────────────────────────────
async function callGpt(systemPrompt, userMessage, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: config.openai.gptModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      return completion.choices[0].message.content;
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn(`[callAnalyzer] GPT попытка ${attempt + 1} провалилась: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  ПРОВЕРКА СКРИПТА ПРОДАЖ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Проверить транскрипт по 7 пунктам скрипта продаж.
 * @param {string} transcript  — полный текст транскрипта
 * @returns {Promise<ScriptCheckResult>}
 *
 * @typedef {Object} ScriptCheckResult
 * @property {number}   script_score      — 0-100
 * @property {string[]} passed_items      — пройденные пункты
 * @property {string[]} failed_items      — непройденные пункты
 * @property {string[]} recommendations  — конкретные рекомендации
 * @property {Object}   details          — детали по каждому пункту
 */
async function checkSalesScript(transcript) {
  logger.info('[callAnalyzer] Проверка скрипта продаж...');

  const raw = await callGpt(
    SCRIPT_CHECK_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  // Валидация структуры
  if (typeof result.script_score !== 'number') {
    result.script_score = 0;
  }
  result.script_score = Math.min(100, Math.max(0, Math.round(result.script_score)));
  result.passed_items    = result.passed_items    || [];
  result.failed_items    = result.failed_items    || [];
  result.recommendations = result.recommendations || [];
  result.details         = result.details         || {};

  logger.info(`[callAnalyzer] Скрипт: ${result.script_score}/100, ` +
    `пройдено ${result.passed_items.length}/7 пунктов`);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  SENTIMENT-АНАЛИЗ
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SentimentResult
 * @property {string}   overall_tone     — 'positive'|'neutral'|'negative'
 * @property {string}   client_tone      — 'interest'|'skepticism'|'irritation'
 * @property {string}   manager_tone     — 'confident'|'uncertain'|'aggressive'|'friendly'
 * @property {string}   churn_risk       — 'low'|'medium'|'high'
 * @property {Object[]} negative_moments — [{timestamp, quote, reason}]
 * @property {string}   summary          — краткое резюме тональности
 */
async function analyzeSentiment(transcript) {
  logger.info('[callAnalyzer] Sentiment-анализ...');

  const raw = await callGpt(
    SENTIMENT_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  // Нормализация
  const TONE_VALS  = ['positive', 'neutral', 'negative'];
  const CLIENT_VALS = ['interest', 'skepticism', 'irritation', 'neutral'];
  const RISK_VALS  = ['low', 'medium', 'high'];

  if (!TONE_VALS.includes(result.overall_tone))   result.overall_tone  = 'neutral';
  if (!CLIENT_VALS.includes(result.client_tone))  result.client_tone   = 'neutral';
  if (!RISK_VALS.includes(result.churn_risk))     result.churn_risk    = 'low';
  result.negative_moments = result.negative_moments || [];
  result.summary = result.summary || '';

  logger.info(`[callAnalyzer] Sentiment: ${result.overall_tone}, риск оттока: ${result.churn_risk}`);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  ИЗВЛЕЧЕНИЕ ДАННЫХ
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExtractedData
 * @property {Object}   product        — { material, size, quantity, type }
 * @property {string}   deadline       — deadline строкой ('до 15 апреля', '')
 * @property {string[]} objections     — список возражений клиента
 * @property {Object}   agreements     — { followup_date, next_step, notes }
 * @property {Object}   contacts       — { name, phone, email }
 * @property {string[]} unanswered     — вопросы клиента без ответа
 */
async function extractKeyData(transcript) {
  logger.info('[callAnalyzer] Извлечение данных...');

  const raw = await callGpt(
    DATA_EXTRACT_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  result.product     = result.product     || {};
  result.deadline    = result.deadline    || '';
  result.objections  = result.objections  || [];
  result.agreements  = result.agreements  || {};
  result.contacts    = result.contacts    || {};
  result.unanswered  = result.unanswered  || [];

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД: ПОЛНЫЙ АНАЛИЗ ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Полный анализ транскрипта звонка.
 *
 * @param {{ transcript: {text: string}, dealId: string, callInfo: object }} params
 * @returns {Promise<FullCallAnalysis>}
 */
async function analyzeCall({ transcript, dealId, callInfo = {} }) {
  const text = typeof transcript === 'string' ? transcript : transcript.text;

  if (!text || text.trim().length < 50) {
    throw new Error('[callAnalyzer] Транскрипт слишком короткий или пустой');
  }

  logger.info(`[callAnalyzer] Запуск полного анализа dealId=${dealId}, ${text.length} симв.`);

  // Запустить все три анализа параллельно
  const [scriptResult, sentimentResult, extractedData] = await Promise.all([
    checkSalesScript(text),
    analyzeSentiment(text),
    extractKeyData(text),
  ]);

  // Итоговый балл: взвешенная сумма
  const overall_score = scorer.computeOverallScore({
    script_score:    scriptResult.script_score,
    sentiment:       sentimentResult,
    extractedData,
  });

  // Автозаполнение полей сделки в Б24
  if (dealId && extractedData) {
    const fieldsToUpdate = {};

    if (extractedData.product?.type)      fieldsToUpdate.UF_PRODUCT_TYPE   = extractedData.product.type;
    if (extractedData.product?.material)  fieldsToUpdate.UF_PRODUCT_MATERIAL = extractedData.product.material;
    if (extractedData.product?.quantity)  fieldsToUpdate.UF_PRINT_QUANTITY  = String(extractedData.product.quantity);
    if (extractedData.deadline)           fieldsToUpdate.UF_CLIENT_DEADLINE  = extractedData.deadline;
    if (extractedData.agreements?.next_step) fieldsToUpdate.UF_NEXT_STEP    = extractedData.agreements.next_step;
    if (extractedData.objections?.length) fieldsToUpdate.UF_OBJECTIONS      = extractedData.objections.join('; ');

    if (Object.keys(fieldsToUpdate).length > 0) {
      await bitrix.updateDealFields(dealId, fieldsToUpdate)
        .catch(e => logger.warn(`[callAnalyzer] Не удалось обновить поля Б24: ${e.message}`));
    }
  }

  const result = {
    dealId,
    overall_score,
    script:        scriptResult,
    sentiment:     sentimentResult,
    extracted:     extractedData,
    analyzed_at:   new Date().toISOString(),
    transcript_len: text.length,
  };

  logger.info(`[callAnalyzer] Анализ завершён dealId=${dealId} overall=${overall_score}`);
  return result;
}

module.exports = {
  analyzeCall,
  checkSalesScript,
  analyzeSentiment,
  extractKeyData,
};
```

---

## `src/services/chatAnalyzer.js`

```js
'use strict';

/**
 * chatAnalyzer.js — Анализ переписки менеджера с клиентом
 *
 * Метрики:
 *  - Скорость первого ответа менеджера (минуты)
 *  - Среднее время ответа
 *  - Полнота ответов (все ли вопросы клиента закрыты)
 *  - Проверка орфографии / грамматики
 *  - Тональность (GPT)
 *  - Итоговый балл чата
 */

const dayjs    = require('dayjs');
const { OpenAI } = require('openai');
const config   = require('../../config');
const logger   = require('../utils/logger');
const scorer   = require('../utils/scorer');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Утилита: безопасный парсинг JSON из GPT ───────────────────────────────
function safeParseJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error(`GPT вернул невалидный JSON: ${e.message}`); }
}

// ── GPT вызов ──────────────────────────────────────────────────────────────
async function callGpt(systemPrompt, userMessage) {
  const completion = await openai.chat.completions.create({
    model: config.openai.gptModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  return completion.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────────────────────
//  СИСТЕМНЫЙ ПРОМТ ДЛЯ АНАЛИЗА ПЕРЕПИСКИ
// ─────────────────────────────────────────────────────────────────────────
const CHAT_ANALYSIS_PROMPT = `
Ты — эксперт по качеству продаж полиграфической компании FLEX-N-ROLL PRO.
Тебе дана переписка менеджера с клиентом (чат, мессенджер или CRM-переписка).

Проанализируй переписку и верни ТОЛЬКО валидный JSON-объект:
{
  "completeness_score": <число 0-100, насколько полно менеджер ответил на вопросы клиента>,
  "tone_score": <число 0-100, качество тональности и вежливости>,
  "spelling_score": <число 0-100, отсутствие ошибок>,
  "unanswered_questions": [<список вопросов клиента, оставшихся без ответа>],
  "spelling_errors": [{"text": "<фраза с ошибкой>", "correction": "<исправление>"}],
  "tone": "professional"|"friendly"|"neutral"|"rude"|"over_formal",
  "client_sentiment": "positive"|"neutral"|"negative"|"interested",
  "churn_risk": "low"|"medium"|"high",
  "recommendations": [<список конкретных рекомендаций по улучшению переписки>],
  "summary": "<краткое резюме переписки 2-3 предложения>"
}

Критерии полноты (completeness_score):
- 100: все вопросы клиента получили развёрнутый ответ
- 70-99: большинство ответов есть, но не все детальны
- 40-69: часть вопросов проигнорирована
- 0-39: менеджер отвечал односложно или игнорировал вопросы
`.trim();

// ─────────────────────────────────────────────────────────────────────────
//  ВЫЧИСЛЕНИЕ МЕТРИК ВРЕМЕНИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Определить роль первого сообщения и время первого ответа менеджера.
 * @param {Array<{role: string, text: string, timestamp: string}>} messages
 * @returns {{ firstResponseMinutes: number|null, avgResponseMinutes: number|null, managerId: string|null }}
 */
function computeTimingMetrics(messages) {
  if (!messages || messages.length < 2) {
    return { firstResponseMinutes: null, avgResponseMinutes: null, managerId: null };
  }

  // Найти первое сообщение от клиента
  const clientMsgs  = messages.filter(m => m.role === 'client');
  const managerMsgs = messages.filter(m => m.role === 'manager');

  if (!clientMsgs.length || !managerMsgs.length) {
    return { firstResponseMinutes: null, avgResponseMinutes: null, managerId: null };
  }

  // Первый ответ менеджера после первого сообщения клиента
  const firstClientTs  = dayjs(clientMsgs[0].timestamp);
  const firstManagerTs = managerMsgs
    .map(m => dayjs(m.timestamp))
    .filter(t => t.isAfter(firstClientTs))
    .sort((a, b) => a - b)[0];

  const firstResponseMinutes = firstManagerTs
    ? firstManagerTs.diff(firstClientTs, 'minute')
    : null;

  // Среднее время ответа менеджера на каждое клиентское сообщение
  const responseTimes = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'client') {
      const clientTs = dayjs(messages[i].timestamp);
      // Найти ближайший ответ менеджера после этого клиентского
      const nextManagerMsg = messages
        .slice(i + 1)
        .find(m => m.role === 'manager' && dayjs(m.timestamp).isAfter(clientTs));
      if (nextManagerMsg) {
        responseTimes.push(dayjs(nextManagerMsg.timestamp).diff(clientTs, 'minute'));
      }
    }
  }

  const avgResponseMinutes = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;

  const managerId = managerMsgs[0]?.userId || null;

  return { firstResponseMinutes, avgResponseMinutes, managerId };
}

/**
 * Оценка скорости ответа (0-100).
 * @param {number|null} minutes
 */
function scoreResponseTime(minutes) {
  if (minutes === null) return 50; // нет данных
  if (minutes <= 5)    return 100;
  if (minutes <= 15)   return 85;
  if (minutes <= 30)   return 70;
  if (minutes <= 60)   return 50;
  if (minutes <= 120)  return 30;
  return 10;
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД
// ─────────────────────────────────────────────────────────────────────────

/**
 * Анализ переписки.
 *
 * @param {{ dealId: string, messages: Array<{role: string, text: string, timestamp?: string, userId?: string}> }} params
 *
 * @typedef {Object} ChatAnalysisResult
 * @property {string}       dealId
 * @property {number}       overall_score
 * @property {number}       completeness_score
 * @property {number}       tone_score
 * @property {number}       spelling_score
 * @property {number}       response_time_score
 * @property {number|null}  first_response_minutes
 * @property {number|null}  avg_response_minutes
 * @property {string|null}  managerId
 * @property {string[]}     unanswered_questions
 * @property {Object[]}     spelling_errors
 * @property {string}       tone
 * @property {string}       client_sentiment
 * @property {string}       churn_risk
 * @property {string[]}     recommendations
 * @property {string}       summary
 * @property {string}       analyzed_at
 */
async function analyzeChat({ dealId, messages }) {
  logger.info(`[chatAnalyzer] Анализ dealId=${dealId}, ${messages.length} сообщений`);

  if (!messages || messages.length === 0) {
    throw new Error('[chatAnalyzer] Нет сообщений для анализа');
  }

  // Вычислить временные метрики (не требует GPT)
  const timing = computeTimingMetrics(messages);
  const responseTimeScore = scoreResponseTime(timing.firstResponseMinutes);

  // Подготовить текст переписки для GPT
  const chatText = messages.map((m, i) => {
    const role = m.role === 'manager' ? 'Менеджер' : 'Клиент';
    const ts   = m.timestamp ? `[${dayjs(m.timestamp).format('DD.MM HH:mm')}] ` : '';
    return `${ts}${role}: ${m.text}`;
  }).join('\n');

  // GPT анализ
  let gptResult;
  try {
    const raw = await callGpt(CHAT_ANALYSIS_PROMPT, `Переписка:\n\n${chatText}`);
    gptResult = safeParseJson(raw);
  } catch (err) {
    logger.error(`[chatAnalyzer] GPT ошибка: ${err.message}`);
    // Fallback — нулевые оценки
    gptResult = {
      completeness_score:  0,
      tone_score:          0,
      spelling_score:      0,
      unanswered_questions: [],
      spelling_errors:     [],
      tone:                'neutral',
      client_sentiment:    'neutral',
      churn_risk:          'low',
      recommendations:     ['Не удалось выполнить GPT-анализ: ' + err.message],
      summary:             '',
    };
  }

  // Итоговый балл чата
  const overall_score = scorer.computeChatScore({
    completeness_score:  gptResult.completeness_score  || 0,
    tone_score:          gptResult.tone_score          || 0,
    spelling_score:      gptResult.spelling_score      || 0,
    response_time_score: responseTimeScore,
  });

  const result = {
    dealId,
    overall_score,
    completeness_score:    gptResult.completeness_score  || 0,
    tone_score:            gptResult.tone_score          || 0,
    spelling_score:        gptResult.spelling_score      || 0,
    response_time_score:   responseTimeScore,
    first_response_minutes: timing.firstResponseMinutes,
    avg_response_minutes:  timing.avgResponseMinutes,
    managerId:             timing.managerId,
    unanswered_questions:  gptResult.unanswered_questions || [],
    spelling_errors:       gptResult.spelling_errors      || [],
    tone:                  gptResult.tone                 || 'neutral',
    client_sentiment:      gptResult.client_sentiment     || 'neutral',
    churn_risk:            gptResult.churn_risk           || 'low',
    recommendations:       gptResult.recommendations     || [],
    summary:               gptResult.summary             || '',
    message_count:         messages.length,
    analyzed_at:           new Date().toISOString(),
  };

  logger.info(`[chatAnalyzer] Готово dealId=${dealId} overall=${overall_score}`);
  return result;
}

module.exports = {
  analyzeChat,
  computeTimingMetrics,
  scoreResponseTime,
};
```

---

## `src/services/bitrix.js`

```js
'use strict';

/**
 * bitrix.js — Клиент Битрикс24 REST API
 *
 * Методы:
 *  - Звонки (telephony)
 *  - Сделки CRM
 *  - Контакты
 *  - Пользователи
 *  - Переписка / история
 *  - Комментарии к таймлайну
 */

const axios  = require('axios');
const config = require('../../config');
const logger = require('../utils/logger');

// ── Базовый клиент ────────────────────────────────────────────────────────
const http = axios.create({
  baseURL: config.bitrix.webhookUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Перехватчик ошибок: добавить текст ответа к сообщению
http.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error_description
      || err.response?.data?.error
      || err.message;
    logger.error(`[bitrix] HTTP ${err.response?.status}: ${msg}`);
    return Promise.reject(new Error(`Bitrix24 API: ${msg}`));
  }
);

/**
 * Базовый REST-вызов.
 * @param {string} method  — напр. 'crm.deal.get'
 * @param {object} params  — параметры запроса
 */
async function call(method, params = {}) {
  logger.debug(`[bitrix] → ${method}`);
  const { data } = await http.post(`/${method}`, params);
  if (data.error) {
    throw new Error(`Bitrix24 ${method}: ${data.error_description || data.error}`);
  }
  return data.result;
}

// ── Пагинированный список ──────────────────────────────────────────────────
async function listAll(method, params = {}) {
  let start  = 0;
  const all  = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await http.post(`/${method}`, { ...params, start });
    if (data.error) throw new Error(`Bitrix24 ${method}: ${data.error_description}`);

    const items = Array.isArray(data.result) ? data.result : Object.values(data.result || {});
    all.push(...items);

    if (!data.next || all.length >= (data.total || Infinity)) break;
    start = data.next;
  }

  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ЗВОНКИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить информацию о звонке по ID.
 * Использует telephony.externalcall.show (не требует подтверждения).
 * @param {string} callId
 */
async function getCallInfo(callId) {
  try {
    const result = await call('telephony.externalcall.show', { CALL_ID: callId });
    return result;
  } catch (e) {
    logger.warn(`[bitrix] getCallInfo failed: ${e.message}`);
    return null;
  }
}

/**
 * Получить запись звонка по ID сделки.
 * Ищем в истории активностей (crm.activity.list).
 * @param {string} dealId
 */
async function getCallByDealId(dealId) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      OWNER_TYPE_ID: 2, // Deal
      OWNER_ID: dealId,
      TYPE_ID: 2,       // Звонок
    },
    select: ['ID', 'SUBJECT', 'START_TIME', 'SETTINGS', 'COMMUNICATIONS'],
    order: { START_TIME: 'DESC' },
  });

  if (!activities.length) return null;

  const latest = activities[0];
  const recordUrl = latest?.SETTINGS?.RECORD_URL
    || latest?.SETTINGS?.recordUrl
    || null;

  return {
    CALL_ID:          latest.ID,
    RECORD_URL:       recordUrl,
    CALL_START_DATE:  latest.START_TIME,
    PORTAL_USER_ID:   latest.RESPONSIBLE_ID,
    CRM_ENTITY_ID:    dealId,
    CRM_ENTITY_TYPE: 'deal',
  };
}

/**
 * Получить список звонков за конкретный день.
 * @param {string} dateFrom  — ISO-дата начала (напр. '2024-03-01T00:00:00')
 * @param {string} dateTo    — ISO-дата конца
 */
async function getCallsForDay(dateFrom, dateTo) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      TYPE_ID: 2,           // Звонок
      '>START_TIME': dateFrom,
      '<START_TIME': dateTo,
    },
    select: ['ID', 'SUBJECT', 'START_TIME', 'OWNER_ID', 'OWNER_TYPE_ID',
             'RESPONSIBLE_ID', 'SETTINGS', 'COMMUNICATIONS'],
    order: { START_TIME: 'ASC' },
  });

  return activities.map(a => ({
    CALL_ID:         a.ID,
    RECORD_URL:      a.SETTINGS?.RECORD_URL || a.SETTINGS?.recordUrl || null,
    CALL_START_DATE: a.START_TIME,
    PORTAL_USER_ID:  a.RESPONSIBLE_ID,
    CRM_ENTITY_ID:   a.OWNER_ID,
    CRM_ENTITY_TYPE: a.OWNER_TYPE_ID === 2 ? 'deal' : 'other',
  })).filter(c => c.RECORD_URL); // только звонки с записью
}

/**
 * Получить защищённую ссылку на аудио через Б24.
 * Используется когда прямое скачивание отклоняется (403).
 */
async function getSignedAudioUrl(originalUrl, dealId) {
  // Битрикс24 не предоставляет отдельного метода для подписанных URL.
  // Возвращаем оригинальный URL с добавлением auth-параметра из webhook.
  const webhookBase = config.bitrix.webhookUrl;
  // Конструируем токен из webhook URL
  const match = webhookBase.match(/\/rest\/(\d+)\/([^/]+)\//);
  if (!match) return originalUrl;
  return `${originalUrl}&auth=${match[2]}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  СДЕЛКИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить сделку по ID.
 * @param {string} dealId
 */
async function getDeal(dealId) {
  return call('crm.deal.get', { id: dealId });
}

/**
 * Обновить поля сделки.
 * @param {string} dealId
 * @param {object} fields  — ключ-значение полей
 */
async function updateDealFields(dealId, fields) {
  if (!dealId || !fields || !Object.keys(fields).length) return;

  logger.debug(`[bitrix] Обновление сделки ${dealId}: ${Object.keys(fields).join(', ')}`);
  return call('crm.deal.update', { id: dealId, fields });
}

// ═══════════════════════════════════════════════════════════════════════════
//  КОНТАКТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить контакт, привязанный к сделке.
 * @param {string} dealId
 */
async function getContactByDealId(dealId) {
  const contacts = await call('crm.deal.contact.items.get', { id: dealId });
  if (!contacts?.length) return null;

  const contactId = contacts[0].CONTACT_ID;
  return call('crm.contact.get', { id: contactId });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ПОЛЬЗОВАТЕЛИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить пользователя по ID.
 * @param {string|number} userId
 */
async function getUserById(userId) {
  if (!userId) return null;
  try {
    const result = await call('user.get', { ID: userId });
    return Array.isArray(result) ? result[0] : result;
  } catch (e) {
    logger.warn(`[bitrix] getUserById(${userId}): ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ПЕРЕПИСКА / ЧАТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить историю переписки по сделке из CRM-активностей (email, чат).
 * @param {string} dealId
 */
async function getChatMessagesByDealId(dealId) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      OWNER_TYPE_ID: 2, // Deal
      OWNER_ID: dealId,
      TYPE_ID: [4, 15], // 4=Email, 15=OpenChannel/Чат
    },
    select: ['ID', 'TYPE_ID', 'SUBJECT', 'START_TIME', 'DESCRIPTION',
             'AUTHOR_ID', 'RESPONSIBLE_ID', 'DIRECTION', 'SETTINGS'],
    order: { START_TIME: 'ASC' },
  });

  // Нормализовать в единый формат
  return activities.map(a => ({
    id:        a.ID,
    role:      a.DIRECTION === 1 ? 'client' : 'manager',  // 1=Входящий=Клиент, 2=Исходящий=Менеджер
    text:      a.DESCRIPTION || a.SUBJECT || '',
    timestamp: a.START_TIME,
    userId:    a.RESPONSIBLE_ID,
    type:      a.TYPE_ID === 4 ? 'email' : 'chat',
  })).filter(m => m.text.trim().length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ТАЙМЛАЙН / КОММЕНТАРИИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Добавить комментарий к таймлайну сделки.
 * @param {string} dealId
 * @param {string} htmlComment  — HTML-контент карточки
 */
async function addTimelineComment(dealId, htmlComment) {
  logger.debug(`[bitrix] addTimelineComment dealId=${dealId}`);
  return call('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID:   dealId,
      ENTITY_TYPE: 'deal',
      COMMENT:     htmlComment,
    },
  });
}

/**
 * Отправить уведомление пользователю в Б24 (им.канал).
 * @param {string|number} toUserId
 * @param {string} message
 */
async function sendNotification(toUserId, message) {
  return call('im.notify.system.add', {
    USER_ID: toUserId,
    MESSAGE: message,
  });
}

/**
 * Создать задачу на руководителя (сводный отчёт).
 * @param {string} responsibleId  — ID руководителя
 * @param {string} title
 * @param {string} description
 * @param {string} deadline       — ISO-дата
 */
async function createTask(responsibleId, title, description, deadline) {
  return call('tasks.task.add', {
    fields: {
      TITLE:          title,
      DESCRIPTION:    description,
      RESPONSIBLE_ID: responsibleId,
      DEADLINE:       deadline,
      PRIORITY:       1,
    },
  });
}

module.exports = {
  call,
  listAll,
  // Звонки
  getCallInfo,
  getCallByDealId,
  getCallsForDay,
  getSignedAudioUrl,
  // Сделки
  getDeal,
  updateDealFields,
  // Контакты
  getContactByDealId,
  // Пользователи
  getUserById,
  // Переписка
  getChatMessagesByDealId,
  // Таймлайн
  addTimelineComment,
  sendNotification,
  createTask,
};
```

---

## `src/prompts/scriptCheck.js`

```js
'use strict';

// Промт: проверка скрипта продаж по 7 критериям
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const SCRIPT_CHECK_PROMPT = `
Ты — эксперт по качеству продаж в типографии FLEX-N-ROLL PRO (Беларусь).
Компания производит флексографскую печать: гибкая упаковка, этикетки, стикеры.

Тебе дан транскрипт звонка менеджера с клиентом.
Оцени работу МЕНЕДЖЕРА по 7 обязательным пунктам скрипта продаж.

ПУНКТЫ СКРИПТА (оценивай каждый: passed = true/false):
1. "greeting"       — Приветствие и представление (назвал имя, компанию)
2. "needs_discovery" — Выявление потребности (задал минимум 3 уточняющих вопроса)
3. "product_pitch"  — Презентация продукта (упомянул хотя бы 1 УТП: качество, сроки, цена, опыт)
4. "objection_handling" — Работа с возражениями (если возражения БЫЛИ — отработал; если не было — marked passed)
5. "closing"        — Закрытие (предложил следующий шаг: замер, КП, встреча, образец)
6. "contact_collection" — Сбор контактных данных (имя, телефон, email, компания)
7. "farewell"       — Прощание (поблагодарил, вежливо завершил)

Верни ТОЛЬКО валидный JSON-объект без лишних пояснений:
{
  "script_score": <число 0-100, общий балл — сумма весов пройденных пунктов>,
  "passed_items": [<список пройденных пунктов, напр. ["greeting", "closing"]>],
  "failed_items": [<список непройденных пунктов>],
  "details": {
    "greeting":            { "passed": true|false, "comment": "<что именно было/не было>", "quote": "<цитата>" },
    "needs_discovery":     { "passed": true|false, "questions_count": <число вопросов>, "comment": "<...>", "quote": "<...>" },
    "product_pitch":       { "passed": true|false, "usp_mentioned": [<упомянутые УТП>], "comment": "<...>" },
    "objection_handling":  { "passed": true|false, "had_objections": true|false, "objections": [<список>], "comment": "<...>" },
    "closing":             { "passed": true|false, "next_step": "<описание следующего шага>", "comment": "<...>" },
    "contact_collection":  { "passed": true|false, "collected": [<список собранных данных>], "comment": "<...>" },
    "farewell":            { "passed": true|false, "comment": "<...>" }
  },
  "recommendations": [
    "<Конкретная рекомендация 1 — что именно нужно улучшить>",
    "<Конкретная рекомендация 2>",
    "..."
  ]
}

ВЕСА ПУНКТОВ для расчёта script_score:
- greeting:           10 баллов
- needs_discovery:    20 баллов
- product_pitch:      20 баллов
- objection_handling: 15 баллов
- closing:            20 баллов
- contact_collection: 10 баллов
- farewell:            5 баллов

Рекомендации должны быть КОНКРЕТНЫМИ и ДЕЙСТВЕННЫМИ, не абстрактными.
`.trim();

module.exports = { SCRIPT_CHECK_PROMPT };


// ═══════════════════════════════════════════════════════════════════════════

module.exports = { SCRIPT_CHECK_PROMPT };
```

---

## `src/prompts/sentiment.js`

```js
'use strict';

// Промт: sentiment-анализ звонка
// ═══════════════════════════════════════════════════════════════════════════
// (в отдельный файл)

const SENTIMENT_PROMPT = `
Ты — эксперт по анализу тональности коммуникаций в продажах.
Тебе дан транскрипт звонка менеджера с клиентом типографии FLEX-N-ROLL PRO.

Определи тональность звонка и риски.

Верни ТОЛЬКО валидный JSON-объект:
{
  "overall_tone": "positive"|"neutral"|"negative",
  "client_tone":  "interest"|"skepticism"|"irritation"|"neutral",
  "manager_tone": "confident"|"uncertain"|"aggressive"|"friendly"|"neutral",
  "churn_risk":   "low"|"medium"|"high",
  "negative_moments": [
    {
      "timestamp": "<примерное время или описание момента>",
      "quote":     "<точная цитата из транскрипта>",
      "speaker":   "client"|"manager",
      "reason":    "<почему это негативный момент>"
    }
  ],
  "positive_moments": [
    {
      "quote":  "<точная цитата>",
      "reason": "<почему это позитивный момент>"
    }
  ],
  "summary": "<краткое резюме тональности звонка 2-3 предложения>",
  "churn_risk_reasons": [<причины оценки риска оттока>]
}

Критерии churn_risk:
- "low":    клиент заинтересован, нет явного негатива, есть договорённость
- "medium": есть сомнения или нерешённые возражения, но диалог продолжается
- "high":   явное раздражение, отказ, неудовлетворённость, нет следующего шага
`.trim();

module.exports = { SENTIMENT_PROMPT };


// ═══════════════════════════════════════════════════════════════════════════

module.exports = { SENTIMENT_PROMPT };
```

---

## `src/prompts/dataExtract.js`

```js
'use strict';

// FILE: src/prompts/dataExtract.js
// Промт: извлечение данных из звонка
// ═══════════════════════════════════════════════════════════════════════════

const DATA_EXTRACT_PROMPT = `
Ты — ассистент менеджера по продажам типографии FLEX-N-ROLL PRO.
Из транскрипта звонка извлеки структурированные данные для CRM.

Верни ТОЛЬКО валидный JSON-объект (пустые поля — пустая строка или пустой массив):
{
  "product": {
    "type":     "<тип продукта: этикетка, упаковка, стикер, пакет, плёнка, иное>",
    "material": "<материал: бумага, БОПП, ПЭТ, ПВД, ПНД, ...>",
    "size":     "<размер в мм или см, напр. '100x50 мм'>",
    "quantity": <тираж числом или 0 если не упоминался>,
    "colors":   "<число цветов или CMYK/Pantone>",
    "finish":   "<ламинация, лак, тиснение, высечка...>"
  },
  "deadline": "<дедлайн клиента строкой, напр. 'до 20 апреля' или ''>",
  "budget":   "<бюджет или диапазон строкой или ''>",
  "objections": [
    "<возражение 1 клиента дословно или коротко>",
    "<возражение 2>"
  ],
  "agreements": {
    "next_step":    "<следующий шаг: КП, замер, образец, встреча, ...>",
    "followup_date": "<дата следующего контакта строкой или ''>",
    "notes":         "<важные договорённости коротко>"
  },
  "contacts": {
    "name":    "<имя клиента>",
    "company": "<название компании>",
    "phone":   "<телефон>",
    "email":   "<email>"
  },
  "unanswered": [
    "<вопрос клиента, оставшийся без ответа>"
  ],
  "competitor_mentioned": "<упомянутый конкурент или ''>",
  "pain_points": [
    "<боль/проблема клиента, упомянутая в разговоре>"
  ]
}

Извлекай ТОЛЬКО то, что реально прозвучало в разговоре. Не придумывай данные.
Если что-то не упоминалось — оставь пустым.
`.trim();

module.exports = { DATA_EXTRACT_PROMPT };
```

---

## `src/utils/scorer.js`

```js
'use strict';

/**
 * scorer.js — Подсчёт итоговых баллов коммуникации
 *
 * Веса для итогового балла звонка:
 *  - Скрипт продаж:  60%
 *  - Sentiment / тональность: 25%
 *  - Штраф за высокий риск оттока: -15
 */

// ── Вспомогательные ────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, Math.round(v)));

/**
 * Перевести тональность в числовой балл.
 * @param {'positive'|'neutral'|'negative'} tone
 * @returns {number} 0-100
 */
function toneToScore(tone) {
  switch (tone) {
    case 'positive': return 90;
    case 'neutral':  return 65;
    case 'negative': return 25;
    default:         return 50;
  }
}

/**
 * Перевести риск оттока в штраф.
 * @param {'low'|'medium'|'high'} risk
 * @returns {number} штраф (0, -8, -15)
 */
function churnPenalty(risk) {
  switch (risk) {
    case 'high':   return 15;
    case 'medium': return 8;
    default:       return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  ИТОГОВЫЙ БАЛЛ ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Рассчитать итоговый балл звонка.
 *
 * @param {{ script_score: number, sentiment: object, extractedData: object }} params
 * @returns {number} 0-100
 */
function computeOverallScore({ script_score, sentiment, extractedData }) {
  // Базовые компоненты
  const scriptWeight    = 0.60;
  const sentimentWeight = 0.25;
  const dataWeight      = 0.15;

  // Балл скрипта
  const scriptComp = (script_score || 0) * scriptWeight;

  // Балл тональности
  const overallToneScore = toneToScore(sentiment?.overall_tone || 'neutral');
  const clientToneScore  = sentiment?.client_tone === 'interest' ? 90
    : sentiment?.client_tone === 'neutral'    ? 65
    : sentiment?.client_tone === 'skepticism' ? 45
    : 20; // irritation

  const sentimentComp = ((overallToneScore + clientToneScore) / 2) * sentimentWeight;

  // Балл полноты извлечённых данных (наличие ключевых полей)
  let dataScore = 0;
  if (extractedData) {
    if (extractedData.product?.type)            dataScore += 25;
    if (extractedData.product?.quantity > 0)    dataScore += 20;
    if (extractedData.agreements?.next_step)    dataScore += 25;
    if (extractedData.contacts?.name)           dataScore += 15;
    if (extractedData.deadline)                 dataScore += 15;
  }
  const dataComp = dataScore * dataWeight;

  // Штраф за риск оттока
  const penalty = churnPenalty(sentiment?.churn_risk || 'low');

  const raw = scriptComp + sentimentComp + dataComp - penalty;
  return clamp(raw, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────
//  ИТОГОВЫЙ БАЛЛ ЧАТА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Рассчитать итоговый балл переписки.
 *
 * @param {{ completeness_score, tone_score, spelling_score, response_time_score }} params
 * @returns {number} 0-100
 */
function computeChatScore({ completeness_score, tone_score, spelling_score, response_time_score }) {
  const weights = {
    completeness:    0.35,
    tone:            0.25,
    spelling:        0.15,
    response_time:   0.25,
  };

  const raw =
    (completeness_score  || 0) * weights.completeness  +
    (tone_score          || 0) * weights.tone          +
    (spelling_score      || 0) * weights.spelling      +
    (response_time_score || 0) * weights.response_time;

  return clamp(raw, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────
//  ЦВЕТОВОЙ ИНДИКАТОР
// ─────────────────────────────────────────────────────────────────────────

/**
 * Вернуть CSS-цвет и текстовую метку для балла.
 * @param {number} score  0-100
 * @returns {{ color: string, bg: string, label: string, emoji: string }}
 */
function scoreToIndicator(score) {
  if (score >= 85) return { color: '#1a7a4a', bg: '#d4edda', label: 'Отлично',       emoji: '🟢' };
  if (score >= 70) return { color: '#1a6a2e', bg: '#b8ddc8', label: 'Хорошо',        emoji: '🟢' };
  if (score >= 50) return { color: '#856404', bg: '#fff3cd', label: 'Удовлетворит.', emoji: '🟡' };
  if (score >= 30) return { color: '#721c24', bg: '#f8d7da', label: 'Слабо',         emoji: '🟠' };
  return               { color: '#491217', bg: '#f5c6cb', label: 'Критично',       emoji: '🔴' };
}

/**
 * Вернуть CSS-цвет для тональности.
 * @param {'positive'|'neutral'|'negative'} tone
 */
function toneToColor(tone) {
  switch (tone) {
    case 'positive': return { color: '#155724', bg: '#d4edda', text: 'Позитивный' };
    case 'negative': return { color: '#721c24', bg: '#f8d7da', text: 'Негативный' };
    default:         return { color: '#383d41', bg: '#e2e3e5', text: 'Нейтральный' };
  }
}

/**
 * Вернуть CSS-цвет для риска оттока.
 * @param {'low'|'medium'|'high'} risk
 */
function riskToColor(risk) {
  switch (risk) {
    case 'high':   return { color: '#721c24', bg: '#f8d7da', text: 'Высокий'   };
    case 'medium': return { color: '#856404', bg: '#fff3cd', text: 'Средний'   };
    default:       return { color: '#155724', bg: '#d4edda', text: 'Низкий'    };
  }
}

module.exports = {
  computeOverallScore,
  computeChatScore,
  scoreToIndicator,
  toneToColor,
  riskToColor,
  toneToScore,
};
```

---

## `src/utils/reporter.js`

```js
'use strict';

/**
 * reporter.js — Генерация HTML-карточки оценки коммуникации
 *
 * Карточка содержит:
 *  - Шапка: дата, менеджер, клиент, тип коммуникации
 *  - Общий балл с цветовым индикатором
 *  - Детальные оценки по каждому критерию
 *  - Цитаты из разговора
 *  - Рекомендации по улучшению
 *
 * Готовая карточка сохраняется как комментарий к сделке через
 * crm.timeline.comment.add
 */

const dayjs  = require('dayjs');
const scorer = require('./scorer');

// ── Утилиты HTML ───────────────────────────────────────────────────────────
const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// ── Пункты скрипта: человеческие названия ─────────────────────────────────
const SCRIPT_ITEMS = {
  greeting:            'Приветствие и представление',
  needs_discovery:     'Выявление потребности (3+ вопросов)',
  product_pitch:       'Презентация продукта / УТП',
  objection_handling:  'Работа с возражениями',
  closing:             'Закрытие (следующий шаг)',
  contact_collection:  'Сбор контактных данных',
  farewell:            'Прощание',
};

const SCRIPT_WEIGHTS = {
  greeting:           10,
  needs_discovery:    20,
  product_pitch:      20,
  objection_handling: 15,
  closing:            20,
  contact_collection: 10,
  farewell:            5,
};

// ─────────────────────────────────────────────────────────────────────────
//  СТРОИТЕЛИ СЕКЦИЙ HTML
// ─────────────────────────────────────────────────────────────────────────

function buildHeaderSection({ date, manager, client, type, dealId }) {
  const typeLabel = type === 'call' ? '📞 Звонок' : '💬 Переписка';
  const dateStr   = dayjs(date).format('DD.MM.YYYY HH:mm');

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;border-radius:8px 8px 0 0;margin-bottom:0;">
  <tr>
    <td style="padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
              FLEX-N-ROLL PRO — Анализ коммуникации
            </div>
            <div style="font-size:18px;color:#ffffff;font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">
              ${esc(typeLabel)} — Сделка #${esc(dealId)}
            </div>
          </td>
          <td align="right" valign="top">
            <div style="font-size:12px;color:#93b4d4;font-family:Arial,sans-serif;">${esc(dateStr)}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:12px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:24px;">
                  <span style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;">МЕНЕДЖЕР</span><br>
                  <span style="font-size:14px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">${esc(manager)}</span>
                </td>
                <td>
                  <span style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;">КЛИЕНТ</span><br>
                  <span style="font-size:14px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">${esc(client)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function buildScoreBadge(score) {
  const ind = scorer.scoreToIndicator(score);
  const pct = score;

  // Прогресс-бар
  const barColor = score >= 70 ? '#28a745' : score >= 50 ? '#ffc107' : '#dc3545';

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-bottom:1px solid #dee2e6;">
  <tr>
    <td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="120" align="center" valign="middle">
            <div style="width:90px;height:90px;border-radius:50%;background:${ind.bg};border:4px solid ${ind.color};display:inline-flex;align-items:center;justify-content:center;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:${ind.color};font-family:Arial,sans-serif;line-height:1;">${pct}</div>
            </div>
            <div style="font-size:12px;color:${ind.color};font-family:Arial,sans-serif;font-weight:700;text-align:center;margin-top:4px;">${ind.label}</div>
          </td>
          <td style="padding-left:20px;vertical-align:middle;">
            <div style="font-size:13px;color:#495057;font-family:Arial,sans-serif;margin-bottom:8px;font-weight:600;">ОБЩИЙ БАЛЛ КОММУНИКАЦИИ</div>
            <div style="background:#e9ecef;border-radius:4px;height:12px;overflow:hidden;width:100%;">
              <div style="background:${barColor};height:12px;width:${pct}%;border-radius:4px;"></div>
            </div>
            <div style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;margin-top:6px;">${pct} из 100 баллов</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function buildScriptSection(script) {
  if (!script) return '';

  const allItems = Object.keys(SCRIPT_ITEMS);
  const rows = allItems.map(key => {
    const passed  = script.passed_items?.includes(key);
    const detail  = script.details?.[key] || {};
    const weight  = SCRIPT_WEIGHTS[key];
    const icon    = passed ? '✅' : '❌';
    const bgColor = passed ? '#f0fff4' : '#fff5f5';
    const bdColor = passed ? '#c3e6cb' : '#f5c6cb';

    let extra = '';
    if (detail.quote) {
      extra += `<div style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-style:italic;margin-top:3px;padding-left:8px;border-left:2px solid #dee2e6;">«${esc(detail.quote)}»</div>`;
    }
    if (detail.comment) {
      extra += `<div style="font-size:11px;color:#495057;font-family:Arial,sans-serif;margin-top:3px;">${esc(detail.comment)}</div>`;
    }

    return `
<tr>
  <td style="padding:8px 12px;background:${bgColor};border-left:3px solid ${bdColor};border-bottom:1px solid #f1f3f5;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="font-size:14px;margin-right:6px;">${icon}</span>
          <span style="font-size:13px;font-weight:600;color:#343a40;font-family:Arial,sans-serif;">${esc(SCRIPT_ITEMS[key])}</span>
          ${extra}
        </td>
        <td align="right" valign="top" nowrap>
          <span style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;">${weight} баллов</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`.trim();
  });

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    Проверка скрипта продаж — ${script.script_score || 0}/100
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #dee2e6;">
    ${rows.join('\n')}
  </table>
</div>`.trim();
}

function buildSentimentSection(sentiment) {
  if (!sentiment) return '';

  const toneInd  = scorer.toneToColor(sentiment.overall_tone);
  const riskInd  = scorer.riskToColor(sentiment.churn_risk);

  const negMoments = (sentiment.negative_moments || []).slice(0, 3).map(m => `
<tr>
  <td style="padding:6px 10px;border-bottom:1px solid #f1f3f5;">
    <div style="font-size:11px;color:#721c24;font-family:Arial,sans-serif;font-style:italic;">«${esc(m.quote)}»</div>
    <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;margin-top:2px;">${esc(m.reason)}</div>
  </td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    Тональность и риски
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:${toneInd.bg};border:1px solid ${toneInd.color}33;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:${toneInd.color};font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Тон звонка</div>
          <div style="font-size:16px;color:${toneInd.color};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${esc(toneInd.text)}</div>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:${riskInd.bg};border:1px solid ${riskInd.color}33;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:${riskInd.color};font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Риск оттока</div>
          <div style="font-size:16px;color:${riskInd.color};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${esc(riskInd.text)}</div>
        </div>
      </td>
    </tr>
  </table>

  ${sentiment.summary ? `<div style="font-size:12px;color:#495057;font-family:Arial,sans-serif;font-style:italic;background:#f8f9fa;border-left:3px solid #6c757d;padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;">${esc(sentiment.summary)}</div>` : ''}

  ${negMoments ? `
  <div style="font-size:12px;font-weight:600;color:#721c24;font-family:Arial,sans-serif;margin-bottom:6px;">⚠ Негативные моменты</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f5c6cb;border-radius:6px;overflow:hidden;margin-bottom:12px;">
    ${negMoments}
  </table>` : ''}
</div>`.trim();
}

function buildRecommendationsSection(recommendations) {
  if (!recommendations?.length) return '';

  const items = recommendations.map((r, i) => `
<tr>
  <td style="padding:7px 12px;border-bottom:1px solid #e9ecef;">
    <span style="font-size:13px;color:#0c5460;font-family:Arial,sans-serif;">
      <strong>${i + 1}.</strong> ${esc(r)}
    </span>
  </td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    💡 Рекомендации по улучшению
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#d1ecf1;border:1px solid #bee5eb;border-radius:6px;overflow:hidden;">
    ${items}
  </table>
</div>`.trim();
}

function buildExtractedDataSection(extracted) {
  if (!extracted) return '';

  const product = extracted.product || {};
  const agreements = extracted.agreements || {};
  const contacts   = extracted.contacts   || {};

  const rows = [];

  if (product.type)        rows.push(['Тип продукта',   product.type]);
  if (product.material)    rows.push(['Материал',        product.material]);
  if (product.size)        rows.push(['Размер',          product.size]);
  if (product.quantity)    rows.push(['Тираж',           product.quantity + ' шт.']);
  if (extracted.deadline)  rows.push(['Дедлайн',         extracted.deadline]);
  if (extracted.budget)    rows.push(['Бюджет',          extracted.budget]);
  if (agreements.next_step)rows.push(['Следующий шаг',   agreements.next_step]);
  if (agreements.followup_date) rows.push(['Дата followup', agreements.followup_date]);
  if (contacts.name)       rows.push(['Контакт',         contacts.name]);
  if (contacts.phone)      rows.push(['Телефон',         contacts.phone]);

  if (!rows.length) return '';

  const cells = rows.map(([k, v]) => `
<tr>
  <td style="padding:6px 12px;background:#f8f9fa;font-size:11px;font-weight:600;color:#6c757d;font-family:Arial,sans-serif;width:35%;border-bottom:1px solid #e9ecef;">${esc(k)}</td>
  <td style="padding:6px 12px;font-size:12px;color:#343a40;font-family:Arial,sans-serif;border-bottom:1px solid #e9ecef;">${esc(v)}</td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    📋 Извлечённые данные
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dee2e6;border-radius:6px;overflow:hidden;">
    ${cells}
  </table>
</div>`.trim();
}

function buildChatMetricsSection(analysis) {
  if (!analysis.first_response_minutes && !analysis.avg_response_minutes) return '';

  const frm = analysis.first_response_minutes;
  const arm = analysis.avg_response_minutes;

  const frmColor = frm === null ? '#6c757d'
    : frm <= 5 ? '#155724' : frm <= 30 ? '#856404' : '#721c24';

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    ⏱ Скорость ответов
  </div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Первый ответ</div>
          <div style="font-size:20px;color:${frmColor};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${frm !== null ? frm + ' мин' : '—'}</div>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Среднее время ответа</div>
          <div style="font-size:20px;color:#343a40;font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${arm !== null ? arm + ' мин' : '—'}</div>
        </div>
      </td>
    </tr>
  </table>
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД: buildCard
// ─────────────────────────────────────────────────────────────────────────

/**
 * Построить HTML-карточку коммуникации.
 *
 * @param {{
 *   dealId: string,
 *   date: string,
 *   manager: string,
 *   client: string,
 *   type: 'call'|'chat',
 *   analysis: object
 * }} params
 * @returns {{ html: string, score: number }}
 */
function buildCard({ dealId, date, manager, client, type, analysis }) {
  const score = analysis.overall_score || 0;

  // Собираем все рекомендации в одно место
  const allRecs = [
    ...(analysis.script?.recommendations || []),
    ...(analysis.recommendations         || []),
  ].filter(Boolean);

  const sections = [
    buildHeaderSection({ date, manager, client, type, dealId }),
    buildScoreBadge(score),
    type === 'call'
      ? buildScriptSection(analysis.script)
      : buildChatMetricsSection(analysis),
    buildSentimentSection(type === 'call' ? analysis.sentiment : {
      overall_tone: analysis.client_sentiment === 'positive' ? 'positive'
        : analysis.client_sentiment === 'negative' ? 'negative' : 'neutral',
      churn_risk:   analysis.churn_risk || 'low',
      summary:      analysis.summary   || '',
      negative_moments: [],
    }),
    type === 'call' ? buildExtractedDataSection(analysis.extracted) : '',
    buildRecommendationsSection(allRecs),
  ];

  const body = sections.filter(Boolean).join('\n');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  ${body}
  <div style="padding:12px 20px;background:#f8f9fa;border-top:1px solid #dee2e6;text-align:right;">
    <span style="font-size:10px;color:#adb5bd;font-family:Arial,sans-serif;">
      Сгенерировано FLEX-N-ROLL AI CommAnalysis · ${dayjs().format('DD.MM.YYYY HH:mm')}
    </span>
  </div>
</div>`.trim();

  return { html, score };
}

module.exports = { buildCard };
```

---

## `scheduler/dailyBatch.js`

```js
'use strict';

/**
 * dailyBatch.js — Ежедневная ночная обработка записей звонков
 *
 * Запуск:
 *   node scheduler/dailyBatch.js          — однократный запуск (прошлый день)
 *   node scheduler/dailyBatch.js --cron   — режим cron (каждую ночь в 02:00)
 *   node scheduler/dailyBatch.js --date 2024-03-15  — конкретная дата
 *
 * Что делает:
 *  1. Получает список звонков с записями за предыдущий день из Б24
 *  2. Для каждого звонка: Whisper → callAnalyzer → reporter → Б24 комментарий
 *  3. Формирует сводный отчёт и отправляет руководителю
 */

const cron   = require('node-cron');
const dayjs  = require('dayjs');
const config = require('../config');
const logger = require('../src/utils/logger');

const whisperService = require('../src/services/whisper');
const callAnalyzer   = require('../src/services/callAnalyzer');
const bitrix         = require('../src/services/bitrix');
const reporter       = require('../src/utils/reporter');

// ── Параметры запуска ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CRON_MODE = args.includes('--cron');
const DATE_IDX  = args.indexOf('--date');
const TARGET_DATE = DATE_IDX >= 0 ? args[DATE_IDX + 1] : null;

// ─────────────────────────────────────────────────────────────────────────
//  ОБРАБОТКА ОДНОГО ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CallBatchResult
 * @property {string}  callId
 * @property {string}  dealId
 * @property {'ok'|'skip'|'error'} status
 * @property {number}  [score]
 * @property {string}  [error]
 */

/**
 * Обработать один звонок в batch-режиме.
 * @param {{ CALL_ID, RECORD_URL, CALL_START_DATE, PORTAL_USER_ID, CRM_ENTITY_ID }} callInfo
 * @param {{ language?: string }} opts
 * @returns {Promise<CallBatchResult>}
 */
async function processCall(callInfo, opts = {}) {
  const { CALL_ID: callId, CRM_ENTITY_ID: dealId, RECORD_URL: recordUrl } = callInfo;
  const lang = opts.language || config.audio.defaultLang;

  logger.info(`[batch] Обрабатываем callId=${callId} dealId=${dealId}`);

  try {
    if (!recordUrl) {
      logger.warn(`[batch] callId=${callId} — нет записи, пропускаем`);
      return { callId, dealId, status: 'skip', error: 'Нет URL записи' };
    }

    // 1. Транскрибация
    logger.info(`[batch] Транскрибация callId=${callId}...`);
    const transcript = await whisperService.transcribeFromBitrix(recordUrl, {
      language: lang,
      dealId,
    });

    if (!transcript.text || transcript.text.trim().length < 20) {
      logger.warn(`[batch] callId=${callId} — транскрипт пустой, пропускаем`);
      return { callId, dealId, status: 'skip', error: 'Пустой транскрипт' };
    }

    // 2. GPT-анализ
    logger.info(`[batch] Анализ callId=${callId}...`);
    const analysis = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo,
    });

    // 3. Получить имя менеджера и клиента
    const [managerInfo, contactInfo] = await Promise.allSettled([
      bitrix.getUserById(callInfo.PORTAL_USER_ID),
      bitrix.getContactByDealId(dealId),
    ]);

    const managerName = managerInfo.value?.NAME
      || managerInfo.value?.LAST_NAME
      || `ID:${callInfo.PORTAL_USER_ID}`;
    const clientName  = contactInfo.value?.NAME
      || contactInfo.value?.LAST_NAME
      || `Сделка #${dealId}`;

    // 4. Построить HTML-карточку
    const card = reporter.buildCard({
      dealId,
      date:    callInfo.CALL_START_DATE || new Date().toISOString(),
      manager: managerName,
      client:  clientName,
      type:    'call',
      analysis,
    });

    // 5. Сохранить карточку как комментарий к сделке
    await bitrix.addTimelineComment(dealId, card.html);

    // 6. Обновить поля сделки
    await bitrix.updateDealFields(dealId, {
      UF_CALL_SCORE: analysis.overall_score,
      UF_SENTIMENT:  analysis.sentiment?.overall_tone || '',
      UF_CHURN_RISK: analysis.sentiment?.churn_risk   || '',
    });

    logger.info(`[batch] callId=${callId} готово. score=${analysis.overall_score}`);
    return {
      callId,
      dealId,
      status:    'ok',
      score:     analysis.overall_score,
      manager:   managerName,
      client:    clientName,
      sentiment: analysis.sentiment?.overall_tone,
      churnRisk: analysis.sentiment?.churn_risk,
    };

  } catch (err) {
    logger.error(`[batch] callId=${callId} ОШИБКА: ${err.message}`);
    return { callId, dealId, status: 'error', error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  СВОДНЫЙ HTML-ОТЧЁТ ДЛЯ РУКОВОДИТЕЛЯ
// ─────────────────────────────────────────────────────────────────────────

function buildSummaryReport({ results, dateStr, totalCalls, okCount, errorCount, skipCount }) {
  const avgScore = okCount > 0
    ? Math.round(results.filter(r => r.status === 'ok').reduce((s, r) => s + (r.score || 0), 0) / okCount)
    : 0;

  const scoreColor = avgScore >= 70 ? '#155724' : avgScore >= 50 ? '#856404' : '#721c24';
  const scoreBg    = avgScore >= 70 ? '#d4edda' : avgScore >= 50 ? '#fff3cd' : '#f8d7da';

  // Таблица результатов
  const rows = results.map(r => {
    const statusColor = r.status === 'ok' ? '#155724' : r.status === 'skip' ? '#383d41' : '#721c24';
    const statusBg    = r.status === 'ok' ? '#d4edda' : r.status === 'skip' ? '#e2e3e5' : '#f8d7da';
    const statusText  = r.status === 'ok' ? '✅ Обработан' : r.status === 'skip' ? '⏭ Пропущен' : '❌ Ошибка';
    const scoreCell   = r.score != null ? `${r.score}/100` : r.error || '—';

    return `
<tr>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.dealId || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.manager || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.client || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;text-align:center;">
    <span style="font-size:11px;color:${statusColor};background:${statusBg};padding:2px 8px;border-radius:12px;">${statusText}</span>
  </td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;text-align:center;font-size:12px;font-weight:600;font-family:Arial,sans-serif;color:${statusColor};">${scoreCell}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#6c757d;">${r.churnRisk === 'high' ? '🔴 Высокий' : r.churnRisk === 'medium' ? '🟡 Средний' : r.churnRisk === 'low' ? '🟢 Низкий' : '—'}</td>
</tr>`.trim();
  }).join('\n');

  return `
<div style="font-family:Arial,sans-serif;max-width:760px;border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;">
  
  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;">
    <tr>
      <td style="padding:18px 22px;">
        <div style="font-size:11px;color:#93b4d4;letter-spacing:1px;text-transform:uppercase;">FLEX-N-ROLL PRO</div>
        <div style="font-size:20px;color:#fff;font-weight:700;margin-top:4px;">Сводный отчёт по звонкам</div>
        <div style="font-size:13px;color:#93b4d4;margin-top:4px;">За ${dateStr}</div>
      </td>
    </tr>
  </table>

  <!-- KPI ROW -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-bottom:1px solid #dee2e6;">
    <tr>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Всего звонков</div>
        <div style="font-size:28px;font-weight:800;color:#1e3a5f;">${totalCalls}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Обработано</div>
        <div style="font-size:28px;font-weight:800;color:#155724;">${okCount}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Средний балл</div>
        <div style="font-size:28px;font-weight:800;color:${scoreColor};background:${scoreBg};border-radius:50%;width:56px;height:56px;line-height:56px;margin:0 auto;">${avgScore}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Риск оттока (high)</div>
        <div style="font-size:28px;font-weight:800;color:#721c24;">${results.filter(r => r.churnRisk === 'high').length}</div>
      </td>
      <td style="padding:16px;text-align:center;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Ошибки</div>
        <div style="font-size:28px;font-weight:800;color:#6c757d;">${errorCount}</div>
      </td>
    </tr>
  </table>

  <!-- TABLE -->
  <div style="padding:16px 20px;">
    <div style="font-size:13px;font-weight:700;color:#343a40;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">
      Детали по каждому звонку
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dee2e6;border-radius:6px;overflow:hidden;">
      <tr style="background:#f8f9fa;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Сделка</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Менеджер</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Клиент</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Статус</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Балл</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Риск оттока</th>
      </tr>
      ${rows}
    </table>
  </div>

  <!-- FOOTER -->
  <div style="padding:10px 20px;background:#f8f9fa;border-top:1px solid #dee2e6;text-align:right;">
    <span style="font-size:10px;color:#adb5bd;">
      FLEX-N-ROLL AI CommAnalysis · batch ${new Date().toISOString()}
    </span>
  </div>
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНАЯ ФУНКЦИЯ BATCH-ОБРАБОТКИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Запустить batch-обработку за конкретную дату.
 * @param {string} [targetDate]  — 'YYYY-MM-DD', по умолчанию вчера
 */
async function runDailyBatch(targetDate) {
  const date    = targetDate ? dayjs(targetDate) : dayjs().subtract(1, 'day');
  const dateStr = date.format('DD.MM.YYYY');
  const dateFrom = date.startOf('day').toISOString();
  const dateTo   = date.endOf('day').toISOString();

  logger.info(`[batch] ==========================================`);
  logger.info(`[batch] Запуск batch-обработки за ${dateStr}`);
  logger.info(`[batch] ==========================================`);

  let calls = [];
  try {
    calls = await bitrix.getCallsForDay(dateFrom, dateTo);
  } catch (err) {
    logger.error(`[batch] Ошибка получения звонков из Б24: ${err.message}`);
    return;
  }

  logger.info(`[batch] Найдено ${calls.length} звонков с записями за ${dateStr}`);

  if (calls.length === 0) {
    logger.info('[batch] Нет звонков для обработки, выходим');
    return;
  }

  // Обработать каждый звонок последовательно (избегаем rate limit OpenAI)
  const results = [];
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    logger.info(`[batch] ${i + 1}/${calls.length} callId=${call.CALL_ID}`);

    const result = await processCall(call);
    results.push(result);

    // Пауза между запросами (rate limit: ~3 RPM на GPT-4)
    if (i < calls.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ── Статистика ──────────────────────────────────────────────────────────
  const okCount    = results.filter(r => r.status === 'ok').length;
  const skipCount  = results.filter(r => r.status === 'skip').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const avgScore   = okCount > 0
    ? Math.round(results.filter(r => r.status === 'ok').reduce((s, r) => s + (r.score || 0), 0) / okCount)
    : 0;
  const highRiskCount = results.filter(r => r.churnRisk === 'high').length;

  logger.info(`[batch] Результаты: OK=${okCount} SKIP=${skipCount} ERR=${errorCount} AVG_SCORE=${avgScore}`);

  // ── Сводный отчёт руководителю ──────────────────────────────────────────
  const summaryHtml = buildSummaryReport({
    results,
    dateStr,
    totalCalls:  calls.length,
    okCount,
    errorCount,
    skipCount,
  });

  // Текстовое уведомление + HTML-отчёт
  const notifText =
    `📊 Отчёт AI-анализа звонков за ${dateStr}\n` +
    `Всего: ${calls.length} | Обработано: ${okCount} | Средний балл: ${avgScore}/100\n` +
    `🔴 Высокий риск оттока: ${highRiskCount} клиентов\n` +
    `Подробный отчёт добавлен в комментарии к каждой сделке.`;

  try {
    // Уведомление в Б24
    await bitrix.sendNotification(config.reports.managerUserId, notifText);

    // HTML-отчёт как задача руководителю
    const tomorrow = dayjs().add(1, 'day').endOf('day').toISOString();
    await bitrix.createTask(
      config.reports.managerUserId,
      `AI-отчёт по звонкам за ${dateStr}: ${okCount} обработано, средний балл ${avgScore}`,
      summaryHtml,
      tomorrow
    );

    logger.info(`[batch] Сводный отчёт отправлен руководителю (userId=${config.reports.managerUserId})`);
  } catch (err) {
    logger.error(`[batch] Не удалось отправить отчёт: ${err.message}`);
  }

  logger.info(`[batch] ==========================================`);
  logger.info(`[batch] Batch завершён за ${dateStr}`);
  logger.info(`[batch] ==========================================`);

  return { okCount, skipCount, errorCount, avgScore, highRiskCount };
}

// ─────────────────────────────────────────────────────────────────────────
//  CRON / ЗАПУСК
// ─────────────────────────────────────────────────────────────────────────

if (CRON_MODE) {
  // Ежедневно в 02:00 по серверному времени (Минск: UTC+3)
  logger.info('[batch] Запущен в режиме cron. Расписание: 02:00 каждую ночь');
  cron.schedule('0 2 * * *', () => {
    logger.info('[batch] Cron-триггер: запускаем ночную обработку');
    runDailyBatch().catch(err => {
      logger.error(`[batch] Cron ошибка: ${err.message}`);
    });
  }, {
    scheduled: true,
    timezone: 'Europe/Minsk',
  });
} else {
  // Однократный запуск
  const targetDate = TARGET_DATE || null;
  runDailyBatch(targetDate)
    .then(stats => {
      if (stats) {
        logger.info(`[batch] Готово. OK=${stats.okCount} ERR=${stats.errorCount} AVG=${stats.avgScore}`);
      }
      process.exit(0);
    })
    .catch(err => {
      logger.error(`[batch] Критическая ошибка: ${err.message}`);
      process.exit(1);
    });
}
```

---

## `README.md`

# FLEX-N-ROLL PRO — AI Анализ коммуникаций

Система автоматического AI-анализа звонков и переписки отдела продаж типографии **FLEX-N-ROLL PRO**.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Сервер    | Node.js 18+ / Express 4 |
| AI транскрибация | OpenAI Whisper API (`whisper-1`) |
| AI анализ | OpenAI GPT-4o |
| CRM       | Битрикс24 REST API |
| Планировщик | node-cron |
| Логирование | Winston |
| Аудио-обработка | ffmpeg |

---

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать и заполнить .env
cp .env.example .env
nano .env

# 3. Запустить API-сервер
npm start          # production
npm run dev        # с автоперезагрузкой

# 4. Запустить ночную обработку вручную
node scheduler/dailyBatch.js

# 5. Запустить в режиме cron (02:00 каждую ночь)
node scheduler/dailyBatch.js --cron

# 6. Обработать конкретную дату
node scheduler/dailyBatch.js --date 2024-03-15
```

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|-----------|:---:|---------|
| `OPENAI_API_KEY` | ✅ | Ключ OpenAI |
| `BITRIX24_WEBHOOK_URL` | ✅ | Webhook с правами CRM + Телефония |
| `PORT` | — | Порт API-сервера (по умолчанию 3000) |
| `GPT_MODEL` | — | Модель GPT (по умолчанию `gpt-4o`) |
| `DEFAULT_LANGUAGE` | — | Язык транскрибации `ru` / `be` |
| `REPORT_MANAGER_USER_ID` | — | ID руководителя в Б24 |
| `WHISPER_CHUNK_SIZE_MB` | — | Размер чанка аудио (по умолчанию 24 MB) |

---

## API Endpoints

### `POST /api/calls/analyze-by-deal`
Полный цикл анализа звонка по ID сделки в Б24.

**Тело запроса:**
```json
{
  "dealId": "12345",
  "language": "ru"
}
```

**Ответ:**
```json
{
  "success": true,
  "dealId": "12345",
  "analysis": {
    "overall_score": 78,
    "script": { "script_score": 80, "passed_items": [...], "failed_items": [...] },
    "sentiment": { "overall_tone": "positive", "churn_risk": "low" },
    "extracted": { "product": {...}, "deadline": "...", "agreements": {...} }
  }
}
```

---

### `POST /api/calls/analyze-upload`
Загрузка аудиофайла напрямую (без Б24-записи). Multipart/form-data.

**Поля:**
- `audio` — файл (mp3, mp4, m4a, wav, ogg, webm, flac)
- `dealId` — ID сделки (опционально)
- `managerId` — ID менеджера
- `clientName` — имя клиента
- `language` — `ru` | `be`

---

### `POST /api/chats/analyze`
Анализ переписки.

**Тело запроса:**
```json
{
  "dealId": "12345",
  "messages": [
    { "role": "client",  "text": "...", "timestamp": "2024-03-15T10:00:00Z" },
    { "role": "manager", "text": "...", "timestamp": "2024-03-15T10:05:00Z" }
  ]
}
```
Если `messages` не передан — сообщения загружаются автоматически из Б24 CRM.

---

### `POST /api/webhook/bitrix`
Обработчик событий Б24. Настройте в Б24: **Настройки → Входящие вебхуки**.

Поддерживаемые события:
- `ONVOXIMPLANTCALLEND` — автоматическая транскрибация после завершения звонка

---

## Структура проекта

```
flex-n-roll-commanalysis/
├── src/
│   ├── server.js              # Express API + webhook
│   ├── services/
│   │   ├── whisper.js         # Транскрибация (Whisper API + чанкование)
│   │   ├── callAnalyzer.js    # Проверка скрипта + sentiment + извлечение данных
│   │   ├── chatAnalyzer.js    # Анализ переписки
│   │   └── bitrix.js          # Битрикс24 REST клиент
│   ├── prompts/
│   │   ├── scriptCheck.js     # Промт: 7 пунктов скрипта продаж
│   │   ├── sentiment.js       # Промт: тональность и риски
│   │   └── dataExtract.js     # Промт: извлечение CRM-данных
│   └── utils/
│       ├── scorer.js          # Расчёт итоговых баллов
│       ├── reporter.js        # HTML-карточка оценки
│       └── logger.js          # Winston logger
├── scheduler/
│   └── dailyBatch.js          # Ночная batch-обработка + отчёт руководителю
├── config.js                  # Конфигурация из .env
├── package.json
├── .env.example
└── README.md
```

---

## Поля Битрикс24

Создайте пользовательские поля в разделе **CRM → Сделки → Пользовательские поля**:

| Код поля | Тип | Назначение |
|---------|-----|-----------|
| `UF_TRANSCRIPT` | Строка (большая) | Транскрипт звонка |
| `UF_CALL_SCORE` | Число | Балл звонка (0-100) |
| `UF_SENTIMENT` | Строка | Тональность звонка |
| `UF_CHURN_RISK` | Строка | Риск оттока |
| `UF_PRODUCT_TYPE` | Строка | Тип продукта из звонка |
| `UF_PRODUCT_MATERIAL` | Строка | Материал |
| `UF_PRINT_QUANTITY` | Строка | Тираж |
| `UF_CLIENT_DEADLINE` | Строка | Дедлайн клиента |
| `UF_NEXT_STEP` | Строка | Следующий шаг |
| `UF_OBJECTIONS` | Строка | Возражения клиента |

---

## Webhook в Битрикс24

1. **Б24 → Разработчикам → Другое → Входящие вебхуки**
2. Добавить вебхук, выбрать права: `CRM`, `Телефония`, `Пользователи`, `IM`
3. Скопировать URL в `.env` → `BITRIX24_WEBHOOK_URL`
4. Для автообработки после звонков: **Б24 → Маркетплейс → Вебхуки → Исходящий вебхук**:
   - Событие: `ONVOXIMPLANTCALLEND`
   - URL обработчика: `https://your-server.com/api/webhook/bitrix`

---

## Что анализируется в звонке

### Проверка скрипта продаж (7 пунктов)

| Пункт | Вес |
|-------|-----|
| Приветствие и представление | 10 |
| Выявление потребности (3+ вопроса) | 20 |
| Презентация продукта / УТП | 20 |
| Работа с возражениями | 15 |
| Закрытие (следующий шаг) | 20 |
| Сбор контактных данных | 10 |
| Прощание | 5 |

### Итоговый балл звонка

```
Итог = Скрипт × 60% + Sentiment × 25% + Полнота данных × 15% − Штраф_оттока
```

### Итоговый балл переписки

```
Итог = Полнота ответов × 35% + Тональность × 25% + Скорость ответа × 25% + Орфография × 15%
```

---

## Интерпретация баллов

| Балл | Оценка |
|------|--------|
| 85-100 | 🟢 Отлично |
| 70-84 | 🟢 Хорошо |
| 50-69 | 🟡 Удовлетворительно |
| 30-49 | 🟠 Слабо |
| 0-29 | 🔴 Критично |

---

## Требования к записям звонков

- Форматы: MP3, MP4, M4A, WAV, OGG, WebM, FLAC
- Максимальный размер: без ограничений (автоматическое чанкование при >25 MB)
- Рекомендуемое качество: 16 kHz моно (система конвертирует автоматически через ffmpeg)
- Минимальная длительность транскрипта для анализа: 20 символов (~5 секунд)

---

## Лицензия

MIT © FLEX-N-ROLL PRO

---

*Код сгенерирован для FLEX-N-ROLL PRO, типография гибкой упаковки и этикетки.*

---

## МОДУЛЬ ДОП — МАРКИРОВКА ЧЕСТНЫЙ ЗНАК (Node.js + ГИС МТ API)

> **Промт для Claude Code CLI:**  
> "Создай Node.js проект `flex-n-roll-marking` по следующей структуре. Создай все файлы с полным кодом."

# Модуль Честный ЗНАК — FLEX-N-ROLL PRO

> **Production-ready** модуль интеграции CRM Битрикс24 с системой маркировки «Честный ЗНАК» для типографии FLEX-N-ROLL PRO.
> Стек: Node.js · Express · axios · Битрикс24 REST API · ГИС МТ API (api.mdlp.crpt.ru)

---

## `package.json`

```json
{
  "name": "flex-n-roll-marking",
  "version": "1.0.0",
  "description": "Модуль интеграции Битрикс24 с системой маркировки «Честный ЗНАК» для типографии FLEX-N-ROLL PRO",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "lint": "eslint src/**/*.js"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-validator": "^7.1.0",
    "form-data": "^4.0.0",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "qrcode": "^1.5.3",
    "unzipper": "^0.12.3",
    "winston": "^3.13.0",
    "xml2js": "^0.6.2"
  },
  "devDependencies": {
    "eslint": "^9.3.0",
    "nodemon": "^3.1.2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "UNLICENSED"
}
```

---

## `.env.example`

```bash
# ====================================================
# FLEX-N-ROLL PRO — Модуль Честный ЗНАК
# Скопируйте в .env и заполните реальными значениями
# ====================================================

# Сервер
PORT=3000
NODE_ENV=production

# ---- Честный ЗНАК / ГИС МТ ----
# OAuth2 client_credentials для ГИС МТ
MDLP_CLIENT_ID=your_client_id_here
MDLP_CLIENT_SECRET=your_client_secret_here
MDLP_BASE_URL=https://api.mdlp.crpt.ru
MDLP_TOKEN_URL=https://api.mdlp.crpt.ru/api/v3/true-api/auth/token
# ИНН участника оборота товаров (партнёр ЧЗ)
MDLP_PARTICIPANT_INN=your_inn_here
# GTIN вашей продукции (через запятую, если несколько)
MDLP_DEFAULT_GTIN=your_gtin_here

# ---- Битрикс24 ----
BITRIX_WEBHOOK_URL=https://your-company.bitrix24.ru/rest/1/your_webhook_token
BITRIX_PORTAL_URL=https://your-company.bitrix24.ru

# Идентификаторы стадий воронки (из CRM → Настройки → Воронки)
BITRIX_STAGE_PRODUCTION=C3:NEW
BITRIX_STAGE_SHIPMENT=C3:WON
BITRIX_STAGE_MARKING_DONE=C3:PREPARATION

# Ответственный оператор маркировки (ID пользователя в Б24)
BITRIX_OPERATOR_USER_ID=1

# ---- Хранилище ----
# Директория для CSV-файлов печати и БД кодов
DATA_DIR=/home/user/workspace/flex-n-roll-marking/data
PRODUCTION_DIR=/home/user/workspace/flex-n-roll-marking/data/production/orders

# Путь к JSON-«базе» кодов (simple file-based store)
CODES_DB_PATH=/home/user/workspace/flex-n-roll-marking/data/codes_db.json

# ---- Безопасность ----
# Секрет для проверки подписи вебхуков от Б24
WEBHOOK_SECRET=your_webhook_secret_here
```

---

## `config.js`

```js
'use strict';

require('dotenv').config();
const path = require('path');

// ---------------------------------------------------------------------------
// Валидация обязательных переменных окружения
// ---------------------------------------------------------------------------
const REQUIRED_ENV = [
  'MDLP_CLIENT_ID',
  'MDLP_CLIENT_SECRET',
  'BITRIX_WEBHOOK_URL',
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[config] Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Конфигурационный объект
// ---------------------------------------------------------------------------
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mdlp: {
    clientId: process.env.MDLP_CLIENT_ID,
    clientSecret: process.env.MDLP_CLIENT_SECRET,
    baseUrl: process.env.MDLP_BASE_URL || 'https://api.mdlp.crpt.ru',
    tokenUrl:
      process.env.MDLP_TOKEN_URL ||
      'https://api.mdlp.crpt.ru/api/v3/true-api/auth/token',
    participantInn: process.env.MDLP_PARTICIPANT_INN || '',
    defaultGtin: process.env.MDLP_DEFAULT_GTIN || '',
    /** Интервал поллинга статуса заявки, мс */
    pollIntervalMs: 5000,
    /** Максимальное время ожидания заявки, мс (15 мин) */
    pollTimeoutMs: 15 * 60 * 1000,
  },

  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL,
    portalUrl: process.env.BITRIX_PORTAL_URL || '',
    stages: {
      production: process.env.BITRIX_STAGE_PRODUCTION || 'C3:NEW',
      shipment: process.env.BITRIX_STAGE_SHIPMENT || 'C3:WON',
      markingDone: process.env.BITRIX_STAGE_MARKING_DONE || 'C3:PREPARATION',
    },
    operatorUserId: parseInt(process.env.BITRIX_OPERATOR_USER_ID, 10) || 1,
  },

  storage: {
    dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    productionDir:
      process.env.PRODUCTION_DIR ||
      path.join(__dirname, 'data', 'production', 'orders'),
    codesDbPath:
      process.env.CODES_DB_PATH ||
      path.join(__dirname, 'data', 'codes_db.json'),
  },

  security: {
    webhookSecret: process.env.WEBHOOK_SECRET || '',
  },

  /**
   * Соответствие категорий продукта кодам товарных групп ГИС МТ.
   * Битрикс24-поле UF_CRM_PRODUCT_CATEGORY → идентификатор группы MDLP.
   */
  productGroupMap: {
    молочная: 'milk',
    фармацевтика: 'pharma',
    табак: 'tobacco',
    обувь: 'shoes',
  },
};

module.exports = config;
```

---

## `src/server.js`

```js
'use strict';

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const config = require('../config');
const logger = require('./utils/logger');
const markingRouter = require('./routes/marking');
const webhookRouter = require('./routes/webhook');
const reporter = require('./utils/reporter');

// ---------------------------------------------------------------------------
// Инициализация директорий хранилища
// ---------------------------------------------------------------------------
[config.storage.dataDir, config.storage.productionDir].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// Инициализация файла БД кодов, если отсутствует
if (!fs.existsSync(config.storage.codesDbPath)) {
  fs.writeFileSync(config.storage.codesDbPath, JSON.stringify({}), 'utf8');
}

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP-логирование через morgan → winston
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// ---------------------------------------------------------------------------
// Маршруты
// ---------------------------------------------------------------------------
app.use('/api/marking', markingRouter);
app.use('/webhook', webhookRouter);

// Статические файлы отчётов (HTML для клиентов)
app.use('/reports', express.static(path.join(config.storage.dataDir, 'reports')));

// Health-check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Глобальный обработчик ошибок
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ---------------------------------------------------------------------------
// Планировщик: ежемесячная сводка (1-е число в 08:00)
// ---------------------------------------------------------------------------
cron.schedule('0 8 1 * *', async () => {
  logger.info('[cron] Запуск ежемесячной сводки маркировки');
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // предыдущий месяц
    await reporter.generateMonthlySummary(year, month > 1 ? month - 1 : 12);
    logger.info('[cron] Ежемесячная сводка сформирована');
  } catch (e) {
    logger.error(`[cron] Ошибка генерации сводки: ${e.message}`);
  }
});

// ---------------------------------------------------------------------------
// Старт
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
  logger.info(
    `FLEX-N-ROLL Marking Service запущен на порту ${config.port} [${config.env}]`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM получен — завершение работы');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  logger.info('SIGINT получен — завершение работы');
  server.close(() => process.exit(0));
});

module.exports = app; // для тестов
```

---

## `src/utils/logger.js`

```js
'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config');

const logsDir = path.join(config.storage.dataDir, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const logger = createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 10,
    }),
  ],
});

module.exports = logger;
```

---

## `src/services/mdlp.js`

```js
'use strict';

/**
 * mdlp.js — Клиент ГИС МТ (api.mdlp.crpt.ru)
 *
 * Реализует:
 *  - OAuth2 client_credentials аутентификацию с кешированием токена
 *  - Создание заявки на эмиссию кодов DataMatrix
 *  - Polling статуса заявки
 *  - Скачивание и распаковку ZIP с кодами
 *  - Регистрацию факта нанесения кодов (applied)
 *  - Регистрацию факта отгрузки (shipment)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { Readable } = require('stream');

const config = require('../../config');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Токен-менеджер
// ---------------------------------------------------------------------------
let _accessToken = null;
let _tokenExpiresAt = 0;

/**
 * Получает действующий access_token (из кеша или обновляет через OAuth2).
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);

  // Токен действителен ещё минимум 60 секунд
  if (_accessToken && _tokenExpiresAt - nowSec > 60) {
    return _accessToken;
  }

  logger.debug('[mdlp] Запрос нового access_token');

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.mdlp.clientId,
    client_secret: config.mdlp.clientSecret,
  });

  const resp = await axios.post(config.mdlp.tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  _accessToken = resp.data.access_token;
  // expires_in в секундах; если не пришёл — ставим 3600
  _tokenExpiresAt = nowSec + (resp.data.expires_in || 3600);

  logger.info('[mdlp] Токен обновлён, истекает через ' + resp.data.expires_in + ' сек');
  return _accessToken;
}

// ---------------------------------------------------------------------------
// Вспомогательный HTTP-клиент
// ---------------------------------------------------------------------------
/**
 * Создаёт axios-инстанс с авторизационным заголовком.
 * @returns {Promise<import('axios').AxiosInstance>}
 */
async function createApiClient() {
  const token = await getAccessToken();
  return axios.create({
    baseURL: config.mdlp.baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// 1. Создание заявки на эмиссию кодов
// ---------------------------------------------------------------------------

/**
 * Отправляет заявку на эмиссию кодов DataMatrix в ГИС МТ.
 *
 * @param {object} params
 * @param {string} params.gtin        — GTIN-14 товара
 * @param {number} params.quantity    — количество кодов
 * @param {string} params.productGroup — группа товаров (milk/pharma/tobacco/shoes)
 * @param {string} params.dealId      — идентификатор сделки Б24 (для заметок)
 * @returns {Promise<{orderId: string}>}
 */
async function createEmissionOrder({ gtin, quantity, productGroup, dealId }) {
  const client = await createApiClient();

  const body = {
    create_method_type: 'SELF_MADE',
    product_group: productGroup,
    gtin,
    quantity,
    // Дополнительные поля, требуемые ГИС МТ
    serialization_type: 'OPERATOR',
    // Шаблон серийного номера — оставляем auto
    serial_number_type: 'RANDOM',
    contact: {
      name: 'FLEX-N-ROLL PRO',
      inn: config.mdlp.participantInn,
    },
    release_method_type: 'PRODUCTION',
    // Привязка к внутреннему номеру заказа
    external_order_id: `B24-${dealId}`,
  };

  logger.info(`[mdlp] Создание заявки на эмиссию: gtin=${gtin}, qty=${quantity}, deal=${dealId}`);

  const resp = await client.post('/api/v3/true-api/codes/emissionOrder', body);

  const orderId = resp.data?.order_id || resp.data?.id;
  if (!orderId) {
    throw new Error(`[mdlp] Не удалось получить order_id: ${JSON.stringify(resp.data)}`);
  }

  logger.info(`[mdlp] Заявка создана: order_id=${orderId}`);
  return { orderId };
}

// ---------------------------------------------------------------------------
// 2. Polling статуса заявки
// ---------------------------------------------------------------------------

/**
 * Ожидает перехода заявки в статус DONE или REJECTED.
 *
 * @param {string} orderId
 * @returns {Promise<'DONE'|'REJECTED'>}
 */
async function pollOrderStatus(orderId) {
  const start = Date.now();
  const { pollIntervalMs, pollTimeoutMs } = config.mdlp;

  logger.info(`[mdlp] Polling статуса заявки ${orderId}`);

  while (true) {
    if (Date.now() - start > pollTimeoutMs) {
      throw new Error(`[mdlp] Timeout ожидания заявки ${orderId}`);
    }

    await sleep(pollIntervalMs);

    const client = await createApiClient();
    const resp = await client.get(`/api/v3/true-api/codes/emissionOrder/${orderId}`);
    const status = resp.data?.status;

    logger.debug(`[mdlp] Заявка ${orderId}: статус=${status}`);

    if (status === 'DONE' || status === 'READY') {
      logger.info(`[mdlp] Заявка ${orderId} завершена: ${status}`);
      return 'DONE';
    }

    if (status === 'REJECTED' || status === 'ERROR') {
      const reason = resp.data?.rejection_reason || 'неизвестно';
      throw new Error(`[mdlp] Заявка ${orderId} отклонена: ${reason}`);
    }
    // Иначе: PENDING / IN_PROGRESS — продолжаем
  }
}

// ---------------------------------------------------------------------------
// 3. Скачивание и парсинг ZIP с кодами
// ---------------------------------------------------------------------------

/**
 * Скачивает файл с кодами (ZIP → CSV/TXT) и возвращает массив кодов DataMatrix.
 *
 * @param {string} orderId
 * @returns {Promise<string[]>} массив строк DataMatrix
 */
async function downloadCodes(orderId) {
  const client = await createApiClient();

  logger.info(`[mdlp] Скачивание кодов для заявки ${orderId}`);

  // GET /api/v3/true-api/codes/emissionOrder/{orderId}/file
  const resp = await client.get(
    `/api/v3/true-api/codes/emissionOrder/${orderId}/file`,
    { responseType: 'arraybuffer' }
  );

  const zipBuffer = Buffer.from(resp.data);
  const codes = await extractCodesFromZip(zipBuffer);

  logger.info(`[mdlp] Распаковано ${codes.length} кодов для заявки ${orderId}`);
  return codes;
}

/**
 * Распаковывает ZIP-буфер и читает строки из CSV/TXT файлов внутри.
 * @param {Buffer} zipBuffer
 * @returns {Promise<string[]>}
 */
async function extractCodesFromZip(zipBuffer) {
  const codes = [];

  const directory = await unzipper.Open.buffer(zipBuffer);
  for (const file of directory.files) {
    if (file.type === 'File' && (file.path.endsWith('.csv') || file.path.endsWith('.txt'))) {
      const content = await file.buffer();
      const lines = content
        .toString('utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Первая строка может быть заголовком
      const dataLines = lines[0]?.toLowerCase().includes('datamatrix') || lines[0]?.toLowerCase().includes('code')
        ? lines.slice(1)
        : lines;

      codes.push(...dataLines);
    }
  }

  return codes;
}

// ---------------------------------------------------------------------------
// 4. Регистрация факта нанесения кодов (applied)
// ---------------------------------------------------------------------------

/**
 * Регистрирует в ГИС МТ факт нанесения кодов на продукцию.
 *
 * @param {object} params
 * @param {string[]} params.codes   — массив DataMatrix-кодов
 * @param {string}   params.gtin    — GTIN товара
 * @param {string}   params.dealId  — ID сделки
 * @returns {Promise<{reportId: string}>}
 */
async function registerCodesApplied({ codes, gtin, dealId }) {
  const client = await createApiClient();

  const body = {
    participant_inn: config.mdlp.participantInn,
    products: codes.map((code) => ({
      uit_code: code,
      gtin,
    })),
    production_date: new Date().toISOString().split('T')[0],
    external_order_id: `B24-${dealId}`,
  };

  logger.info(`[mdlp] Регистрация нанесения ${codes.length} кодов (deal=${dealId})`);

  const resp = await client.post('/api/v3/true-api/codes/applied', body);

  const reportId = resp.data?.report_id || resp.data?.id;
  logger.info(`[mdlp] Нанесение зарегистрировано, report_id=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// 5. Регистрация факта отгрузки
// ---------------------------------------------------------------------------

/**
 * Регистрирует в ГИС МТ отгрузку товара с нанесёнными кодами.
 *
 * @param {object} params
 * @param {string[]} params.codes      — коды, нанесённые на отгружаемый товар
 * @param {string}   params.dealId     — ID сделки Б24
 * @param {string}   params.receiverInn — ИНН получателя
 * @returns {Promise<{reportId: string}>}
 */
async function registerShipment({ codes, dealId, receiverInn }) {
  const client = await createApiClient();

  const body = {
    participant_inn: config.mdlp.participantInn,
    receiver_inn: receiverInn || '',
    transfer_date: new Date().toISOString().split('T')[0],
    transfer_document_number: `B24-${dealId}`,
    transfer_document_date: new Date().toISOString().split('T')[0],
    products: codes.map((code) => ({ uit_code: code })),
  };

  logger.info(`[mdlp] Регистрация отгрузки ${codes.length} кодов (deal=${dealId})`);

  const resp = await client.post('/api/v3/true-api/documents/create', {
    document_format: 'MANUAL',
    product_document: JSON.stringify(body),
    type: '415', // тип документа «Отгрузка»
  });

  const reportId = resp.data?.document_id || resp.data?.id;
  logger.info(`[mdlp] Отгрузка зарегистрирована, document_id=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  getAccessToken,
  createEmissionOrder,
  pollOrderStatus,
  downloadCodes,
  registerCodesApplied,
  registerShipment,
};
```

---

## `src/services/bitrix.js`

```js
'use strict';

/**
 * bitrix.js — Клиент Битрикс24 REST API
 *
 * Реализует:
 *  - Чтение полей сделки (UF_CRM_*)
 *  - Обновление полей сделки
 *  - Создание задачи оператору маркировки
 *  - Прикрепление файла к задаче
 *  - Отправка уведомления пользователю
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const config = require('../../config');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * Выполняет вызов метода Битрикс24 REST API.
 * @param {string} method  — название метода, например 'crm.deal.get'
 * @param {object} params  — параметры вызова
 * @returns {Promise<any>} — содержимое поля result
 */
async function callBitrix(method, params = {}) {
  const url = `${config.bitrix.webhookUrl}/${method}`;

  try {
    const resp = await axios.post(url, params, { timeout: 15000 });

    if (resp.data?.error) {
      throw new Error(`Битрикс24 ошибка [${resp.data.error}]: ${resp.data.error_description}`);
    }

    return resp.data?.result;
  } catch (err) {
    // Прикидываем дополнительный контекст
    const msg = err.response?.data?.error_description || err.message;
    logger.error(`[bitrix] Ошибка метода ${method}: ${msg}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Работа со сделками
// ---------------------------------------------------------------------------

/**
 * Получает данные сделки по ID.
 * Возвращает полный объект сделки, включая UF-поля.
 *
 * @param {string|number} dealId
 * @returns {Promise<object>}
 */
async function getDeal(dealId) {
  logger.debug(`[bitrix] getDeal(${dealId})`);
  const result = await callBitrix('crm.deal.get', { id: dealId });
  return result;
}

/**
 * Извлекает из сделки поля маркировки.
 *
 * @param {string|number} dealId
 * @returns {Promise<{
 *   markingRequired: boolean,
 *   productCategory: string,
 *   codesCount: number,
 *   stageId: string,
 *   dealTitle: string,
 * }>}
 */
async function getDealMarkingFields(dealId) {
  const deal = await getDeal(dealId);

  const markingRequired =
    deal.UF_CRM_MARKING_REQUIRED === '1' ||
    deal.UF_CRM_MARKING_REQUIRED === true ||
    deal.UF_CRM_MARKING_REQUIRED === 'Y';

  const productCategory = (deal.UF_CRM_PRODUCT_CATEGORY || '').toLowerCase();
  const codesCount = parseInt(deal.UF_CRM_MARKING_CODES_COUNT, 10) || 0;
  const stageId = deal.STAGE_ID || '';
  const dealTitle = deal.TITLE || `Сделка #${dealId}`;

  return { markingRequired, productCategory, codesCount, stageId, dealTitle };
}

/**
 * Обновляет пользовательские поля сделки.
 *
 * @param {string|number} dealId
 * @param {object} fields  — объект вида { UF_CRM_FIELD_NAME: value }
 * @returns {Promise<boolean>}
 */
async function updateDealFields(dealId, fields) {
  logger.debug(`[bitrix] updateDealFields(${dealId}): ${JSON.stringify(fields)}`);
  const result = await callBitrix('crm.deal.update', {
    id: dealId,
    fields,
  });
  return result === true || result === 1 || result;
}

/**
 * Читает контактный ИНН из связанного контакта/компании сделки.
 * Используется для регистрации отгрузки в ГИС МТ.
 *
 * @param {string|number} dealId
 * @returns {Promise<string>}
 */
async function getDealContactInn(dealId) {
  const deal = await getDeal(dealId);
  let inn = '';

  if (deal.COMPANY_ID) {
    try {
      const company = await callBitrix('crm.company.get', { id: deal.COMPANY_ID });
      inn = company.UF_CRM_COMPANY_INN || '';
    } catch (_) { /* не критично */ }
  }

  if (!inn && deal.CONTACT_ID) {
    try {
      const contact = await callBitrix('crm.contact.get', { id: deal.CONTACT_ID });
      inn = contact.UF_CRM_CONTACT_INN || '';
    } catch (_) { /* не критично */ }
  }

  return inn;
}

// ---------------------------------------------------------------------------
// Задачи и уведомления
// ---------------------------------------------------------------------------

/**
 * Создаёт задачу для оператора маркировки.
 *
 * @param {object} params
 * @param {string} params.dealId
 * @param {string} params.dealTitle
 * @param {string} params.description
 * @param {number} [params.responsibleId]  — ID ответственного (по умолч. из config)
 * @returns {Promise<{taskId: number}>}
 */
async function createMarkingTask({ dealId, dealTitle, description, responsibleId }) {
  const userId = responsibleId || config.bitrix.operatorUserId;
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +1 день

  logger.info(`[bitrix] Создание задачи для сделки ${dealId}, ответственный: ${userId}`);

  const result = await callBitrix('tasks.task.add', {
    fields: {
      TITLE: `Маркировка ЧЗ: ${dealTitle}`,
      DESCRIPTION: description,
      RESPONSIBLE_ID: userId,
      DEADLINE: deadline,
      UF_CRM_TASK: [`D_${dealId}`], // привязка к сделке
      PRIORITY: '1', // высокий
    },
  });

  const taskId = result?.task?.id;
  logger.info(`[bitrix] Задача создана: taskId=${taskId}`);
  return { taskId };
}

/**
 * Добавляет комментарий к задаче (с возможностью прикрепить CSV-файл как текст).
 *
 * @param {number} taskId
 * @param {string} text
 * @returns {Promise<void>}
 */
async function addTaskComment(taskId, text) {
  await callBitrix('task.commentitem.add', {
    TASKID: taskId,
    FIELDS: { POST_MESSAGE: text },
  });
}

/**
 * Загружает файл в «Диск» Б24 и прикрепляет к задаче.
 *
 * @param {object} params
 * @param {number} params.taskId
 * @param {string} params.filePath  — полный путь к файлу на сервере
 * @param {string} params.fileName  — имя файла в Б24
 * @returns {Promise<void>}
 */
async function attachFileToTask({ taskId, filePath, fileName }) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const base64 = fileContent.toString('base64');

    logger.debug(`[bitrix] Загрузка файла ${fileName} к задаче ${taskId}`);

    await callBitrix('task.item.addfile', {
      taskId,
      fileData: { NAME: fileName, CONTENT: base64 },
    });
  } catch (err) {
    logger.error(`[bitrix] Ошибка загрузки файла к задаче: ${err.message}`);
    // Не пробрасываем — задача уже создана
  }
}

/**
 * Отправляет уведомление пользователю через im.notify.
 *
 * @param {number} userId
 * @param {string} message
 * @returns {Promise<void>}
 */
async function sendNotification(userId, message) {
  try {
    await callBitrix('im.notify.system.add', {
      USER_ID: userId,
      MESSAGE: message,
    });
    logger.debug(`[bitrix] Уведомление отправлено пользователю ${userId}`);
  } catch (err) {
    logger.warn(`[bitrix] Не удалось отправить уведомление: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Получение списка файлов задачи (для поиска codes.csv)
// ---------------------------------------------------------------------------

/**
 * Проверяет существование пользовательского поля в сделках Б24.
 * Используется при первом запуске для диагностики конфигурации.
 * @returns {Promise<string[]>} список названий UF-полей
 */
async function listDealUserFields() {
  const result = await callBitrix('crm.deal.userfield.list', {});
  return (result || []).map((f) => f.FIELD_NAME);
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  callBitrix,
  getDeal,
  getDealMarkingFields,
  updateDealFields,
  getDealContactInn,
  createMarkingTask,
  addTaskComment,
  attachFileToTask,
  sendNotification,
  listDealUserFields,
};
```

---

## `src/services/codeManager.js`

```js
'use strict';

/**
 * codeManager.js — Управление кодами DataMatrix
 *
 * Отвечает за:
 *  1. Оркестрацию полного цикла получения кодов из ГИС МТ
 *  2. Сохранение кодов в JSON-«базу» (codes_db.json)
 *  3. Формирование CSV-файла задания для печатного оборудования
 *  4. Верификацию (подтверждение нанесения)
 *  5. Уведомление оператора в Б24
 */

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const logger = require('../utils/logger');
const mdlp = require('./mdlp');
const bitrix = require('./bitrix');

// ---------------------------------------------------------------------------
// JSON-база кодов (file-based store)
// ---------------------------------------------------------------------------

/**
 * Читает codes_db.json.
 * Структура: { [dealId]: { orderId, gtin, productGroup, codes: [...], status, createdAt, appliedAt } }
 * @returns {object}
 */
function readDb() {
  try {
    const raw = fs.readFileSync(config.storage.codesDbPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Записывает обновлённую БД.
 * @param {object} db
 */
function writeDb(db) {
  fs.writeFileSync(config.storage.codesDbPath, JSON.stringify(db, null, 2), 'utf8');
}

/**
 * Возвращает запись по dealId или undefined.
 * @param {string} dealId
 */
function getEntry(dealId) {
  return readDb()[String(dealId)];
}

/**
 * Обновляет поля записи для dealId.
 * @param {string} dealId
 * @param {object} patch
 */
function upsertEntry(dealId, patch) {
  const db = readDb();
  const key = String(dealId);
  db[key] = { ...(db[key] || {}), dealId: key, ...patch };
  writeDb(db);
}

// ---------------------------------------------------------------------------
// 1. Полный цикл: получение кодов из ГИС МТ
// ---------------------------------------------------------------------------

/**
 * Запрашивает коды DataMatrix у ГИС МТ, сохраняет в БД.
 *
 * @param {object} params
 * @param {string} params.dealId
 * @param {string} params.productCategory  — из UF_CRM_PRODUCT_CATEGORY
 * @param {number} params.codesCount
 * @param {string} [params.gtin]           — переопределение GTIN (по умолч. из config)
 * @returns {Promise<{orderId: string, codes: string[]}>}
 */
async function requestCodesForDeal({ dealId, productCategory, codesCount, gtin }) {
  const resolvedGtin = gtin || config.mdlp.defaultGtin;
  const productGroup = config.productGroupMap[productCategory] || productCategory;

  logger.info(
    `[codeManager] Запрос ${codesCount} кодов для сделки ${dealId} ` +
    `(категория: ${productCategory}, GTIN: ${resolvedGtin})`
  );

  // Обновляем статус в Б24
  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'REQUESTING',
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  // 1. Создать заявку
  const { orderId } = await mdlp.createEmissionOrder({
    gtin: resolvedGtin,
    quantity: codesCount,
    productGroup,
    dealId,
  });

  upsertEntry(dealId, {
    orderId,
    gtin: resolvedGtin,
    productGroup,
    status: 'PENDING',
    codesCount,
    createdAt: new Date().toISOString(),
  });

  // 2. Polling статуса
  await mdlp.pollOrderStatus(orderId);

  // 3. Скачать коды
  const codes = await mdlp.downloadCodes(orderId);

  upsertEntry(dealId, { codes, status: 'CODES_READY', codesReadyAt: new Date().toISOString() });

  // Обновляем Б24
  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'CODES_READY',
    UF_CRM_MARKING_ORDER_ID: orderId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] ${codes.length} кодов получено для сделки ${dealId}`);
  return { orderId, codes };
}

// ---------------------------------------------------------------------------
// 2. Формирование CSV-файла для печатного оборудования
// ---------------------------------------------------------------------------

/**
 * Создаёт CSV-файл задания для типографского оборудования.
 * Формат: serial_number, datamatrix_code, order_id
 *
 * @param {string} dealId
 * @returns {Promise<string>} путь к созданному файлу
 */
async function generateProductionFile(dealId) {
  const entry = getEntry(dealId);
  if (!entry || !entry.codes || entry.codes.length === 0) {
    throw new Error(`[codeManager] Коды для сделки ${dealId} не найдены в БД`);
  }

  const orderDir = path.join(config.storage.productionDir, String(dealId));
  fs.mkdirSync(orderDir, { recursive: true });

  const filePath = path.join(orderDir, 'codes.csv');

  // Заголовок + строки
  const header = 'serial_number,datamatrix_code,order_id\n';
  const rows = entry.codes
    .map((code, idx) => `${String(idx + 1).padStart(6, '0')},${code},B24-${dealId}`)
    .join('\n');

  fs.writeFileSync(filePath, header + rows, 'utf8');

  logger.info(`[codeManager] CSV-файл задания сохранён: ${filePath}`);
  return filePath;
}

// ---------------------------------------------------------------------------
// 3. Уведомление оператора в Б24 + задача с файлом
// ---------------------------------------------------------------------------

/**
 * Создаёт задачу оператору и прикрепляет CSV-файл с кодами.
 *
 * @param {string} dealId
 * @param {string} csvFilePath
 * @returns {Promise<{taskId: number}>}
 */
async function notifyOperator(dealId, csvFilePath) {
  const entry = getEntry(dealId);
  const deal = await bitrix.getDeal(dealId);
  const dealTitle = deal?.TITLE || `Сделка #${dealId}`;

  const description =
    `Сделка: ${dealTitle}\n` +
    `Количество кодов: ${entry?.codesCount || '?'}\n` +
    `Товарная группа: ${entry?.productGroup || '?'}\n` +
    `GTIN: ${entry?.gtin || '?'}\n` +
    `Заявка ГИС МТ: ${entry?.orderId || '?'}\n\n` +
    `Файл задания прикреплён. После завершения печати подтвердите нанесение ` +
    `через API: POST /api/marking/verify {"dealId": "${dealId}"}`;

  const { taskId } = await bitrix.createMarkingTask({
    dealId,
    dealTitle,
    description,
    responsibleId: config.bitrix.operatorUserId,
  });

  // Прикрепляем CSV
  await bitrix.attachFileToTask({
    taskId,
    filePath: csvFilePath,
    fileName: `codes_${dealId}.csv`,
  });

  // Системное уведомление
  await bitrix.sendNotification(
    config.bitrix.operatorUserId,
    `✅ Коды DataMatrix готовы к печати. Сделка: ${dealTitle}. Задача: #${taskId}`
  );

  upsertEntry(dealId, { taskId, status: 'IN_PRODUCTION' });

  logger.info(`[codeManager] Оператор уведомлён, taskId=${taskId}`);
  return { taskId };
}

// ---------------------------------------------------------------------------
// 4. Верификация: подтверждение нанесения кодов
// ---------------------------------------------------------------------------

/**
 * Регистрирует факт нанесения кодов в ГИС МТ и обновляет статус в Б24.
 *
 * @param {string} dealId
 * @param {string[]} [appliedCodes]  — если не передан, берём все коды из БД
 * @returns {Promise<{reportId: string}>}
 */
async function verifyCodesApplied(dealId, appliedCodes) {
  const entry = getEntry(dealId);
  if (!entry) throw new Error(`[codeManager] Сделка ${dealId} не найдена в БД`);

  const codes = appliedCodes || entry.codes || [];
  if (codes.length === 0) throw new Error(`[codeManager] Нет кодов для верификации`);

  logger.info(`[codeManager] Верификация ${codes.length} кодов для сделки ${dealId}`);

  const { reportId } = await mdlp.registerCodesApplied({
    codes,
    gtin: entry.gtin,
    dealId,
  });

  upsertEntry(dealId, {
    status: 'VERIFIED',
    reportId,
    appliedAt: new Date().toISOString(),
    appliedCodes: codes,
  });

  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'VERIFIED',
    UF_CRM_MARKING_REPORT_ID: reportId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] Верификация завершена: reportId=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// 5. Регистрация отгрузки
// ---------------------------------------------------------------------------

/**
 * Регистрирует отгрузку товара с нанесёнными кодами в ГИС МТ.
 *
 * @param {string} dealId
 * @returns {Promise<{reportId: string}>}
 */
async function registerDealShipment(dealId) {
  const entry = getEntry(dealId);
  if (!entry) throw new Error(`[codeManager] Сделка ${dealId} не найдена`);

  const codes = entry.appliedCodes || entry.codes || [];
  if (codes.length === 0) throw new Error(`[codeManager] Нет кодов для отгрузки`);

  // Получаем ИНН получателя
  const receiverInn = await bitrix.getDealContactInn(dealId).catch(() => '');

  const { reportId } = await mdlp.registerShipment({ codes, dealId, receiverInn });

  upsertEntry(dealId, {
    status: 'SHIPPED',
    shipmentReportId: reportId,
    shippedAt: new Date().toISOString(),
  });

  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'SHIPPED',
    UF_CRM_MARKING_SHIP_ID: reportId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] Отгрузка зарегистрирована: reportId=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// Вспомогательные экспорты
// ---------------------------------------------------------------------------

/**
 * Возвращает все записи из БД (для отчётов).
 * @returns {object}
 */
function getAllEntries() {
  return readDb();
}

module.exports = {
  requestCodesForDeal,
  generateProductionFile,
  notifyOperator,
  verifyCodesApplied,
  registerDealShipment,
  getEntry,
  getAllEntries,
};
```

---

## `src/utils/datamatrix.js`

```js
'use strict';

/**
 * datamatrix.js — Утилиты для работы с кодами DataMatrix
 *
 * Реализует:
 *  - Парсинг GS1 DataMatrix (FNC1 Application Identifiers)
 *  - Валидацию структуры кода ЧЗ (01+21 или 01+21+91+92)
 *  - Генерацию QR-кода для HTML-отчётов (через библиотеку qrcode)
 *  - Верификацию контрольной суммы (GS1 Check Digit для GTIN-14)
 */

const qrcode = require('qrcode');

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

// Разделитель групп в GS1 DataMatrix (Group Separator, ASCII 29)
const GS = String.fromCharCode(29);

// Application Identifiers, используемые ЧЗ
const AI = {
  GTIN: '01',        // (01) GTIN-14
  SERIAL: '21',      // (21) Серийный номер
  CRYPTO_KEY: '91',  // (91) Ключ проверки (ЧЗ)
  CRYPTO_SIGN: '92', // (92) Крипто-хвост (ЧЗ)
};

// ---------------------------------------------------------------------------
// Парсинг DataMatrix кода ЧЗ
// ---------------------------------------------------------------------------

/**
 * Разбирает строку DataMatrix на компоненты.
 *
 * Поддерживаемые форматы ЧЗ:
 *  - 010...021...<GS>91...<GS>92...
 *  - 010...021...         (без крипто)
 *
 * @param {string} raw  — сырая строка кода (как отпечатана / отсканирована)
 * @returns {{
 *   gtin: string,
 *   serial: string,
 *   cryptoKey: string|null,
 *   cryptoSig: string|null,
 *   raw: string,
 *   valid: boolean,
 *   error: string|null,
 * }}
 */
function parseDataMatrix(raw) {
  const result = {
    gtin: '',
    serial: '',
    cryptoKey: null,
    cryptoSig: null,
    raw,
    valid: false,
    error: null,
  };

  if (!raw || typeof raw !== 'string') {
    result.error = 'Пустой или некорректный код';
    return result;
  }

  // Нормализуем: заменяем видимый разделитель \x1D на GS
  const code = raw.replace(/\x1d/g, GS).replace(/\\x1d/g, GS);

  // Должен начинаться с AI 01
  if (!code.startsWith('01')) {
    result.error = 'Код не начинается с AI (01)';
    return result;
  }

  // GTIN: фиксированная длина 14 символов после AI 01
  result.gtin = code.substring(2, 16);

  if (result.gtin.length !== 14) {
    result.error = 'GTIN должен содержать 14 символов';
    return result;
  }

  // Серийный номер: после AI 21, до GS или конца строки
  const serialStart = code.indexOf('21', 16);
  if (serialStart === -1) {
    result.error = 'AI (21) серийного номера не найден';
    return result;
  }

  const afterSerial = code.indexOf(GS, serialStart + 2);
  result.serial = afterSerial === -1
    ? code.substring(serialStart + 2)
    : code.substring(serialStart + 2, afterSerial);

  // Крипто-ключ AI 91 (опционально)
  const key91 = code.indexOf('\x1d91', 0);
  const alt91 = code.indexOf(GS + '91', 0);
  const pos91 = key91 !== -1 ? key91 : alt91;

  if (pos91 !== -1) {
    const startKey = pos91 + (GS + '91').length;
    const endKey = code.indexOf(GS, startKey);
    result.cryptoKey = endKey === -1 ? code.substring(startKey) : code.substring(startKey, endKey);
  }

  // Крипто-подпись AI 92 (опционально)
  const pos92 = code.indexOf(GS + '92', 0);
  if (pos92 !== -1) {
    const startSig = pos92 + (GS + '92').length;
    result.cryptoSig = code.substring(startSig); // всегда последний
  }

  // Базовая валидация контрольной цифры GTIN
  const gtinCheck = validateGtinCheckDigit(result.gtin);
  if (!gtinCheck) {
    result.error = `Неверная контрольная цифра GTIN: ${result.gtin}`;
    return result;
  }

  result.valid = true;
  return result;
}

// ---------------------------------------------------------------------------
// Контрольная цифра GTIN-14 (алгоритм GS1)
// ---------------------------------------------------------------------------

/**
 * Проверяет контрольную цифру GTIN-14 по алгоритму GS1.
 * @param {string} gtin  — строка из 14 цифр
 * @returns {boolean}
 */
function validateGtinCheckDigit(gtin) {
  if (!/^\d{14}$/.test(gtin)) return false;

  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop(); // последняя цифра

  const sum = digits.reduce((acc, d, i) => {
    return acc + d * ((i % 2 === 0) ? 3 : 1);
  }, 0);

  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

/**
 * Вычисляет контрольную цифру для первых 13 цифр GTIN.
 * @param {string} gtin13  — 13 цифр
 * @returns {string}  — 14-значный GTIN с правильной контрольной цифрой
 */
function computeGtinCheckDigit(gtin13) {
  if (!/^\d{13}$/.test(gtin13)) {
    throw new Error('GTIN без контрольной цифры должен содержать 13 цифр');
  }
  const digits = gtin13.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * ((i % 2 === 0) ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return gtin13 + check;
}

// ---------------------------------------------------------------------------
// Верификация набора кодов
// ---------------------------------------------------------------------------

/**
 * Проверяет массив кодов и возвращает отчёт.
 *
 * @param {string[]} codes
 * @returns {{
 *   total: number,
 *   valid: number,
 *   invalid: number,
 *   errors: {code: string, error: string}[],
 *   parsed: object[],
 * }}
 */
function verifyCodes(codes) {
  const parsed = codes.map((c) => parseDataMatrix(c));
  const errors = parsed
    .filter((p) => !p.valid)
    .map((p) => ({ code: p.raw, error: p.error }));

  return {
    total: codes.length,
    valid: parsed.filter((p) => p.valid).length,
    invalid: errors.length,
    errors,
    parsed,
  };
}

// ---------------------------------------------------------------------------
// Генерация QR-кода (Data URL) для HTML-отчётов
// ---------------------------------------------------------------------------

/**
 * Генерирует base64 PNG QR-код для переданной строки.
 * Удобен для встраивания в HTML: <img src="{result}">
 *
 * @param {string} text
 * @param {object} [opts]          — опции qrcode
 * @param {number} [opts.width=150]
 * @returns {Promise<string>}       — data URL (image/png, base64)
 */
async function generateQrDataUrl(text, opts = {}) {
  const options = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: opts.width || 150,
    margin: 1,
  };
  return qrcode.toDataURL(text, options);
}

/**
 * Генерирует SVG QR-код (строка).
 * @param {string} text
 * @returns {Promise<string>}
 */
async function generateQrSvg(text) {
  return qrcode.toString(text, { type: 'svg', errorCorrectionLevel: 'M' });
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  parseDataMatrix,
  validateGtinCheckDigit,
  computeGtinCheckDigit,
  verifyCodes,
  generateQrDataUrl,
  generateQrSvg,
};
```

---

## `src/utils/reporter.js`

```js
'use strict';

/**
 * reporter.js — Генерация отчётов по маркировке
 *
 * 1. HTML-отчёт для клиента: список нанесённых кодов с QR
 * 2. XML-отчёт для налоговых органов (по структуре ФНС)
 * 3. Ежемесячная сводка: количество кодов по категориям
 */

const fs = require('fs');
const path = require('path');
const { generateQrDataUrl } = require('./datamatrix');
const config = require('../../config');
const logger = require('./logger');

const reportsDir = path.join(config.storage.dataDir, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1. HTML-отчёт для клиента
// ---------------------------------------------------------------------------

/**
 * Генерирует HTML-файл отчёта для клиента с QR-кодами нанесённых кодов DM.
 *
 * @param {object} params
 * @param {string}   params.dealId
 * @param {string}   params.dealTitle
 * @param {string}   params.productCategory
 * @param {string}   params.gtin
 * @param {string[]} params.codes          — нанесённые коды DataMatrix
 * @param {string}   [params.orderId]      — номер заявки ГИС МТ
 * @returns {Promise<string>} путь к HTML-файлу
 */
async function generateClientReport({ dealId, dealTitle, productCategory, gtin, codes, orderId }) {
  logger.info(`[reporter] Генерация HTML-отчёта для сделки ${dealId}, кодов: ${codes.length}`);

  const rows = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const qrDataUrl = await generateQrDataUrl(code, { width: 120 }).catch(() => '');
    const serial = i + 1;
    rows.push(`
      <tr>
        <td>${serial}</td>
        <td class="code-cell"><code>${escapeHtml(code)}</code></td>
        <td>${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR #${serial}" width="80">` : '—'}</td>
        <td><span class="badge applied">Нанесён</span></td>
      </tr>`);
  }

  const date = new Date().toLocaleDateString('ru-RU', { dateStyle: 'long' });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Отчёт маркировки — ${escapeHtml(dealTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; color: #1a1a2e; }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff; padding: 32px 48px;
    }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { opacity: .7; font-size: 13px; }
    .logo { font-size: 11px; text-transform: uppercase; letter-spacing: .15em;
            opacity: .5; margin-bottom: 12px; }
    .container { max-width: 1200px; margin: 32px auto; padding: 0 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                 gap: 16px; margin-bottom: 32px; }
    .meta-card { background: #fff; border-radius: 8px; padding: 16px 20px;
                 box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .meta-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
                        color: #888; margin-bottom: 4px; }
    .meta-card .value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .section { background: #fff; border-radius: 8px; padding: 24px;
               box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 24px; }
    .section h2 { font-size: 16px; margin-bottom: 16px; border-bottom: 2px solid #e8eaf0;
                  padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f2f8; text-align: left; padding: 10px 12px;
         font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #555; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f2f8; vertical-align: middle; }
    .code-cell { font-size: 11px; max-width: 320px; word-break: break-all; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
             font-size: 11px; font-weight: 600; }
    .badge.applied { background: #e8f5e9; color: #2e7d32; }
    .footer { text-align: center; font-size: 12px; color: #aaa;
              padding: 32px 0; margin-top: 16px; }
    @media print { body { background: #fff; } .header { background: #1a1a2e !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FLEX-N-ROLL PRO — Система маркировки</div>
    <h1>${escapeHtml(dealTitle)}</h1>
    <p>Отчёт о нанесении кодов «Честный ЗНАК» · Сформирован: ${date}</p>
  </div>
  <div class="container">
    <div class="meta-grid">
      <div class="meta-card">
        <div class="label">Сделка B24</div>
        <div class="value">#${escapeHtml(String(dealId))}</div>
      </div>
      <div class="meta-card">
        <div class="label">Товарная группа</div>
        <div class="value">${escapeHtml(productCategory)}</div>
      </div>
      <div class="meta-card">
        <div class="label">GTIN</div>
        <div class="value" style="font-size:14px">${escapeHtml(gtin)}</div>
      </div>
      <div class="meta-card">
        <div class="label">Заявка ГИС МТ</div>
        <div class="value" style="font-size:14px">${escapeHtml(orderId || '—')}</div>
      </div>
      <div class="meta-card">
        <div class="label">Всего кодов</div>
        <div class="value">${codes.length}</div>
      </div>
      <div class="meta-card">
        <div class="label">Статус</div>
        <div class="value" style="color:#2e7d32">Нанесено</div>
      </div>
    </div>

    <div class="section">
      <h2>Коды DataMatrix — нанесённые на продукцию</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Код DataMatrix</th>
            <th>QR-код</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div class="footer">
    FLEX-N-ROLL PRO · Типография · Партнёр Честного ЗНАКа · ${date}
  </div>
</body>
</html>`;

  const outPath = path.join(reportsDir, `client_${dealId}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  logger.info(`[reporter] HTML-отчёт сохранён: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// 2. XML-отчёт для налоговых органов (структура ФНС)
// ---------------------------------------------------------------------------

/**
 * Генерирует XML-файл отчёта по стандарту, принятому для ФНС / ГИС МТ.
 *
 * @param {object} params
 * @param {string}   params.dealId
 * @param {string}   params.dealTitle
 * @param {string}   params.gtin
 * @param {string}   params.productCategory
 * @param {string[]} params.codes
 * @param {string}   [params.inn]       — ИНН участника оборота
 * @param {string}   [params.orderId]
 * @returns {string} путь к XML-файлу
 */
function generateFnsXmlReport({ dealId, dealTitle, gtin, productCategory, codes, inn, orderId }) {
  logger.info(`[reporter] Генерация XML-отчёта для сделки ${dealId}`);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const codeItems = codes
    .map((c, i) =>
      `    <Код>\n` +
      `      <Номер>${i + 1}</Номер>\n` +
      `      <ЗначениеДМ><![CDATA[${c}]]></ЗначениеДМ>\n` +
      `      <Статус>НАНЕСЁН</Статус>\n` +
      `    </Код>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Отчёт о нанесении кодов маркировки. Типография FLEX-N-ROLL PRO -->
<!-- Участник оборота товаров — партнёр системы «Честный ЗНАК» -->
<ОтчётМаркировки
  xmlns:xs="http://www.w3.org/2001/XMLSchema-instance"
  ВерсияФормата="1.0"
  ДатаФормирования="${dateStr}"
  ВремяФормирования="${timeStr}">

  <УчастникОборота>
    <ИНН>${escapeXml(inn || config.mdlp.participantInn)}</ИНН>
    <НаименованиеОрганизации>FLEX-N-ROLL PRO</НаименованиеОрганизации>
    <РольУчастника>ТИПОГРАФИЯ</РольУчастника>
  </УчастникОборота>

  <СведенияОТоваре>
    <GTIN>${escapeXml(gtin)}</GTIN>
    <ТоварнаяГруппа>${escapeXml(productCategory)}</ТоварнаяГруппа>
    <НомерЗаявкиГИСМТ>${escapeXml(orderId || '')}</НомерЗаявкиГИСМТ>
    <ИдентификаторСделкиБ24>${escapeXml(String(dealId))}</ИдентификаторСделкиБ24>
    <НаименованиеЗаказа>${escapeXml(dealTitle)}</НаименованиеЗаказа>
  </СведенияОТоваре>

  <СведенияОНанесении>
    <ДатаНанесения>${dateStr}</ДатаНанесения>
    <КоличествоКодов>${codes.length}</КоличествоКодов>
    <КодыМаркировки>
${codeItems}
    </КодыМаркировки>
  </СведенияОНанесении>

</ОтчётМаркировки>`;

  const outPath = path.join(reportsDir, `fns_${dealId}.xml`);
  fs.writeFileSync(outPath, xml, 'utf8');
  logger.info(`[reporter] XML-отчёт ФНС сохранён: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// 3. Ежемесячная сводка
// ---------------------------------------------------------------------------

/**
 * Генерирует ежемесячную сводку по всем сделкам из codes_db.json.
 * Группирует по товарным категориям.
 *
 * @param {number} year
 * @param {number} month  — 1-12
 * @returns {Promise<string>} путь к HTML-файлу сводки
 */
async function generateMonthlySummary(year, month) {
  logger.info(`[reporter] Генерация сводки за ${year}-${String(month).padStart(2, '0')}`);

  // Читаем все записи из БД
  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(config.storage.codesDbPath, 'utf8'));
  } catch {
    db = {};
  }

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  // Фильтруем по месяцу (по createdAt)
  const entries = Object.values(db).filter((e) => {
    if (!e.createdAt) return false;
    return e.createdAt.startsWith(monthStr);
  });

  // Группируем по productGroup
  const byGroup = {};
  for (const e of entries) {
    const g = e.productGroup || 'unknown';
    if (!byGroup[g]) byGroup[g] = { count: 0, deals: 0, verified: 0, shipped: 0 };
    byGroup[g].deals += 1;
    byGroup[g].count += e.codesCount || (e.codes?.length ?? 0);
    if (['VERIFIED', 'SHIPPED'].includes(e.status)) byGroup[g].verified += 1;
    if (e.status === 'SHIPPED') byGroup[g].shipped += 1;
  }

  const totalCodes = entries.reduce((s, e) => s + (e.codesCount || e.codes?.length || 0), 0);

  const rows = Object.entries(byGroup).map(([group, stats]) =>
    `<tr>
      <td>${escapeHtml(group)}</td>
      <td>${stats.deals}</td>
      <td>${stats.count.toLocaleString('ru-RU')}</td>
      <td>${stats.verified}</td>
      <td>${stats.shipped}</td>
    </tr>`
  ).join('\n');

  const monthLabel = new Date(year, month - 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Сводка маркировки — ${monthLabel}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;color:#1a1a2e;margin:0}
    .header{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:32px 48px}
    .header h1{font-size:22px;margin-bottom:4px}
    .header p{opacity:.6;font-size:13px}
    .container{max-width:900px;margin:32px auto;padding:0 24px}
    .kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
    .kpi-card{background:#fff;border-radius:8px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .kpi-card .l{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px}
    .kpi-card .v{font-size:26px;font-weight:700}
    .section{background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .section h2{font-size:15px;margin-bottom:16px;border-bottom:2px solid #e8eaf0;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f0f2f8;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;color:#555}
    td{padding:10px 12px;border-bottom:1px solid #f0f2f8}
    .footer{text-align:center;font-size:12px;color:#aaa;padding:32px 0}
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.15em;opacity:.5;margin-bottom:8px">FLEX-N-ROLL PRO</div>
    <h1>Сводка маркировки — ${monthLabel}</h1>
    <p>Ежемесячный отчёт по нанесению кодов «Честный ЗНАК»</p>
  </div>
  <div class="container">
    <div class="kpi">
      <div class="kpi-card"><div class="l">Всего сделок</div><div class="v">${entries.length}</div></div>
      <div class="kpi-card"><div class="l">Всего кодов</div><div class="v">${totalCodes.toLocaleString('ru-RU')}</div></div>
      <div class="kpi-card"><div class="l">Категорий</div><div class="v">${Object.keys(byGroup).length}</div></div>
    </div>
    <div class="section">
      <h2>По товарным группам</h2>
      <table>
        <thead>
          <tr><th>Группа</th><th>Сделки</th><th>Коды</th><th>Верифицировано</th><th>Отгружено</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Данные за период отсутствуют</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <div class="footer">Сформирован ${new Date().toLocaleDateString('ru-RU', {dateStyle:'long'})} · FLEX-N-ROLL PRO</div>
</body>
</html>`;

  const outPath = path.join(reportsDir, `monthly_${monthStr}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  logger.info(`[reporter] Сводка сохранена: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  generateClientReport,
  generateFnsXmlReport,
  generateMonthlySummary,
};
```

---

## `src/routes/marking.js`

```js
'use strict';

/**
 * marking.js — REST API маркировки
 *
 * POST /api/marking/request        — запросить коды для сделки
 * GET  /api/marking/status/:dealId — статус процесса маркировки
 * POST /api/marking/verify         — подтвердить нанесение кодов
 * GET  /api/marking/report/:dealId — скачать HTML-отчёт для клиента
 * GET  /api/marking/xml/:dealId    — скачать XML-отчёт ФНС
 * GET  /api/marking/monthly        — ежемесячная сводка
 * POST /api/marking/shipment       — зарегистрировать отгрузку
 * GET  /api/marking/verify-codes   — верификация структуры кодов (dry-run)
 */

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

const logger = require('../utils/logger');
const codeManager = require('../services/codeManager');
const reporter = require('../utils/reporter');
const datamatrix = require('../utils/datamatrix');
const config = require('../../config');

// ---------------------------------------------------------------------------
// Вспомогательный middleware валидации
// ---------------------------------------------------------------------------
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

// ---------------------------------------------------------------------------
// POST /api/marking/request
// Запрашивает коды DataMatrix у ГИС МТ для сделки Б24.
// ---------------------------------------------------------------------------
router.post(
  '/request',
  [
    body('dealId').notEmpty().withMessage('dealId обязателен'),
    body('productCategory')
      .notEmpty()
      .isIn(['молочная', 'фармацевтика', 'табак', 'обувь'])
      .withMessage('productCategory: молочная | фармацевтика | табак | обувь'),
    body('codesCount')
      .isInt({ min: 1, max: 1000000 })
      .withMessage('codesCount: целое число 1–1000000'),
    body('gtin').optional().isLength({ min: 14, max: 14 }).withMessage('gtin: 14 символов'),
  ],
  validate,
  async (req, res, next) => {
    const { dealId, productCategory, codesCount, gtin } = req.body;

    logger.info(`[marking] /request dealId=${dealId} category=${productCategory} qty=${codesCount}`);

    try {
      // Запрос кодов (асинхронный процесс с polling)
      const { orderId, codes } = await codeManager.requestCodesForDeal({
        dealId: String(dealId),
        productCategory,
        codesCount: Number(codesCount),
        gtin,
      });

      // Генерация CSV-файла для производства
      const csvPath = await codeManager.generateProductionFile(String(dealId));

      // Уведомление оператора
      const { taskId } = await codeManager.notifyOperator(String(dealId), csvPath);

      return res.json({
        success: true,
        dealId,
        orderId,
        codesCount: codes.length,
        csvPath,
        taskId,
        message: 'Коды получены, CSV-файл сформирован, оператор уведомлён',
      });
    } catch (err) {
      logger.error(`[marking] /request ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/status/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/status/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const entry = codeManager.getEntry(dealId);

    if (!entry) {
      return res.status(404).json({ success: false, message: `Сделка ${dealId} не найдена` });
    }

    // Не возвращаем массив всех кодов (может быть большим) — только мета
    const { codes, appliedCodes, ...meta } = entry;
    return res.json({
      success: true,
      data: {
        ...meta,
        codesTotal: codes?.length ?? 0,
        appliedTotal: appliedCodes?.length ?? 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/marking/verify
// Оператор подтверждает нанесение кодов после печати.
// ---------------------------------------------------------------------------
router.post(
  '/verify',
  [
    body('dealId').notEmpty().withMessage('dealId обязателен'),
    body('codes').optional().isArray().withMessage('codes должен быть массивом'),
  ],
  validate,
  async (req, res, next) => {
    const { dealId, codes } = req.body;

    logger.info(`[marking] /verify dealId=${dealId} codes=${codes?.length ?? 'все'}`);

    try {
      const { reportId } = await codeManager.verifyCodesApplied(
        String(dealId),
        codes?.length ? codes : undefined
      );

      // Генерируем отчёты
      const entry = codeManager.getEntry(String(dealId));
      const appliedCodes = entry?.appliedCodes || entry?.codes || [];

      let clientReportPath = null;
      let fnsXmlPath = null;

      try {
        clientReportPath = await reporter.generateClientReport({
          dealId,
          dealTitle: `Сделка #${dealId}`,
          productCategory: entry?.productGroup || '',
          gtin: entry?.gtin || '',
          codes: appliedCodes,
          orderId: entry?.orderId,
        });
      } catch (e) {
        logger.warn(`[marking] Ошибка генерации HTML-отчёта: ${e.message}`);
      }

      try {
        fnsXmlPath = reporter.generateFnsXmlReport({
          dealId,
          dealTitle: `Сделка #${dealId}`,
          gtin: entry?.gtin || '',
          productCategory: entry?.productGroup || '',
          codes: appliedCodes,
          inn: config.mdlp.participantInn,
          orderId: entry?.orderId,
        });
      } catch (e) {
        logger.warn(`[marking] Ошибка генерации XML-отчёта: ${e.message}`);
      }

      return res.json({
        success: true,
        dealId,
        reportId,
        appliedCount: appliedCodes.length,
        clientReportUrl: clientReportPath
          ? `/reports/client_${dealId}.html`
          : null,
        fnsXmlPath,
        message: 'Факт нанесения зарегистрирован в ГИС МТ, отчёты сформированы',
      });
    } catch (err) {
      logger.error(`[marking] /verify ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/report/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/report/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const reportPath = path.join(config.storage.dataDir, 'reports', `client_${dealId}.html`);

    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ success: false, message: 'Отчёт не найден. Сначала выполните /verify' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="marking_report_${dealId}.html"`);
    fs.createReadStream(reportPath).pipe(res);
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/xml/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/xml/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const xmlPath = path.join(config.storage.dataDir, 'reports', `fns_${dealId}.xml`);

    if (!fs.existsSync(xmlPath)) {
      return res.status(404).json({ success: false, message: 'XML-отчёт не найден' });
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marking_fns_${dealId}.xml"`
    );
    fs.createReadStream(xmlPath).pipe(res);
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/monthly
// Ежемесячная сводка. Query: ?year=2025&month=5
// ---------------------------------------------------------------------------
router.get('/monthly', async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(422).json({ success: false, message: 'month должен быть 1–12' });
    }

    const reportPath = await reporter.generateMonthlySummary(year, month);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="monthly_${monthStr}.html"`);
    fs.createReadStream(reportPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/marking/shipment
// Регистрация факта отгрузки в ГИС МТ.
// ---------------------------------------------------------------------------
router.post(
  '/shipment',
  [body('dealId').notEmpty().withMessage('dealId обязателен')],
  validate,
  async (req, res, next) => {
    const { dealId } = req.body;
    logger.info(`[marking] /shipment dealId=${dealId}`);

    try {
      const { reportId } = await codeManager.registerDealShipment(String(dealId));
      return res.json({
        success: true,
        dealId,
        reportId,
        message: 'Отгрузка зарегистрирована в ГИС МТ',
      });
    } catch (err) {
      logger.error(`[marking] /shipment ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/marking/verify-codes
// Dry-run верификация структуры кодов DataMatrix (без обращения к ГИС МТ).
// ---------------------------------------------------------------------------
router.post(
  '/verify-codes',
  [body('codes').isArray({ min: 1 }).withMessage('codes: непустой массив строк')],
  validate,
  (req, res) => {
    const { codes } = req.body;
    const result = datamatrix.verifyCodes(codes);
    return res.json({ success: true, ...result });
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/codes/:dealId
// Список всех кодов для сделки (paginated).
// ---------------------------------------------------------------------------
router.get(
  '/codes/:dealId',
  [
    param('dealId').notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 10000 }),
  ],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;

    const entry = codeManager.getEntry(dealId);
    if (!entry) {
      return res.status(404).json({ success: false, message: `Сделка ${dealId} не найдена` });
    }

    const codes = entry.codes || [];
    const total = codes.length;
    const start = (page - 1) * limit;
    const paginated = codes.slice(start, start + limit);

    return res.json({
      success: true,
      dealId,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      codes: paginated,
    });
  }
);

module.exports = router;
```

---

## `src/routes/webhook.js`

```js
'use strict';

/**
 * webhook.js — Вебхук от Битрикс24
 *
 * POST /webhook/b24  — принимает события onCrmDealUpdate
 *
 * Логика:
 *  - STAGE_ID === BITRIX_STAGE_PRODUCTION && UF_CRM_MARKING_REQUIRED === true
 *      → Запросить коды ГИС МТ + сформировать CSV + уведомить оператора
 *
 *  - STAGE_ID === BITRIX_STAGE_SHIPMENT
 *      → Зарегистрировать отгрузку в ГИС МТ
 *
 * Б24 шлёт form-urlencoded (POST body), поэтому используем express.urlencoded.
 * Вебхуки не имеют стандартной HMAC-подписи в Б24, но в .env можно задать
 * WEBHOOK_SECRET для дополнительной защиты (сравнение query-параметра secret).
 */

const router = require('express').Router();
const config = require('../../config');
const logger = require('../utils/logger');
const codeManager = require('../services/codeManager');
const bitrix = require('../services/bitrix');

// ---------------------------------------------------------------------------
// Middleware: проверка опционального секрета
// ---------------------------------------------------------------------------
router.use((req, res, next) => {
  const secret = config.security.webhookSecret;
  if (!secret) return next(); // секрет не настроен — пропускаем

  const provided = req.query.secret || req.body?.secret;
  if (provided !== secret) {
    logger.warn(`[webhook] Неверный секрет от ${req.ip}`);
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
});

// ---------------------------------------------------------------------------
// POST /webhook/b24
// ---------------------------------------------------------------------------
router.post('/b24', async (req, res) => {
  // Б24 шлёт данные как form-urlencoded или JSON в зависимости от версии
  const body = req.body || {};

  logger.debug(`[webhook] Получено событие: ${JSON.stringify(body).substring(0, 300)}`);

  // Битрикс24 передаёт данные с префиксами: data[FIELDS][ID] и т.п.
  // Нормализуем для удобства:
  const event = body.event || '';
  const dealId =
    body?.data?.FIELDS?.ID ||
    body?.['data[FIELDS][ID]'] ||
    body?.FIELDS?.ID ||
    '';
  const stageId =
    body?.data?.FIELDS?.STAGE_ID ||
    body?.['data[FIELDS][STAGE_ID]'] ||
    body?.FIELDS?.STAGE_ID ||
    '';

  logger.info(`[webhook] Событие: ${event}, dealId: ${dealId}, stageId: ${stageId}`);

  if (!event || !dealId) {
    return res.status(200).json({ success: true, message: 'Нет данных для обработки' });
  }

  // Б24 ожидает ответ в течение ~3 секунд, поэтому отвечаем немедленно,
  // а обработку запускаем асинхронно.
  res.status(200).json({ success: true, message: 'Принято в обработку' });

  // Асинхронная обработка
  setImmediate(async () => {
    try {
      await handleDealUpdate(dealId, stageId, event);
    } catch (err) {
      logger.error(`[webhook] Ошибка обработки события ${event} для сделки ${dealId}: ${err.message}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Основная логика обработки события обновления сделки
// ---------------------------------------------------------------------------
async function handleDealUpdate(dealId, stageId, event) {
  const { production, shipment } = config.bitrix.stages;

  // --- Случай 1: Переход на стадию «Производство» ---
  if (stageId === production) {
    logger.info(`[webhook] Сделка ${dealId} → стадия Производство`);
    await handleProductionStage(dealId);
    return;
  }

  // --- Случай 2: Переход на стадию «Отгрузка» ---
  if (stageId === shipment) {
    logger.info(`[webhook] Сделка ${dealId} → стадия Отгрузка`);
    await handleShipmentStage(dealId);
    return;
  }

  logger.debug(`[webhook] Стадия ${stageId} не требует действий маркировки`);
}

// ---------------------------------------------------------------------------
// Стадия «Производство» — запуск процесса маркировки
// ---------------------------------------------------------------------------
async function handleProductionStage(dealId) {
  // Читаем поля маркировки из Б24
  const fields = await bitrix.getDealMarkingFields(dealId);

  logger.info(
    `[webhook] Поля сделки ${dealId}: markingRequired=${fields.markingRequired}, ` +
    `category=${fields.productCategory}, qty=${fields.codesCount}`
  );

  if (!fields.markingRequired) {
    logger.info(`[webhook] Маркировка не требуется для сделки ${dealId}`);
    return;
  }

  if (fields.codesCount < 1) {
    logger.warn(`[webhook] Сделка ${dealId}: UF_CRM_MARKING_CODES_COUNT = 0, пропускаем`);
    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `⚠️ Сделка #${dealId}: маркировка требуется, но количество кодов не указано`
    );
    return;
  }

  // Проверяем — не запущен ли процесс уже (идемпотентность)
  const existing = codeManager.getEntry(dealId);
  if (existing && ['CODES_READY', 'IN_PRODUCTION', 'VERIFIED', 'SHIPPED'].includes(existing.status)) {
    logger.info(`[webhook] Маркировка для сделки ${dealId} уже в статусе ${existing.status}, пропускаем`);
    return;
  }

  // Запрос кодов + CSV + уведомление оператора
  const { orderId, codes } = await codeManager.requestCodesForDeal({
    dealId: String(dealId),
    productCategory: fields.productCategory,
    codesCount: fields.codesCount,
  });

  const csvPath = await codeManager.generateProductionFile(String(dealId));

  await codeManager.notifyOperator(String(dealId), csvPath);

  logger.info(
    `[webhook] Сделка ${dealId}: маркировка запущена, orderId=${orderId}, кодов=${codes.length}`
  );
}

// ---------------------------------------------------------------------------
// Стадия «Отгрузка» — регистрация отгрузки в ГИС МТ
// ---------------------------------------------------------------------------
async function handleShipmentStage(dealId) {
  const existing = codeManager.getEntry(dealId);

  if (!existing) {
    logger.info(`[webhook] Сделка ${dealId} не проходила маркировку — пропускаем отгрузку`);
    return;
  }

  if (existing.status === 'SHIPPED') {
    logger.info(`[webhook] Отгрузка для сделки ${dealId} уже зарегистрирована`);
    return;
  }

  if (!['VERIFIED', 'CODES_READY', 'IN_PRODUCTION'].includes(existing.status)) {
    logger.warn(
      `[webhook] Сделка ${dealId}: неожиданный статус ${existing.status} при отгрузке`
    );
  }

  try {
    const { reportId } = await codeManager.registerDealShipment(String(dealId));
    logger.info(`[webhook] Отгрузка сделки ${dealId} зарегистрирована: reportId=${reportId}`);

    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `📦 Сделка #${dealId}: отгрузка зарегистрирована в ГИС МТ (ID: ${reportId})`
    );
  } catch (err) {
    logger.error(`[webhook] Ошибка регистрации отгрузки для сделки ${dealId}: ${err.message}`);

    // Уведомляем оператора об ошибке
    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `❌ Сделка #${dealId}: ОШИБКА регистрации отгрузки в ГИС МТ — ${err.message}`
    ).catch(() => {});
  }
}

module.exports = router;
```

---

## `README.md`

```markdown
# FLEX-N-ROLL PRO — Модуль интеграции с «Честный ЗНАК»

Сервис интеграции CRM Битрикс24 с системой маркировки «Честный ЗНАК» (ГИС МТ).  
Типография FLEX-N-ROLL PRO является **партнёром** Честного ЗНАКа и наносит DataMatrix-коды на продукцию клиентов.

---

## Стек технологий

| Компонент | Технология |
|---|---|
| Runtime | Node.js ≥ 18 |
| HTTP-сервер | Express 4 |
| HTTP-клиент | axios |
| Валидация | express-validator |
| Планировщик | node-cron |
| QR-коды | qrcode |
| ZIP | unzipper |
| Логи | winston + morgan |

---

## Структура проекта

```
flex-n-roll-marking/
├── src/
│   ├── server.js                  # Express-приложение, планировщик
│   ├── services/
│   │   ├── mdlp.js                # ГИС МТ / ЧЗ API (OAuth, эмиссия, применение, отгрузка)
│   │   ├── bitrix.js              # Битрикс24 REST API клиент
│   │   └── codeManager.js         # Оркестратор: полный цикл управления кодами
│   ├── routes/
│   │   ├── marking.js             # REST endpoints маркировки
│   │   └── webhook.js             # Вебхук от Б24 (onCrmDealUpdate)
│   └── utils/
│       ├── datamatrix.js          # Парсинг/верификация DM-кодов GS1
│       ├── reporter.js            # Генерация HTML/XML/summary отчётов
│       └── logger.js              # Winston-логгер
├── config.js                      # Централизованная конфигурация
├── package.json
├── .env.example                   # Шаблон переменных окружения
└── README.md
```

---

## Быстрый старт

```bash
# 1. Клонировать и установить зависимости
npm install

# 2. Создать файл окружения
cp .env.example .env
# Заполнить .env реальными значениями

# 3. Запустить в режиме разработки
npm run dev

# 4. Запустить в production
npm start
```

---

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `MDLP_CLIENT_ID` | ✅ | Client ID OAuth2 ГИС МТ |
| `MDLP_CLIENT_SECRET` | ✅ | Client Secret OAuth2 ГИС МТ |
| `MDLP_BASE_URL` | | Base URL ГИС МТ (default: api.mdlp.crpt.ru) |
| `MDLP_PARTICIPANT_INN` | | ИНН партнёра ЧЗ |
| `MDLP_DEFAULT_GTIN` | | GTIN по умолчанию |
| `BITRIX_WEBHOOK_URL` | ✅ | Входящий вебхук Б24 с токеном |
| `BITRIX_STAGE_PRODUCTION` | | ID стадии «Производство» |
| `BITRIX_STAGE_SHIPMENT` | | ID стадии «Отгрузка» |
| `BITRIX_OPERATOR_USER_ID` | | ID оператора маркировки в Б24 |
| `DATA_DIR` | | Директория хранилища |
| `WEBHOOK_SECRET` | | Секрет для защиты вебхука |

---

## Поля сделки в Б24 (UF_CRM_*)

Создайте пользовательские поля в разделе **CRM → Настройки → Пользовательские поля → Сделки**:

| Поле | Тип | Описание |
|---|---|---|
| `UF_CRM_MARKING_REQUIRED` | Да/Нет | Требуется ли маркировка |
| `UF_CRM_PRODUCT_CATEGORY` | Строка | молочная / фармацевтика / табак / обувь |
| `UF_CRM_MARKING_CODES_COUNT` | Число | Количество кодов DataMatrix |
| `UF_CRM_MARKING_STATUS` | Строка | Статус (заполняется сервисом) |
| `UF_CRM_MARKING_ORDER_ID` | Строка | ID заявки в ГИС МТ |
| `UF_CRM_MARKING_REPORT_ID` | Строка | ID отчёта о нанесении |
| `UF_CRM_MARKING_SHIP_ID` | Строка | ID документа об отгрузке |

---

## API Endpoints

### Маркировка — `/api/marking`

#### `POST /api/marking/request`
Запрашивает коды DataMatrix у ГИС МТ, формирует CSV и уведомляет оператора.

```json
// Запрос
{
  "dealId": "12345",
  "productCategory": "молочная",
  "codesCount": 500,
  "gtin": "04607123456781"   // опционально
}

// Ответ
{
  "success": true,
  "dealId": "12345",
  "orderId": "abc-123",
  "codesCount": 500,
  "csvPath": "/data/production/orders/12345/codes.csv",
  "taskId": 42
}
```

#### `GET /api/marking/status/:dealId`
Возвращает текущий статус маркировки для сделки.

```
Статусы: PENDING → CODES_READY → IN_PRODUCTION → VERIFIED → SHIPPED
```

#### `POST /api/marking/verify`
Оператор подтверждает нанесение кодов. Регистрирует факт в ГИС МТ, генерирует отчёты.

```json
// Запрос
{
  "dealId": "12345",
  "codes": ["01046...21AB...", "..."]  // опционально; если не указан — берёт все из БД
}
```

#### `GET /api/marking/report/:dealId`
Возвращает HTML-отчёт для клиента с QR-кодами нанесённых кодов.

#### `GET /api/marking/xml/:dealId`
Возвращает XML-отчёт для налоговых органов (скачивание).

#### `GET /api/marking/monthly?year=2025&month=6`
Ежемесячная сводка по категориям (HTML).

#### `POST /api/marking/shipment`
Принудительная регистрация отгрузки в ГИС МТ.

```json
{ "dealId": "12345" }
```

#### `POST /api/marking/verify-codes`
Dry-run валидация структуры DataMatrix-кодов (без обращения к ГИС МТ).

```json
{ "codes": ["01046...21AB..."] }
```

#### `GET /api/marking/codes/:dealId?page=1&limit=100`
Пагинированный список кодов для сделки.

---

### Вебхук — `/webhook`

#### `POST /webhook/b24`
Принимает события `onCrmDealUpdate` от Битрикс24.

**Настройка в Б24:**  
CRM → Настройки → Вебхуки → Исходящие → URL: `https://your-domain/webhook/b24`  
События: `onCrmDealUpdate`

**Опциональная защита:**  
Добавьте `?secret=YOUR_WEBHOOK_SECRET` к URL вебхука и задайте `WEBHOOK_SECRET` в `.env`.

**Автоматические действия:**

| Стадия | Действие |
|---|---|
| `BITRIX_STAGE_PRODUCTION` + `UF_CRM_MARKING_REQUIRED=Y` | Запрос кодов ГИС МТ → CSV → задача оператору |
| `BITRIX_STAGE_SHIPMENT` | Регистрация отгрузки в ГИС МТ |

---

## Жизненный цикл маркировки

```
Сделка в Б24
    │
    ▼ STAGE: Производство + MARKING_REQUIRED=Y
[Вебхук /webhook/b24]
    │
    ├─→ [mdlp] POST /codes/emissionOrder  ← создание заявки
    ├─→ [mdlp] Polling статуса заявки
    ├─→ [mdlp] GET /codes/emissionOrder/{id}/file  ← скачивание ZIP
    ├─→ [codeManager] Парсинг ZIP → сохранение кодов в codes_db.json
    ├─→ [codeManager] Генерация CSV /production/orders/{dealId}/codes.csv
    └─→ [bitrix] Задача оператору + прикрепление CSV + уведомление

Оператор печатает DataMatrix-коды на типографском оборудовании
    │
    ▼ POST /api/marking/verify
[marking.js]
    ├─→ [mdlp] POST /codes/applied  ← регистрация нанесения
    ├─→ [reporter] HTML-отчёт для клиента
    └─→ [reporter] XML-отчёт ФНС

    │
    ▼ STAGE: Отгрузка
[Вебхук /webhook/b24]
    └─→ [mdlp] POST /documents/create (type=415)  ← регистрация отгрузки
```

---

## Хранилище данных

```
data/
├── codes_db.json              # JSON-«база» кодов по сделкам
├── logs/
│   ├── combined.log
│   └── error.log
├── production/
│   └── orders/
│       └── {dealId}/
│           └── codes.csv      # Файл задания для оборудования
└── reports/
    ├── client_{dealId}.html   # HTML-отчёт с QR для клиента
    ├── fns_{dealId}.xml       # XML-отчёт ФНС
    └── monthly_YYYY-MM.html   # Ежемесячная сводка
```

### Структура записи codes_db.json

```json
{
  "12345": {
    "dealId": "12345",
    "orderId": "abc-order-123",
    "gtin": "04607123456781",
    "productGroup": "milk",
    "codesCount": 500,
    "codes": ["01046...", "..."],
    "status": "VERIFIED",
    "createdAt": "2025-06-01T10:00:00Z",
    "codesReadyAt": "2025-06-01T10:05:00Z",
    "appliedAt": "2025-06-01T14:30:00Z",
    "appliedCodes": ["01046...", "..."],
    "reportId": "rpt-abc-123",
    "taskId": 42
  }
}
```

### Формат CSV-файла производственного задания

```csv
serial_number,datamatrix_code,order_id
000001,010460712345678121ABCDEF...,B24-12345
000002,010460712345678121GHIJKL...,B24-12345
```

---

## Формат DataMatrix-кода ЧЗ (GS1)

```
01{GTIN-14}21{SerialNumber}\x1d91{CryptoKey}\x1d92{CryptoSignature}
```

Пример:  
`010460123456781221A1B2C3D4\x1d9100001\x1d92xxxxxxxxxxxx`

- AI `01` — GTIN-14  
- AI `21` — серийный номер  
- AI `91` — ключ проверки (Честный ЗНАК)  
- AI `92` — криптографическая подпись  
- `\x1d` — разделитель групп GS1 (ASCII 29)

---

## Ежемесячный планировщик

Каждое 1-е число месяца в 08:00 автоматически формируется HTML-сводка за предыдущий месяц.  
Файл сохраняется в `data/reports/monthly_YYYY-MM.html`.  
Доступен по URL: `GET /api/marking/monthly?year=YYYY&month=MM`

---

## Логирование

Уровни: `debug → info → warn → error`  
Файлы: `data/logs/combined.log` (все) и `data/logs/error.log` (только ошибки).  
В production уровень автоматически поднимается до `info`.

---

## Безопасность

- Вебхук защищается параметром `?secret=` (опционально, через `WEBHOOK_SECRET`)
- Токен ГИС МТ кешируется и обновляется за 60 секунд до истечения
- Credentials хранятся только в `.env`, не коммитятся в репозиторий

---

## Диагностика

```bash
# Проверка конфигурации
curl http://localhost:3000/health

# Проверка токена ГИС МТ
node -e "require('./src/services/mdlp').getAccessToken().then(console.log)"

# Список UF-полей сделок Б24
node -e "require('./src/services/bitrix').listDealUserFields().then(f => console.log(f.join('\n')))"
```
```

---

---

## МОДУЛЬ ДОП — КАЛЬКУЛЯТОР ЭТИКЕТОК (React + TypeScript)

> **Промт для Claude Code CLI:**  
> "Создай React/TypeScript проект `flex-n-roll-calculator` по следующей структуре. Создай все файлы с полным кодом."

# Калькулятор этикеток flex-n-roll.pro — Полный исходный код

> React 18 · TypeScript · Tailwind CSS · Vite · axios · Node.js/Express · Битрикс24 CRM

---

## Структура проекта

```
flex-n-roll-calculator/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Calculator.tsx      # Главный wizard-компонент
│   │   ├── StepOne.tsx         # Тип + материал
│   │   ├── StepTwo.tsx         # Размеры + форма + цвета
│   │   ├── StepThree.tsx       # Отделка + тираж + макет
│   │   ├── PriceResult.tsx     # Результат расчёта
│   │   └── LeadForm.tsx        # Форма заявки → Б24
│   ├── hooks/
│   │   ├── useCalculator.ts    # Логика расчёта и состояние шагов
│   │   └── useBitrix.ts        # Интеграция с Б24
│   ├── types/
│   │   └── calculator.ts       # TypeScript типы
│   ├── data/
│   │   └── pricing.ts          # Справочник цен и лейблов
│   └── utils/
│       └── priceCalc.ts        # Функции расчёта
├── server.js                   # Node.js/Express бэкенд-прокси
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
└── .env.example
```

---

## `src/types/calculator.ts`

```typescript
// src/types/calculator.ts
// Типы TypeScript для калькулятора этикеток flex-n-roll.pro

// ─── Тип этикетки ───────────────────────────────────────────────────────────
export type LabelType =
  | 'self_adhesive'  // Самоклеящаяся
  | 'sleeve'         // Sleeve (термоусадочная гильза)
  | 'ar'             // AR (дополненная реальность)
  | 'thermochrome'   // Термохром (меняет цвет при температуре)
  | 'linerless';     // Linerless (без подложки)

// ─── Материал ───────────────────────────────────────────────────────────────
export type Material =
  | 'semi_gloss'  // Бумага Semi Gloss
  | 'pe'          // PE (полиэтилен)
  | 'pet'         // PET (полиэтилентерефталат)
  | 'bopp'        // BOPP (двухосноориентированный полипропилен)
  | 'pp_white'    // PP White (белый полипропилен)
  | 'pp_silver'   // PP Silver (серебристый полипропилен)
  | 'pp_clear'    // PP Clear (прозрачный полипропилен)
  | 'aluminum';   // Алюминий

// ─── Форма высечки ──────────────────────────────────────────────────────────
export type CutShape =
  | 'rectangle'  // Прямоугольник
  | 'circle'     // Круг
  | 'oval'       // Овал
  | 'contour';   // По контуру

// ─── Специальная отделка ────────────────────────────────────────────────────
export type Finishing =
  | 'foil_stamping'  // Тиснение фольгой
  | 'matte_lam'      // Ламинация матовая
  | 'gloss_lam'      // Ламинация глянцевая
  | 'uv_varnish'     // УФ-лак полный
  | 'spot_varnish'   // Выборочный лак
  | 'none';          // Без отделки

// ─── Тираж ──────────────────────────────────────────────────────────────────
export type Circulation =
  | 1000
  | 2000
  | 5000
  | 10000
  | 25000
  | 50000
  | 100000
  | 500000
  | 1000000;

// ─── Состояние формы калькулятора ───────────────────────────────────────────
export interface CalculatorFormState {
  // Шаг 1
  labelType: LabelType | null;
  material: Material | null;

  // Шаг 2
  width: number;         // мм
  height: number;        // мм
  cutShape: CutShape | null;
  colors: number;        // 1–12

  // Шаг 3
  finishing: Finishing[];       // мультиселект
  circulation: Circulation | null;
  hasDesign: boolean | null;    // true = готовый макет, false = нужна разработка
}

// ─── Результат расчёта ──────────────────────────────────────────────────────
export interface PriceCalculationResult {
  baseCost: number;         // Базовая стоимость (до скидок)
  colorSurcharge: number;   // Надбавка за цвета сверх 4
  finishingCost: number;    // Стоимость финишинга
  setupCost: number;        // Стоимость подготовки ($200)
  designCost: number;       // Стоимость разработки макета ($150 если нет)
  subtotal: number;         // Итого до скидки
  discountRate: number;     // Процент скидки (0–20)
  discountAmount: number;   // Сумма скидки
  totalCost: number;        // Итоговая стоимость
  pricePerThousand: number; // Цена за 1000 шт.
  productionDays: string;   // Срок производства
}

// ─── Данные лида для Битрикс24 ──────────────────────────────────────────────
export interface LeadFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
}

// ─── Полный payload для отправки лида ───────────────────────────────────────
export interface BitrixLeadPayload {
  formData: LeadFormData;
  calculatorData: CalculatorFormState;
  result: PriceCalculationResult;
}

// ─── Ответ от API бэкенда ───────────────────────────────────────────────────
export interface BitrixApiResponse {
  success: boolean;
  leadId?: number;
  error?: string;
}

// ─── Текущий шаг визарда ────────────────────────────────────────────────────
export type WizardStep = 1 | 2 | 3 | 'result';
```

---

## `src/data/pricing.ts`

```typescript
// src/data/pricing.ts
// Справочник цен и конфигурации для калькулятора этикеток flex-n-roll.pro

import type {
  LabelType,
  Material,
  CutShape,
  Finishing,
  Circulation,
} from '../types/calculator';

// ─── Отображаемые названия ──────────────────────────────────────────────────

export const LABEL_TYPE_LABELS: Record<LabelType, string> = {
  self_adhesive: 'Самоклеящаяся',
  sleeve: 'Sleeve (гильза)',
  ar: 'AR-этикетка',
  thermochrome: 'Термохром',
  linerless: 'Linerless',
};

export const MATERIAL_LABELS: Record<Material, string> = {
  semi_gloss: 'Бумага Semi Gloss',
  pe: 'PE (полиэтилен)',
  pet: 'PET',
  bopp: 'BOPP',
  pp_white: 'PP White',
  pp_silver: 'PP Silver',
  pp_clear: 'PP Clear',
  aluminum: 'Алюминий',
};

export const CUT_SHAPE_LABELS: Record<CutShape, string> = {
  rectangle: 'Прямоугольник',
  circle: 'Круг',
  oval: 'Овал',
  contour: 'По контуру',
};

export const FINISHING_LABELS: Record<Finishing, string> = {
  foil_stamping: 'Тиснение фольгой',
  matte_lam: 'Ламинация мат',
  gloss_lam: 'Ламинация глянец',
  uv_varnish: 'УФ-лак (полный)',
  spot_varnish: 'Выборочный лак',
  none: 'Без отделки',
};

export const CIRCULATION_LABELS: Record<number, string> = {
  1000: '1 000 шт.',
  2000: '2 000 шт.',
  5000: '5 000 шт.',
  10000: '10 000 шт.',
  25000: '25 000 шт.',
  50000: '50 000 шт.',
  100000: '100 000 шт.',
  500000: '500 000 шт.',
  1000000: '1 000 000+ шт.',
};

// ─── Базовые цены материалов ($/кг) ─────────────────────────────────────────
// Используются для расчёта базовой стоимости с учётом площади этикетки
// Формула: base_material_cost[material] * (width * height / 1_000_000) * circulation
export const MATERIAL_BASE_COST: Record<Material, number> = {
  semi_gloss: 1.2,    // Бумага Semi Gloss — $1.2/кг
  pe: 2.1,            // Полиэтилен — $2.1/кг
  pet: 2.4,           // PET — $2.4/кг
  bopp: 1.9,          // BOPP — $1.9/кг
  pp_white: 2.0,      // PP White — $2.0/кг
  pp_silver: 2.5,     // PP Silver — $2.5/кг
  pp_clear: 2.2,      // PP Clear — $2.2/кг
  aluminum: 3.5,      // Алюминий — $3.5/кг
};

// ─── Стоимость специальной отделки ($/шт.) ──────────────────────────────────
export const FINISHING_COST: Record<Finishing, number> = {
  foil_stamping: 0.05,   // Тиснение фольгой — $0.05/шт.
  matte_lam: 0.02,       // Ламинация мат — $0.02/шт.
  gloss_lam: 0.02,       // Ламинация глянец — $0.02/шт.
  uv_varnish: 0.015,     // УФ-лак полный — $0.015/шт.
  spot_varnish: 0.025,   // Выборочный лак — $0.025/шт.
  none: 0.0,             // Без отделки — бесплатно
};

// ─── Надбавка за цвет (на единицу цвета сверх 4) ────────────────────────────
export const COLOR_SURCHARGE_RATE = 0.1; // +10% к базе за каждый цвет свыше 4

// ─── Стоимость подготовки (препресс, печатные формы) ────────────────────────
export const SETUP_COST = 200; // $200 — фиксированная

// ─── Стоимость разработки макета ────────────────────────────────────────────
export const DESIGN_COST = 150; // $150 — если нет готового макета

// ─── Скидки по тиражу ───────────────────────────────────────────────────────
// Ключ: минимальный тираж для применения скидки
export const CIRCULATION_DISCOUNTS: Array<{ minQty: number; discount: number }> = [
  { minQty: 100000, discount: 0.20 }, // 100 000+ → -20%
  { minQty: 50000, discount: 0.15 },  // 50 000+  → -15%
  { minQty: 10000, discount: 0.10 },  // 10 000+  → -10%
  { minQty: 5000, discount: 0.05 },   // 5 000+   → -5%
];

// ─── Срок производства (дней) ────────────────────────────────────────────────
export function getProductionDays(circulation: number): string {
  if (circulation <= 5000) return '5–7 рабочих дней';
  if (circulation <= 25000) return '7–10 рабочих дней';
  if (circulation <= 100000) return '10–14 рабочих дней';
  return '14–21 рабочий день';
}

// ─── Доступные тиражи ────────────────────────────────────────────────────────
export const CIRCULATION_OPTIONS: Circulation[] = [
  1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000,
];

// ─── Все типы этикеток ───────────────────────────────────────────────────────
export const LABEL_TYPE_OPTIONS: LabelType[] = [
  'self_adhesive',
  'sleeve',
  'ar',
  'thermochrome',
  'linerless',
];

// ─── Все материалы ──────────────────────────────────────────────────────────
export const MATERIAL_OPTIONS: Material[] = [
  'semi_gloss',
  'pe',
  'pet',
  'bopp',
  'pp_white',
  'pp_silver',
  'pp_clear',
  'aluminum',
];

// ─── Формы высечки ──────────────────────────────────────────────────────────
export const CUT_SHAPE_OPTIONS: CutShape[] = [
  'rectangle',
  'circle',
  'oval',
  'contour',
];

// ─── Все виды отделки ───────────────────────────────────────────────────────
export const FINISHING_OPTIONS: Finishing[] = [
  'foil_stamping',
  'matte_lam',
  'gloss_lam',
  'uv_varnish',
  'spot_varnish',
  'none',
];

// ─── Иконки/эмоджи для типов этикеток (для UI) ──────────────────────────────
export const LABEL_TYPE_ICONS: Record<LabelType, string> = {
  self_adhesive: '🏷️',
  sleeve: '🧴',
  ar: '📱',
  thermochrome: '🌡️',
  linerless: '♻️',
};

// ─── Описания типов этикеток ─────────────────────────────────────────────────
export const LABEL_TYPE_DESCRIPTIONS: Record<LabelType, string> = {
  self_adhesive: 'Классические этикетки на клеевой основе для любых поверхностей',
  sleeve: 'Термоусадочные гильзы для бутылок и контейнеров нестандартной формы',
  ar: 'Этикетки с AR-маркером для интерактивного взаимодействия через смартфон',
  thermochrome: 'Этикетки с термочувствительными чернилами — меняют цвет при нагреве',
  linerless: 'Этикетки без подложки — экологичные и экономичные для высоких тиражей',
};
```

---

## `src/utils/priceCalc.ts`

```typescript
// src/utils/priceCalc.ts
// Функции расчёта стоимости этикеток для flex-n-roll.pro

import type { CalculatorFormState, PriceCalculationResult } from '../types/calculator';
import {
  MATERIAL_BASE_COST,
  FINISHING_COST,
  COLOR_SURCHARGE_RATE,
  SETUP_COST,
  DESIGN_COST,
  CIRCULATION_DISCOUNTS,
  getProductionDays,
} from '../data/pricing';

/**
 * Основная функция расчёта стоимости заказа.
 * Принимает состояние формы, возвращает детальный результат.
 */
export function calculatePrice(state: CalculatorFormState): PriceCalculationResult | null {
  // Проверяем, что все необходимые поля заполнены
  if (
    !state.labelType ||
    !state.material ||
    !state.cutShape ||
    !state.circulation ||
    state.hasDesign === null ||
    state.width < 20 ||
    state.height < 20
  ) {
    return null;
  }

  const { material, width, height, colors, finishing, circulation, hasDesign } = state;

  // ── 1. Базовая стоимость материала ────────────────────────────────────────
  // Формула: базовая_цена_материала * (ширина_мм * высота_мм / 1_000_000) * тираж
  // Делим на 1 000 000, чтобы перевести мм² → м²
  const materialCostPerUnit = MATERIAL_BASE_COST[material] * (width * height) / 1_000_000;
  const baseCost = materialCostPerUnit * circulation;

  // ── 2. Надбавка за цвета (сверх 4 базовых) ───────────────────────────────
  // За каждый цвет свыше 4 добавляем 10% от базовой стоимости
  const extraColors = Math.max(0, colors - 4);
  const colorSurcharge = baseCost * COLOR_SURCHARGE_RATE * extraColors;

  // ── 3. Стоимость финишинга ────────────────────────────────────────────────
  // Суммируем стоимость каждого вида отделки ($/шт. × тираж)
  // Исключаем 'none' — нулевая стоимость
  const activeFinishing = finishing.filter((f) => f !== 'none');
  const finishingCostPerUnit = activeFinishing.reduce(
    (sum, f) => sum + FINISHING_COST[f],
    0
  );
  const finishingCost = finishingCostPerUnit * circulation;

  // ── 4. Стоимость подготовки (фиксированная) ───────────────────────────────
  const setupCost = SETUP_COST; // $200

  // ── 5. Стоимость разработки макета (если нет готового) ───────────────────
  const designCost = hasDesign ? 0 : DESIGN_COST; // $150

  // ── 6. Подытог до скидки ─────────────────────────────────────────────────
  const subtotal = baseCost + colorSurcharge + finishingCost + setupCost + designCost;

  // ── 7. Скидка по тиражу ──────────────────────────────────────────────────
  // Ищем максимальную применимую скидку (массив отсортирован по убыванию minQty)
  const applicableDiscount = CIRCULATION_DISCOUNTS.find(
    (d) => circulation >= d.minQty
  );
  const discountRate = applicableDiscount ? applicableDiscount.discount : 0;
  const discountAmount = subtotal * discountRate;

  // ── 8. Итоговая стоимость ─────────────────────────────────────────────────
  const totalCost = subtotal - discountAmount;

  // ── 9. Цена за 1000 шт. ──────────────────────────────────────────────────
  const pricePerThousand = totalCost / (circulation / 1000);

  // ── 10. Срок производства ─────────────────────────────────────────────────
  const productionDays = getProductionDays(circulation);

  return {
    baseCost: roundTo2(baseCost),
    colorSurcharge: roundTo2(colorSurcharge),
    finishingCost: roundTo2(finishingCost),
    setupCost: roundTo2(setupCost),
    designCost: roundTo2(designCost),
    subtotal: roundTo2(subtotal),
    discountRate: discountRate * 100, // Переводим в проценты для отображения
    discountAmount: roundTo2(discountAmount),
    totalCost: roundTo2(totalCost),
    pricePerThousand: roundTo2(pricePerThousand),
    productionDays,
  };
}

/** Округление до 2 знаков после запятой */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Форматирование числа как денежной суммы (USD)
 * Пример: 1234.5 → "$1,234.50"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Форматирование числа с разделителями тысяч
 * Пример: 1000000 → "1 000 000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

/**
 * Проверка валидности размеров этикетки
 */
export function validateDimensions(width: number, height: number): string | null {
  if (width < 20) return 'Минимальная ширина — 20 мм';
  if (width > 200) return 'Максимальная ширина — 200 мм';
  if (height < 20) return 'Минимальная высота — 20 мм';
  if (height > 300) return 'Максимальная высота — 300 мм';
  return null;
}

/**
 * Определяет, можно ли перейти к следующему шагу
 */
export function canProceedFromStep(step: number, state: CalculatorFormState): boolean {
  if (step === 1) {
    return state.labelType !== null && state.material !== null;
  }
  if (step === 2) {
    return (
      state.width >= 20 &&
      state.width <= 200 &&
      state.height >= 20 &&
      state.height <= 300 &&
      state.cutShape !== null &&
      state.colors >= 1 &&
      state.colors <= 12
    );
  }
  if (step === 3) {
    return state.circulation !== null && state.hasDesign !== null;
  }
  return false;
}
```

---

## `src/hooks/useCalculator.ts`

```typescript
// src/hooks/useCalculator.ts
// Хук управления состоянием калькулятора и логикой переходов между шагами

import { useState, useCallback } from 'react';
import type {
  CalculatorFormState,
  PriceCalculationResult,
  WizardStep,
  LabelType,
  Material,
  CutShape,
  Finishing,
  Circulation,
} from '../types/calculator';
import { calculatePrice, canProceedFromStep } from '../utils/priceCalc';

// Начальное состояние формы
const INITIAL_STATE: CalculatorFormState = {
  labelType: null,
  material: null,
  width: 100,          // мм — значение по умолчанию
  height: 150,         // мм — значение по умолчанию
  cutShape: null,
  colors: 4,           // 4 цвета — самый распространённый вариант
  finishing: [],
  circulation: null,
  hasDesign: null,
};

interface UseCalculatorReturn {
  formState: CalculatorFormState;
  currentStep: WizardStep;
  result: PriceCalculationResult | null;
  canProceed: boolean;
  setLabelType: (type: LabelType) => void;
  setMaterial: (material: Material) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setCutShape: (shape: CutShape) => void;
  setColors: (colors: number) => void;
  toggleFinishing: (finishing: Finishing) => void;
  setCirculation: (circulation: Circulation) => void;
  setHasDesign: (hasDesign: boolean) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: WizardStep) => void;
  resetCalculator: () => void;
}

export function useCalculator(): UseCalculatorReturn {
  const [formState, setFormState] = useState<CalculatorFormState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [result, setResult] = useState<PriceCalculationResult | null>(null);

  const canProceed =
    typeof currentStep === 'number'
      ? canProceedFromStep(currentStep, formState)
      : false;

  const setLabelType = useCallback((type: LabelType) => {
    setFormState((prev) => ({ ...prev, labelType: type }));
  }, []);

  const setMaterial = useCallback((material: Material) => {
    setFormState((prev) => ({ ...prev, material }));
  }, []);

  const setWidth = useCallback((width: number) => {
    setFormState((prev) => ({ ...prev, width }));
  }, []);

  const setHeight = useCallback((height: number) => {
    setFormState((prev) => ({ ...prev, height }));
  }, []);

  const setCutShape = useCallback((cutShape: CutShape) => {
    setFormState((prev) => ({ ...prev, cutShape }));
  }, []);

  const setColors = useCallback((colors: number) => {
    setFormState((prev) => ({ ...prev, colors: Math.min(12, Math.max(1, colors)) }));
  }, []);

  /**
   * Переключение финишинга (мультиселект).
   * Если 'none' выбирается — снимаем все остальные.
   * Если выбирается что-то другое — снимаем 'none'.
   */
  const toggleFinishing = useCallback((finishing: Finishing) => {
    setFormState((prev) => {
      const current = prev.finishing;

      if (finishing === 'none') {
        return { ...prev, finishing: ['none'] };
      }

      const withoutNone = current.filter((f) => f !== 'none');

      if (withoutNone.includes(finishing)) {
        const updated = withoutNone.filter((f) => f !== finishing);
        return { ...prev, finishing: updated.length === 0 ? ['none'] : updated };
      } else {
        return { ...prev, finishing: [...withoutNone, finishing] };
      }
    });
  }, []);

  const setCirculation = useCallback((circulation: Circulation) => {
    setFormState((prev) => ({ ...prev, circulation }));
  }, []);

  const setHasDesign = useCallback((hasDesign: boolean) => {
    setFormState((prev) => ({ ...prev, hasDesign }));
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 3;
      if (prev === 3) {
        // Выполняем расчёт при переходе к результату
        const calculatedResult = calculatePrice(formState);
        setResult(calculatedResult);
        return 'result';
      }
      return prev;
    });
  }, [formState]);

  const goToPrevStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 'result') return 3;
      if (prev === 3) return 2;
      if (prev === 2) return 1;
      return prev;
    });
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const resetCalculator = useCallback(() => {
    setFormState(INITIAL_STATE);
    setCurrentStep(1);
    setResult(null);
  }, []);

  return {
    formState,
    currentStep,
    result,
    canProceed,
    setLabelType,
    setMaterial,
    setWidth,
    setHeight,
    setCutShape,
    setColors,
    toggleFinishing,
    setCirculation,
    setHasDesign,
    goToNextStep,
    goToPrevStep,
    goToStep,
    resetCalculator,
  };
}
```

---

## `src/hooks/useBitrix.ts`

```typescript
// src/hooks/useBitrix.ts
// Хук интеграции с Битрикс24 CRM — создание лидов через бэкенд-прокси

import { useState, useCallback } from 'react';
import axios from 'axios';
import type {
  BitrixLeadPayload,
  BitrixApiResponse,
  LeadFormData,
  CalculatorFormState,
  PriceCalculationResult,
} from '../types/calculator';
import {
  LABEL_TYPE_LABELS,
  MATERIAL_LABELS,
  FINISHING_LABELS,
  CIRCULATION_LABELS,
} from '../data/pricing';
import { formatCurrency } from '../utils/priceCalc';

// URL бэкенд-прокси (Node.js/Express server.js)
// В продакшене проксируется через nginx/vite
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface UseBitrixReturn {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string | null;
  leadId: number | null;
  submitLead: (
    formData: LeadFormData,
    calculatorData: CalculatorFormState,
    result: PriceCalculationResult
  ) => Promise<void>;
  reset: () => void;
}

export function useBitrix(): UseBitrixReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);

  /** Формирует текстовый комментарий для лида */
  const buildLeadComments = (
    calculatorData: CalculatorFormState,
    result: PriceCalculationResult
  ): string => {
    const lines: string[] = [
      '=== ПАРАМЕТРЫ ЗАКАЗА ===',
      `Тип этикетки: ${calculatorData.labelType ? LABEL_TYPE_LABELS[calculatorData.labelType] : '—'}`,
      `Материал: ${calculatorData.material ? MATERIAL_LABELS[calculatorData.material] : '—'}`,
      `Размер: ${calculatorData.width} × ${calculatorData.height} мм`,
      `Количество цветов: ${calculatorData.colors}`,
      `Отделка: ${calculatorData.finishing.map((f) => FINISHING_LABELS[f]).join(', ')}`,
      `Тираж: ${calculatorData.circulation ? CIRCULATION_LABELS[calculatorData.circulation] : '—'}`,
      `Наличие макета: ${calculatorData.hasDesign ? 'Есть готовый' : 'Нужна разработка'}`,
      '',
      '=== РАСЧЁТ СТОИМОСТИ ===',
      `Базовая стоимость: ${formatCurrency(result.baseCost)}`,
      `Финишинг: ${formatCurrency(result.finishingCost)}`,
      `Подготовка (препресс): ${formatCurrency(result.setupCost)}`,
      result.designCost > 0 ? `Разработка макета: ${formatCurrency(result.designCost)}` : '',
      `Скидка по тиражу: -${result.discountRate}% (${formatCurrency(result.discountAmount)})`,
      `ИТОГО: ${formatCurrency(result.totalCost)}`,
      `Цена за 1000 шт.: ${formatCurrency(result.pricePerThousand)}`,
      `Срок производства: ${result.productionDays}`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  /**
   * Отправляет лид через бэкенд-прокси на Битрикс24
   */
  const submitLead = useCallback(
    async (
      formData: LeadFormData,
      calculatorData: CalculatorFormState,
      result: PriceCalculationResult
    ) => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);

      const payload: BitrixLeadPayload = { formData, calculatorData, result };

      try {
        const response = await axios.post<BitrixApiResponse>(
          `${API_BASE_URL}/api/bitrix/lead`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );

        if (response.data.success) {
          setIsSuccess(true);
          if (response.data.leadId) {
            setLeadId(response.data.leadId);
          }
        } else {
          throw new Error(response.data.error || 'Неизвестная ошибка');
        }
      } catch (error) {
        setIsError(true);

        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            setErrorMessage('Превышено время ожидания. Проверьте соединение с интернетом.');
          } else if (error.response) {
            setErrorMessage(
              error.response.data?.error || `Ошибка сервера: ${error.response.status}`
            );
          } else if (error.request) {
            setErrorMessage('Сервер недоступен. Попробуйте позже.');
          } else {
            setErrorMessage(error.message);
          }
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Произошла неизвестная ошибка при отправке заявки.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setErrorMessage(null);
    setLeadId(null);
  }, []);

  return { isLoading, isSuccess, isError, errorMessage, leadId, submitLead, reset };
}
```

---

## `src/components/StepOne.tsx`

```tsx
// src/components/StepOne.tsx
// Шаг 1: Выбор типа этикетки и материала

import React from 'react';
import type { LabelType, Material } from '../types/calculator';
import {
  LABEL_TYPE_OPTIONS,
  MATERIAL_OPTIONS,
  LABEL_TYPE_LABELS,
  MATERIAL_LABELS,
  LABEL_TYPE_ICONS,
  LABEL_TYPE_DESCRIPTIONS,
  MATERIAL_BASE_COST,
} from '../data/pricing';

interface StepOneProps {
  selectedType: LabelType | null;
  selectedMaterial: Material | null;
  onTypeChange: (type: LabelType) => void;
  onMaterialChange: (material: Material) => void;
}

const MATERIAL_COLORS: Partial<Record<Material, string>> = {
  semi_gloss: 'bg-yellow-50 border-yellow-200',
  pe: 'bg-blue-50 border-blue-200',
  pet: 'bg-cyan-50 border-cyan-200',
  bopp: 'bg-green-50 border-green-200',
  pp_white: 'bg-gray-50 border-gray-200',
  pp_silver: 'bg-slate-50 border-slate-300',
  pp_clear: 'bg-sky-50 border-sky-200',
  aluminum: 'bg-zinc-50 border-zinc-300',
};

export const StepOne: React.FC<StepOneProps> = ({
  selectedType,
  selectedMaterial,
  onTypeChange,
  onMaterialChange,
}) => {
  return (
    <div className="space-y-8">
      {/* ── Тип этикетки ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Тип этикетки</h3>
        <p className="text-sm text-gray-500 mb-4">
          Выберите технологию производства, подходящую для вашего продукта
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LABEL_TYPE_OPTIONS.map((type) => {
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => onTypeChange(type)}
                className={[
                  'relative text-left p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-brand-blue rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                <div className="text-2xl mb-2">{LABEL_TYPE_ICONS[type]}</div>
                <div className={['font-semibold text-sm mb-1', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {LABEL_TYPE_LABELS[type]}
                </div>
                <div className="text-xs text-gray-500 leading-snug">
                  {LABEL_TYPE_DESCRIPTIONS[type]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Материал ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Материал</h3>
        <p className="text-sm text-gray-500 mb-4">
          Базовая цена материала влияет на итоговую стоимость
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MATERIAL_OPTIONS.map((material) => {
            const isSelected = selectedMaterial === material;
            const colorClasses = MATERIAL_COLORS[material] || 'bg-white border-gray-200';

            return (
              <button
                key={material}
                onClick={() => onMaterialChange(material)}
                className={[
                  'relative text-left p-3 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 shadow-md'
                    : `${colorClasses} hover:border-blue-300`,
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-brand-blue rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                <div className={['font-semibold text-sm mb-1', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {MATERIAL_LABELS[material]}
                </div>
                <div className="text-xs text-gray-400">${MATERIAL_BASE_COST[material]}/кг</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
```

---

## `src/components/StepTwo.tsx`

```tsx
// src/components/StepTwo.tsx
// Шаг 2: Размеры этикетки, форма высечки, количество цветов

import React from 'react';
import type { CutShape } from '../types/calculator';
import { CUT_SHAPE_OPTIONS, CUT_SHAPE_LABELS } from '../data/pricing';
import { validateDimensions } from '../utils/priceCalc';

interface StepTwoProps {
  width: number;
  height: number;
  cutShape: CutShape | null;
  colors: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onCutShapeChange: (shape: CutShape) => void;
  onColorsChange: (colors: number) => void;
}

// SVG-иконки для форм высечки
const CUT_SHAPE_ICONS: Record<CutShape, React.ReactNode> = {
  rectangle: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="10" width="28" height="20" rx="1" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="20" cy="20" r="14" />
    </svg>
  ),
  oval: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="20" cy="20" rx="16" ry="11" />
    </svg>
  ),
  contour: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 L32 14 L30 28 L10 28 L8 14 Z" />
    </svg>
  ),
};

export const StepTwo: React.FC<StepTwoProps> = ({
  width, height, cutShape, colors,
  onWidthChange, onHeightChange, onCutShapeChange, onColorsChange,
}) => {
  const dimensionError = validateDimensions(width, height);
  const areaCm2 = ((width * height) / 100).toFixed(1);

  return (
    <div className="space-y-8">
      {/* ── Размеры ────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Размеры этикетки</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ширина × Высота в миллиметрах (от 20×20 до 200×300 мм)
        </p>

        <div className="flex items-start gap-4">
          {/* Ширина */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ширина, мм</label>
            <div className="relative">
              <input
                type="number" min={20} max={200} value={width}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className={[
                  'w-full px-3 py-2.5 rounded-lg border text-gray-800 font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors',
                  width < 20 || width > 200 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
                ].join(' ')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">мм</span>
            </div>
            <input type="range" min={20} max={200} value={width}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-full mt-2 h-1.5 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>20</span><span>200</span>
            </div>
          </div>

          <div className="flex items-center pt-9 text-2xl text-gray-400 font-light">×</div>

          {/* Высота */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Высота, мм</label>
            <div className="relative">
              <input
                type="number" min={20} max={300} value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className={[
                  'w-full px-3 py-2.5 rounded-lg border text-gray-800 font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors',
                  height < 20 || height > 300 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
                ].join(' ')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">мм</span>
            </div>
            <input type="range" min={20} max={300} value={height}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="w-full mt-2 h-1.5 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>20</span><span>300</span>
            </div>
          </div>
        </div>

        {dimensionError ? (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {dimensionError}
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Площадь этикетки: <strong>{areaCm2} см²</strong>
          </p>
        )}
      </div>

      {/* ── Форма высечки ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Форма высечки</h3>
        <p className="text-sm text-gray-500 mb-4">Форма готовой этикетки после вырубки</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CUT_SHAPE_OPTIONS.map((shape) => {
            const isSelected = cutShape === shape;
            return (
              <button
                key={shape}
                onClick={() => onCutShapeChange(shape)}
                className={[
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 text-brand-blue shadow-md'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {CUT_SHAPE_ICONS[shape]}
                <span className={['text-xs font-medium', isSelected ? 'text-brand-blue' : 'text-gray-700'].join(' ')}>
                  {CUT_SHAPE_LABELS[shape]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Количество цветов ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Количество цветов</h3>
        <p className="text-sm text-gray-500 mb-4">
          До 4 цветов — стандартная цена. Каждый цвет свыше 4 добавляет +10% к базовой стоимости
        </p>

        <div className="flex items-center gap-4">
          <input
            type="range" min={1} max={12} value={colors}
            onChange={(e) => onColorsChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => onColorsChange(colors - 1)}
              disabled={colors <= 1}
              className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >−</button>
            <div className="w-14 h-8 bg-brand-blue text-white rounded-lg flex items-center justify-center font-bold text-sm tabular-nums">
              {colors}
            </div>
            <button
              onClick={() => onColorsChange(colors + 1)}
              disabled={colors >= 12}
              className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >+</button>
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
          <span>1 цвет</span>
          <span>4 (базовые)</span>
          <span>12 цветов</span>
        </div>

        {colors > 4 && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Надбавка за {colors - 4} доп. {colors - 4 === 1 ? 'цвет' : colors - 4 <= 4 ? 'цвета' : 'цветов'}:{' '}
            <strong>+{(colors - 4) * 10}%</strong> к базовой стоимости
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## `src/components/StepThree.tsx`

```tsx
// src/components/StepThree.tsx
// Шаг 3: Специальная отделка, тираж, наличие макета

import React from 'react';
import type { Finishing, Circulation } from '../types/calculator';
import {
  FINISHING_OPTIONS,
  FINISHING_LABELS,
  FINISHING_COST,
  CIRCULATION_OPTIONS,
  CIRCULATION_LABELS,
  CIRCULATION_DISCOUNTS,
} from '../data/pricing';

interface StepThreeProps {
  finishing: Finishing[];
  circulation: Circulation | null;
  hasDesign: boolean | null;
  onFinishingToggle: (finishing: Finishing) => void;
  onCirculationChange: (circulation: Circulation) => void;
  onHasDesignChange: (hasDesign: boolean) => void;
}

const FINISHING_ICONS: Record<Finishing, string> = {
  foil_stamping: '✨',
  matte_lam: '🔲',
  gloss_lam: '💎',
  uv_varnish: '🔆',
  spot_varnish: '🎯',
  none: '⚪',
};

function getDiscountForCirculation(qty: number): number {
  const applicable = CIRCULATION_DISCOUNTS.find((d) => qty >= d.minQty);
  return applicable ? applicable.discount * 100 : 0;
}

export const StepThree: React.FC<StepThreeProps> = ({
  finishing, circulation, hasDesign,
  onFinishingToggle, onCirculationChange, onHasDesignChange,
}) => {
  return (
    <div className="space-y-8">
      {/* ── Специальная отделка ───────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Специальная отделка</h3>
        <p className="text-sm text-gray-500 mb-4">Можно выбрать несколько видов отделки</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FINISHING_OPTIONS.map((f) => {
            const isSelected = finishing.includes(f);
            const costPerUnit = FINISHING_COST[f];
            return (
              <button
                key={f}
                onClick={() => onFinishingToggle(f)}
                className={[
                  'flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
                  isSelected ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                <div className={[
                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  isSelected ? 'bg-brand-blue border-brand-blue' : 'border-gray-300',
                ].join(' ')}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="text-xl">{FINISHING_ICONS[f]}</div>
                <div className="flex-1 min-w-0">
                  <div className={['font-semibold text-sm', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                    {FINISHING_LABELS[f]}
                  </div>
                  {costPerUnit > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">+${costPerUnit}/шт.</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Тираж ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Тираж</h3>
        <p className="text-sm text-gray-500 mb-4">При больших тиражах действуют скидки до 20%</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CIRCULATION_OPTIONS.map((qty) => {
            const isSelected = circulation === qty;
            const discount = getDiscountForCirculation(qty);
            return (
              <button
                key={qty}
                onClick={() => onCirculationChange(qty)}
                className={[
                  'relative p-3 rounded-xl border-2 text-center transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
                  isSelected ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {discount > 0 && (
                  <span className={[
                    'absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    isSelected ? 'bg-brand-orange text-white' : 'bg-green-500 text-white',
                  ].join(' ')}>
                    -{discount}%
                  </span>
                )}
                <div className={['font-bold text-sm', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {CIRCULATION_LABELS[qty]}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 font-medium mb-2">Скидки по тиражу:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CIRCULATION_DISCOUNTS.map((d) => (
              <span key={d.minQty} className="text-xs text-gray-600">
                {d.minQty.toLocaleString('ru-RU')}+ шт. → <strong className="text-green-600">-{d.discount * 100}%</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Наличие макета ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Наличие макета</h3>
        <p className="text-sm text-gray-500 mb-4">
          Если у вас нет готового макета — мы разработаем дизайн за $150
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onHasDesignChange(true)}
            className={[
              'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
              hasDesign === true ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
            ].join(' ')}
            aria-pressed={hasDesign === true}
          >
            <div className="text-3xl flex-shrink-0">✅</div>
            <div>
              <div className={['font-semibold text-sm', hasDesign === true ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                Есть готовый макет
              </div>
              <div className="text-xs text-gray-500 mt-1">AI, PDF, TIFF или CDR</div>
              <div className="text-xs text-green-600 font-medium mt-1">Без доплаты</div>
            </div>
          </button>

          <button
            onClick={() => onHasDesignChange(false)}
            className={[
              'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
              hasDesign === false ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
            ].join(' ')}
            aria-pressed={hasDesign === false}
          >
            <div className="text-3xl flex-shrink-0">🎨</div>
            <div>
              <div className={['font-semibold text-sm', hasDesign === false ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                Нужна разработка дизайна
              </div>
              <div className="text-xs text-gray-500 mt-1">Наши дизайнеры создадут уникальный дизайн</div>
              <div className="text-xs text-amber-600 font-medium mt-1">+$150 к стоимости заказа</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## `src/components/PriceResult.tsx`

```tsx
// src/components/PriceResult.tsx
// Компонент отображения результата расчёта стоимости этикеток

import React, { useState } from 'react';
import type { PriceCalculationResult, CalculatorFormState } from '../types/calculator';
import {
  LABEL_TYPE_LABELS, MATERIAL_LABELS, CUT_SHAPE_LABELS,
  FINISHING_LABELS, CIRCULATION_LABELS,
} from '../data/pricing';
import { formatCurrency, formatNumber } from '../utils/priceCalc';
import { LeadForm } from './LeadForm';

interface PriceResultProps {
  result: PriceCalculationResult;
  formState: CalculatorFormState;
  onRecalculate: () => void;
}

export const PriceResult: React.FC<PriceResultProps> = ({ result, formState, onRecalculate }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Главная карточка результата ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-brand-blue to-blue-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-brand-orange" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-blue-200 text-sm font-medium">Расчёт готов</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-200 text-xs mb-1">Цена за 1 000 шт.</p>
            <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(result.pricePerThousand)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs mb-1">Общая стоимость</p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalCost)}</p>
            {result.discountRate > 0 && (
              <p className="text-green-300 text-xs mt-0.5">
                Скидка {result.discountRate}% (-{formatCurrency(result.discountAmount)})
              </p>
            )}
          </div>
          <div>
            <p className="text-blue-200 text-xs mb-1">Срок производства</p>
            <p className="text-lg font-semibold">{result.productionDays}</p>
            <p className="text-blue-300 text-xs mt-0.5">
              Тираж: {formState.circulation ? formatNumber(formState.circulation) : '—'} шт.
            </p>
          </div>
        </div>
      </div>

      {/* ── Параметры заказа ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Параметры заказа</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
          <SpecRow label="Тип этикетки">{formState.labelType ? LABEL_TYPE_LABELS[formState.labelType] : '—'}</SpecRow>
          <SpecRow label="Материал">{formState.material ? MATERIAL_LABELS[formState.material] : '—'}</SpecRow>
          <SpecRow label="Размер">{formState.width} × {formState.height} мм</SpecRow>
          <SpecRow label="Форма высечки">{formState.cutShape ? CUT_SHAPE_LABELS[formState.cutShape] : '—'}</SpecRow>
          <SpecRow label="Цветов печати">{formState.colors}</SpecRow>
          <SpecRow label="Отделка">
            {formState.finishing.length > 0
              ? formState.finishing.map((f) => FINISHING_LABELS[f]).join(', ')
              : 'Без отделки'}
          </SpecRow>
          <SpecRow label="Макет">{formState.hasDesign ? 'Готовый' : 'Разработка (+$150)'}</SpecRow>
          <SpecRow label="Тираж">{formState.circulation ? CIRCULATION_LABELS[formState.circulation] : '—'}</SpecRow>
        </div>
      </div>

      {/* ── Детализация стоимости (раскрываемая) ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-800">Детализация стоимости</span>
          <svg className={['w-5 h-5 text-gray-500 transition-transform duration-200', showBreakdown ? 'rotate-180' : ''].join(' ')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showBreakdown && (
          <div className="border-t border-gray-100 p-5 space-y-2.5 text-sm">
            <PriceRow label="Базовая стоимость материала" value={result.baseCost} />
            {result.colorSurcharge > 0 && <PriceRow label="Надбавка за цвета (>4 цв.)" value={result.colorSurcharge} />}
            {result.finishingCost > 0 && <PriceRow label="Специальная отделка" value={result.finishingCost} />}
            <PriceRow label="Подготовка (препресс, формы)" value={result.setupCost} />
            {result.designCost > 0 && <PriceRow label="Разработка макета" value={result.designCost} />}
            <div className="border-t border-gray-200 pt-2.5 mt-2.5">
              <PriceRow label="Подытог" value={result.subtotal} isBold />
            </div>
            {result.discountRate > 0 && (
              <PriceRow label={`Скидка за тираж (-${result.discountRate}%)`} value={-result.discountAmount} isDiscount />
            )}
            <div className="border-t border-gray-200 pt-2.5 mt-2.5">
              <PriceRow label="Итого к оплате" value={result.totalCost} isTotal />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <PriceRow
                label={`Цена за 1 000 шт. (тираж ${formState.circulation ? formatNumber(formState.circulation) : '—'})`}
                value={result.pricePerThousand}
                isBold
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Кнопки действий ──────────────────────────────────────────── */}
      {!showLeadForm && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowLeadForm(true)}
            className="flex-1 py-3.5 px-6 bg-brand-orange hover:bg-orange-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Оформить заявку
          </button>
          <button
            onClick={onRecalculate}
            className="flex-1 sm:flex-none py-3.5 px-6 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-all duration-200 hover:shadow-md"
          >
            Пересчитать
          </button>
        </div>
      )}

      {showLeadForm && (
        <LeadForm formState={formState} result={result} onCancel={() => setShowLeadForm(false)} />
      )}

      <p className="text-xs text-gray-400 text-center">
        * Расчёт приблизительный. Точная стоимость уточняется после проверки макета и согласования технических параметров. Цены указаны в USD.
      </p>
    </div>
  );
};

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium mt-0.5">{children}</span>
    </div>
  );
}

function PriceRow({
  label, value, isBold = false, isTotal = false, isDiscount = false,
}: { label: string; value: number; isBold?: boolean; isTotal?: boolean; isDiscount?: boolean }) {
  const absValue = Math.abs(value);
  const isNegative = value < 0;
  return (
    <div className={['flex justify-between items-baseline', isTotal ? 'font-bold text-base' : '', isBold ? 'font-semibold' : ''].join(' ')}>
      <span className={isTotal ? 'text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={[isTotal ? 'text-brand-blue text-lg' : isDiscount || isNegative ? 'text-green-600' : 'text-gray-800'].join(' ')}>
        {isNegative ? '−' : ''}{formatCurrency(absValue)}
      </span>
    </div>
  );
}
```

---

## `src/components/LeadForm.tsx`

```tsx
// src/components/LeadForm.tsx
// Форма создания лида в Битрикс24 CRM

import React, { useState } from 'react';
import type { LeadFormData, CalculatorFormState, PriceCalculationResult } from '../types/calculator';
import { useBitrix } from '../hooks/useBitrix';
import { formatCurrency } from '../utils/priceCalc';

interface LeadFormProps {
  formState: CalculatorFormState;
  result: PriceCalculationResult;
  onCancel: () => void;
}

function formatPhone(value: string): string {
  return value.replace(/[^\d+\-\s()]/g, '');
}

export const LeadForm: React.FC<LeadFormProps> = ({ formState, result, onCancel }) => {
  const { isLoading, isSuccess, isError, errorMessage, leadId, submitLead, reset } = useBitrix();

  const [formData, setFormData] = useState<LeadFormData>({
    name: '', company: '', email: '', phone: '',
  });
  const [errors, setErrors] = useState<Partial<LeadFormData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<LeadFormData> = {};
    if (!formData.name.trim()) newErrors.name = 'Введите ваше имя';
    if (!formData.email.trim()) newErrors.email = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Некорректный email-адрес';
    if (!formData.phone.trim()) newErrors.phone = 'Введите номер телефона';
    else if (formData.phone.replace(/\D/g, '').length < 7) newErrors.phone = 'Слишком короткий номер';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await submitLead(formData, formState, result);
  };

  const updateField = (field: keyof LeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl border border-green-200 p-6 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Заявка успешно отправлена!</h3>
        <p className="text-gray-600 mb-2">Наш менеджер свяжется с вами в течение 1 рабочего дня.</p>
        {leadId && <p className="text-sm text-gray-400 mb-4">Номер заявки в CRM: <span className="font-mono font-medium">#{leadId}</span></p>}
        <div className="bg-blue-50 rounded-xl p-4 mb-5">
          <p className="text-sm text-gray-600">Расчётная стоимость заказа</p>
          <p className="text-2xl font-extrabold text-brand-blue">{formatCurrency(result.totalCost)}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatCurrency(result.pricePerThousand)} за 1 000 шт. · {result.productionDays}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onCancel} className="py-2.5 px-6 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
            Новый расчёт
          </button>
          <a href="mailto:info@flex-n-roll.pro?subject=Заявка на этикетки"
            className="py-2.5 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors text-center">
            Написать нам
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Оформить заявку</h3>
          <p className="text-sm text-gray-500 mt-0.5">Менеджер свяжется с вами в течение 1 рабочего дня</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Закрыть">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-5 flex items-center justify-between">
        <div><p className="text-xs text-gray-500">Итого</p><p className="text-xl font-extrabold text-brand-blue">{formatCurrency(result.totalCost)}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500">За 1 000 шт.</p><p className="text-lg font-bold text-gray-800">{formatCurrency(result.pricePerThousand)}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500">Срок</p><p className="text-sm font-semibold text-gray-700">{result.productionDays}</p></div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField label="Ваше имя *" error={errors.name} htmlFor="lead-name">
          <input id="lead-name" type="text" placeholder="Иван Иванов" value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={inputClass(!!errors.name)} autoComplete="name" />
        </FormField>

        <FormField label="Компания" error={errors.company} htmlFor="lead-company">
          <input id="lead-company" type="text" placeholder="ООО «Ваша компания»" value={formData.company}
            onChange={(e) => updateField('company', e.target.value)}
            className={inputClass(!!errors.company)} autoComplete="organization" />
        </FormField>

        <FormField label="Email *" error={errors.email} htmlFor="lead-email">
          <input id="lead-email" type="email" placeholder="ivan@company.ru" value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={inputClass(!!errors.email)} autoComplete="email" />
        </FormField>

        <FormField label="Телефон *" error={errors.phone} htmlFor="lead-phone">
          <input id="lead-phone" type="tel" placeholder="+7 (999) 123-45-67" value={formData.phone}
            onChange={(e) => updateField('phone', formatPhone(e.target.value))}
            className={inputClass(!!errors.phone)} autoComplete="tel" />
        </FormField>

        {isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Ошибка отправки</p>
              <p className="mt-0.5 text-red-600">{errorMessage}</p>
              <button type="button" onClick={reset} className="mt-1 text-red-700 underline text-xs">Попробовать снова</button>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={[
              'w-full py-3.5 px-6 font-semibold rounded-xl transition-all duration-200 shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2',
              isLoading
                ? 'bg-orange-300 cursor-wait text-white'
                : 'bg-brand-orange hover:bg-orange-500 text-white hover:shadow-lg hover:-translate-y-0.5',
            ].join(' ')}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Отправляем заявку...
              </span>
            ) : 'Отправить заявку в производство'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Нажимая кнопку, вы соглашаетесь с обработкой персональных данных в соответствии с{' '}
            <a href="https://flex-n-roll.pro/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              Политикой конфиденциальности
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

function inputClass(hasError: boolean): string {
  return [
    'w-full px-3 py-2.5 rounded-lg border text-gray-800',
    'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors placeholder:text-gray-400',
    hasError ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200' : 'border-gray-300 bg-white',
  ].join(' ');
}

function FormField({ label, error, htmlFor, children }: {
  label: string; error?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## `src/components/Calculator.tsx`

```tsx
// src/components/Calculator.tsx
// Главный компонент калькулятора — управляет wizard-навигацией

import React from 'react';
import { useCalculator } from '../hooks/useCalculator';
import { StepOne } from './StepOne';
import { StepTwo } from './StepTwo';
import { StepThree } from './StepThree';
import { PriceResult } from './PriceResult';

const STEPS = [
  { number: 1, title: 'Тип и материал' },
  { number: 2, title: 'Параметры' },
  { number: 3, title: 'Тираж и отделка' },
];

export const Calculator: React.FC = () => {
  const {
    formState, currentStep, result, canProceed,
    setLabelType, setMaterial, setWidth, setHeight,
    setCutShape, setColors, toggleFinishing,
    setCirculation, setHasDesign,
    goToNextStep, goToPrevStep, goToStep, resetCalculator,
  } = useCalculator();

  const isResultStep = currentStep === 'result';
  const progressPercent = isResultStep ? 100 : ((currentStep as number) / 3) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── Заголовок ─────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="flex-n-roll логотип">
            <rect width="44" height="44" rx="10" fill="#1A3C8F" />
            <rect x="8" y="14" width="28" height="4" rx="2" fill="#F4821E" />
            <rect x="8" y="22" width="20" height="4" rx="2" fill="white" />
            <rect x="8" y="30" width="24" height="4" rx="2" fill="white" fillOpacity="0.6" />
            <circle cx="36" cy="32" r="4" fill="#F4821E" />
          </svg>
          <div className="text-left">
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
              flex-n-roll<span className="text-brand-blue">.pro</span>
            </h1>
            <p className="text-xs text-gray-500 -mt-0.5">Производство этикеток</p>
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Калькулятор стоимости этикеток</h2>
        <p className="text-sm text-gray-500 mt-1">Рассчитайте стоимость тиража за 3 шага</p>
      </div>

      {/* ── Индикатор шагов ───────────────────────────────────────────── */}
      {!isResultStep && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, idx) => {
              const isCompleted = (currentStep as number) > step.number;
              const isActive = currentStep === step.number;
              const isClickable = isCompleted;
              return (
                <React.Fragment key={step.number}>
                  <button
                    onClick={() => isClickable && goToStep(step.number as 1 | 2 | 3)}
                    disabled={!isClickable}
                    className={['flex flex-col items-center gap-1.5', isClickable ? 'cursor-pointer' : 'cursor-default'].join(' ')}
                  >
                    <div className={[
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                      isCompleted ? 'bg-brand-blue text-white shadow-md'
                        : isActive ? 'bg-brand-orange text-white shadow-md ring-4 ring-orange-200'
                        : 'bg-gray-100 text-gray-400',
                    ].join(' ')}>
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : step.number}
                    </div>
                    <span className={[
                      'text-xs font-medium hidden sm:block',
                      isActive ? 'text-brand-orange' : isCompleted ? 'text-brand-blue' : 'text-gray-400',
                    ].join(' ')}>
                      {step.title}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 h-0.5 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className="h-full bg-brand-blue transition-all duration-500"
                        style={{ width: (currentStep as number) > step.number ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-blue to-brand-orange rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Карточка калькулятора ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Шапка */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
              isResultStep ? 'bg-green-500 text-white' : 'bg-brand-orange text-white',
            ].join(' ')}>
              {isResultStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : currentStep}
            </span>
            <h3 className="font-bold text-gray-800">
              {isResultStep ? 'Результат расчёта' : STEPS.find((s) => s.number === currentStep)?.title}
            </h3>
            {!isResultStep && <span className="ml-auto text-xs text-gray-400">Шаг {currentStep} из 3</span>}
          </div>
        </div>

        {/* Содержимое */}
        <div className="p-6">
          {currentStep === 1 && (
            <StepOne
              selectedType={formState.labelType} selectedMaterial={formState.material}
              onTypeChange={setLabelType} onMaterialChange={setMaterial}
            />
          )}
          {currentStep === 2 && (
            <StepTwo
              width={formState.width} height={formState.height}
              cutShape={formState.cutShape} colors={formState.colors}
              onWidthChange={setWidth} onHeightChange={setHeight}
              onCutShapeChange={setCutShape} onColorsChange={setColors}
            />
          )}
          {currentStep === 3 && (
            <StepThree
              finishing={formState.finishing} circulation={formState.circulation}
              hasDesign={formState.hasDesign}
              onFinishingToggle={toggleFinishing}
              onCirculationChange={setCirculation}
              onHasDesignChange={setHasDesign}
            />
          )}
          {isResultStep && result && (
            <PriceResult result={result} formState={formState} onRecalculate={resetCalculator} />
          )}
        </div>

        {/* Кнопки навигации */}
        {!isResultStep && (
          <div className="px-6 pb-6 flex items-center justify-between gap-4">
            <button
              onClick={goToPrevStep}
              disabled={(currentStep as number) <= 1}
              className={[
                'flex items-center gap-2 py-2.5 px-5 rounded-xl font-medium text-sm transition-all duration-200',
                (currentStep as number) <= 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад
            </button>

            <button
              onClick={goToNextStep}
              disabled={!canProceed}
              className={[
                'flex items-center gap-2 py-3 px-8 rounded-xl font-semibold text-sm transition-all duration-200 shadow',
                !canProceed
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : currentStep === 3
                  ? 'bg-brand-orange hover:bg-orange-500 text-white hover:shadow-lg hover:-translate-y-0.5'
                  : 'bg-brand-blue hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5',
              ].join(' ')}
            >
              {currentStep === 3 ? (
                <>
                  Рассчитать стоимость
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </>
              ) : (
                <>
                  Далее
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Доверительные индикаторы ──────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
        {['Собственное производство', 'Доставка по всему миру', 'Сертификаты ISO 9001', 'Ответ менеджера за 1 час'].map((text) => (
          <span key={text} className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};
```

---

## `src/App.tsx`

```tsx
// src/App.tsx
// Корневой компонент приложения калькулятора этикеток flex-n-roll.pro

import React from 'react';
import { Calculator } from './components/Calculator';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Декоративный фон */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-blue/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-orange/5 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 py-8 px-4">
        <Calculator />
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-gray-400 border-t border-gray-200/50">
        <p>
          © {new Date().getFullYear()}{' '}
          <a href="https://flex-n-roll.pro" target="_blank" rel="noopener noreferrer"
            className="hover:text-brand-blue transition-colors">
            flex-n-roll.pro
          </a>{' '}
          — Производство этикеток
        </p>
      </footer>
    </div>
  );
}

export default App;
```

---

## `src/main.tsx`

```tsx
// src/main.tsx
// Точка входа React-приложения

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## `src/index.css`

```css
/* src/index.css */
/* Глобальные стили и кастомные CSS-свойства */

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-brand-blue: #1A3C8F;
  --color-brand-orange: #F4821E;
}

@layer base {
  * { @apply box-border; }

  html { @apply text-base antialiased; scroll-behavior: smooth; }

  body {
    @apply text-gray-900 bg-slate-50;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Скрыть стрелки у number input */
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type='number'] { -moz-appearance: textfield; }
}

@layer components {
  .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
  .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-brand-blue);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(26, 60, 143, 0.4);
  transition: transform 0.15s ease;
}

input[type='range']::-webkit-slider-thumb:hover { transform: scale(1.15); }

input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-brand-blue);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 4px rgba(26, 60, 143, 0.4);
}

:focus-visible {
  outline: 2px solid var(--color-brand-blue);
  outline-offset: 2px;
}
```

---

## `index.html`

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'%3E%3Crect width='44' height='44' rx='10' fill='%231A3C8F'/%3E%3Crect x='8' y='14' width='28' height='4' rx='2' fill='%23F4821E'/%3E%3Crect x='8' y='22' width='20' height='4' rx='2' fill='white'/%3E%3C/svg%3E" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Калькулятор стоимости этикеток | flex-n-roll.pro</title>
    <meta name="description" content="Рассчитайте стоимость печати этикеток онлайн. Самоклеящиеся, sleeve, AR, термохром, linerless. Тиражи от 1000 шт." />
    <meta property="og:title" content="Калькулятор стоимости этикеток | flex-n-roll.pro" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ru_RU" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="canonical" href="https://flex-n-roll.pro/calculator" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## `package.json`

```json
{
  "name": "flex-n-roll-calculator",
  "version": "1.0.0",
  "description": "Калькулятор стоимости этикеток для flex-n-roll.pro с интеграцией Битрикс24",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "server": "node server.js",
    "start": "concurrently \"npm run dev\" \"npm run server\""
  },
  "dependencies": {
    "axios": "^1.6.7",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.19.1",
    "@typescript-eslint/parser": "^6.19.1",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "concurrently": "^8.2.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "eslint": "^8.56.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "express": "^4.18.2",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## `vite.config.ts`

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },

  // Прокси API-запросов на бэкенд в режиме разработки
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          axios: ['axios'],
        },
      },
    },
  },
});
```

---

## `tailwind.config.js`

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        'brand-blue': {
          DEFAULT: '#1A3C8F',
          50: '#EEF2FB',
          100: '#D5DFEF',
          200: '#ABBFDF',
          300: '#7E9FCF',
          400: '#5080BF',
          500: '#1A3C8F',
          600: '#163480',
          700: '#112A6A',
          800: '#0D2154',
          900: '#081844',
        },
        'brand-orange': {
          DEFAULT: '#F4821E',
          50: '#FEF4E9',
          100: '#FDDCB8',
          200: '#FCC589',
          300: '#F9AC5A',
          400: '#F7962E',
          500: '#F4821E',
          600: '#D9721A',
          700: '#B55E14',
          800: '#914B10',
          900: '#6E380C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 16px rgba(26, 60, 143, 0.08)',
        'card-hover': '0 8px 30px rgba(26, 60, 143, 0.15)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.4s ease-out',
        'slideUp': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },

  plugins: [],
};
```

---

## `postcss.config.js`

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@types/*": ["src/types/*"],
      "@data/*": ["src/data/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

---

## `server.js`

```javascript
// server.js
// Бэкенд-прокси Node.js/Express для интеграции с Битрикс24 CRM.
// Скрывает токены и URL Б24 от браузера.
// Запуск: node server.js

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Конфигурация Битрикс24 ──────────────────────────────────────────────────
// Задайте в .env:
//   BITRIX24_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/token/
const BITRIX24_WEBHOOK_URL = process.env.BITRIX24_WEBHOOK_URL;
const BITRIX24_DOMAIN = process.env.BITRIX24_DOMAIN;
const BITRIX24_ACCESS_TOKEN = process.env.BITRIX24_ACCESS_TOKEN;

/**
 * Вызов метода Б24 API.
 * Поддерживает webhook и OAuth.
 */
async function callBitrix24(method, params) {
  let url;
  let requestParams = { ...params };

  if (BITRIX24_WEBHOOK_URL) {
    url = `${BITRIX24_WEBHOOK_URL.replace(/\/$/, '')}/${method}`;
  } else if (BITRIX24_DOMAIN && BITRIX24_ACCESS_TOKEN) {
    url = `https://${BITRIX24_DOMAIN}/rest/${method}`;
    requestParams.auth = BITRIX24_ACCESS_TOKEN;
  } else {
    throw new Error('Б24 не настроен: задайте BITRIX24_WEBHOOK_URL в .env');
  }

  const response = await axios.post(url, requestParams, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  if (response.data.error) {
    throw new Error(`Б24 API ошибка: ${response.data.error} — ${response.data.error_description || ''}`);
  }

  return response.data.result;
}

// ─── Словари для заголовков лида ────────────────────────────────────────────
const LABEL_TYPE_LABELS = {
  self_adhesive: 'Самоклеящаяся', sleeve: 'Sleeve (гильза)',
  ar: 'AR-этикетка', thermochrome: 'Термохром', linerless: 'Linerless',
};

const MATERIAL_LABELS = {
  semi_gloss: 'Бумага Semi Gloss', pe: 'PE (полиэтилен)', pet: 'PET',
  bopp: 'BOPP', pp_white: 'PP White', pp_silver: 'PP Silver',
  pp_clear: 'PP Clear', aluminum: 'Алюминий',
};

const FINISHING_LABELS = {
  foil_stamping: 'Тиснение фольгой', matte_lam: 'Ламинация мат',
  gloss_lam: 'Ламинация глянец', uv_varnish: 'УФ-лак (полный)',
  spot_varnish: 'Выборочный лак', none: 'Без отделки',
};

function formatUSD(value) { return `$${value.toFixed(2)}`; }

/**
 * Строит поля лида для crm.lead.add
 */
function buildLeadFields(formData, calculatorData, result) {
  const { name, company, email, phone } = formData;
  const { labelType, material, width, height, cutShape, colors, finishing, circulation, hasDesign } = calculatorData;

  const materialStr = MATERIAL_LABELS[material] || material;
  const circulationStr = circulation ? `${Number(circulation).toLocaleString('ru-RU')} шт.` : '';

  const title = `Этикетки ${materialStr} ${width}×${height} мм — ${circulationStr} | ${company || name}`;

  const comments = [
    '=== ПАРАМЕТРЫ ЗАКАЗА ===',
    `Тип этикетки: ${LABEL_TYPE_LABELS[labelType] || labelType}`,
    `Материал: ${materialStr}`,
    `Размер: ${width} × ${height} мм`,
    `Форма высечки: ${cutShape}`,
    `Количество цветов: ${colors}`,
    `Отделка: ${finishing.map((f) => FINISHING_LABELS[f] || f).join(', ')}`,
    `Тираж: ${circulationStr}`,
    `Наличие макета: ${hasDesign ? 'Есть готовый' : 'Нужна разработка (+$150)'}`,
    '',
    '=== РАСЧЁТ СТОИМОСТИ ===',
    `Базовая стоимость: ${formatUSD(result.baseCost)}`,
    result.colorSurcharge > 0 ? `Надбавка за цвета: ${formatUSD(result.colorSurcharge)}` : null,
    `Финишинг: ${formatUSD(result.finishingCost)}`,
    `Подготовка (препресс): ${formatUSD(result.setupCost)}`,
    result.designCost > 0 ? `Разработка макета: ${formatUSD(result.designCost)}` : null,
    result.discountRate > 0 ? `Скидка ${result.discountRate}%: -${formatUSD(result.discountAmount)}` : null,
    `ИТОГО: ${formatUSD(result.totalCost)}`,
    `Цена за 1000 шт.: ${formatUSD(result.pricePerThousand)}`,
    `Срок производства: ${result.productionDays}`,
  ].filter(Boolean).join('\n');

  return {
    TITLE: title,
    NAME: name.split(' ')[0] || name,
    LAST_NAME: name.split(' ').slice(1).join(' ') || '',
    COMPANY_TITLE: company || '',
    EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
    STATUS_ID: 'NEW',
    SOURCE_ID: 'WEB',
    COMMENTS: comments,
    CURRENCY_ID: 'USD',
    OPPORTUNITY: result.totalCost,
  };
}

// ─── POST /api/bitrix/lead ───────────────────────────────────────────────────
app.post('/api/bitrix/lead', async (req, res) => {
  try {
    const { formData, calculatorData, result } = req.body;

    if (!formData || !calculatorData || !result) {
      return res.status(400).json({ success: false, error: 'Отсутствуют обязательные поля' });
    }

    if (!formData.name || !formData.email || !formData.phone) {
      return res.status(400).json({ success: false, error: 'Обязательные поля: name, email, phone' });
    }

    const fields = buildLeadFields(formData, calculatorData, result);

    console.log(`[Б24] Создание лида: ${fields.TITLE}`);

    const leadId = await callBitrix24('crm.lead.add', { fields });

    console.log(`[Б24] Лид создан, ID: ${leadId}`);

    return res.json({ success: true, leadId: Number(leadId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[Б24] Ошибка:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// ─── GET /api/health ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bitrix24: BITRIX24_WEBHOOK_URL ? 'webhook configured'
      : BITRIX24_DOMAIN ? 'oauth configured'
      : 'NOT CONFIGURED',
  });
});

// ─── Запуск ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 flex-n-roll Б24 прокси-сервер запущен на порту ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  if (!BITRIX24_WEBHOOK_URL && !(BITRIX24_DOMAIN && BITRIX24_ACCESS_TOKEN)) {
    console.warn('\n⚠️  ВНИМАНИЕ: Задайте BITRIX24_WEBHOOK_URL в .env\n');
  }
});

export default app;
```

---

## `.env.example`

```bash
# ─── Бэкенд-сервер ───────────────────────────────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:5173

# ─── Битрикс24 — Вариант 1: Webhook (рекомендуется) ─────────────────────────
# Создайте webhook: Настройки → Интеграции → Webhook → Права: CRM
BITRIX24_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-secret-token/

# ─── Битрикс24 — Вариант 2: OAuth ─────────────────────────────────────────────
# BITRIX24_DOMAIN=your-portal.bitrix24.ru
# BITRIX24_ACCESS_TOKEN=your-oauth-access-token

# ─── Vite (фронтенд) ─────────────────────────────────────────────────────────
VITE_API_URL=
VITE_APP_TITLE=Калькулятор этикеток flex-n-roll.pro
```

---

## `README.md`

```markdown
# flex-n-roll Calculator

Онлайн-калькулятор стоимости этикеток для flex-n-roll.pro с интеграцией Битрикс24 CRM.

## Стек технологий

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **HTTP клиент**: axios
- **Backend прокси**: Node.js / Express
- **CRM**: Битрикс24 (crm.lead.add API)

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных среды

```bash
cp .env.example .env
# Добавьте BITRIX24_WEBHOOK_URL
```

### 3. Запуск в режиме разработки

```bash
npm start     # Запускает Vite (:5173) и Express (:3001) одновременно
```

### 4. Сборка для продакшена

```bash
npm run build
# Готовые файлы в папке dist/
```

## Формула расчёта

```
Базовая цена = material_cost × (w × h / 1_000_000) × circulation
Надбавка за цвета = base × 0.1 × max(0, colors - 4)
Финишинг = Σ cost_per_unit × circulation
Подготовка = $200
Макет = $150 (если нет)
Подытог = base + colors + finishing + setup + design
Скидка = 5000+ → -5% / 10000+ → -10% / 50000+ → -15% / 100000+ → -20%
Итого = subtotal × (1 - discount)
Цена/1000 = total / (circulation / 1000)
```

## Настройка Битрикс24

1. В Б24: **Настройки → Разработчикам → Входящий webhook**
2. Права: `CRM` (все)
3. URL webhook → в `.env` как `BITRIX24_WEBHOOK_URL`

## Деплой

```bash
# Frontend → dist/ на хостинг/CDN
npm run build

# Backend с PM2
pm2 start server.js --name "fnr-calculator-api"
```
```

---

*Все права защищены © flex-n-roll.pro*
