# FLEX-N-ROLL PRO — Launch Guide

## Project Overview

FLEX-N-ROLL PRO is a monorepo for a label/packaging printing company. It integrates with Bitrix24 CRM and provides AI-powered automation, order tracking, analytics, and regulatory compliance (Honest Sign marking system).

### Services

| Service | Directory | Description | Internal address | Stack |
|---------|-----------|-------------|-----------------|-------|
| **webhook** | `webhook/` | Bitrix24 webhook handler with LM Studio AI classification, OAuth2, SLA management | `fnr-webhook:3000` | Node 20, Express, Redis, OpenAI SDK |
| **calculator** | `calculator/` | Label pricing calculator frontend (nginx SPA) | `fnr-calculator:80` | React 18, TypeScript, Vite, Tailwind |
| **calculator-api** | `calculator/` | Calculator Express backend | `fnr-calculator-api:3001` | Node 20, Express |
| **commanalysis** | `commanalysis/` | AI analysis of sales communications — transcription via Whisper, evaluation via GPT | `fnr-commanalysis:3000` | Node 18, Express, OpenAI, FFmpeg |
| **fnr-status-bot** | `fnr-status-bot/` | Telegram bot for checking order status via Bitrix24 | — (long-polling) | Node 20, Telegraf |
| **marking** | `marking/` | Integration with Russian "Honest Sign" (Честный ЗНАК) marking system | `fnr-marking:3000` | Node 18, Express, QRCode, XML |
| **fnr-analytics** | `fnr-analytics/` | Analytics dashboard (static SPA, nginx) | `fnr-analytics:80` | React 19, Vite, Recharts, Tailwind |
| **redis** | — | Cache, rate limiting, round-robin counters for webhook service | `fnr-redis:6379` | Redis 7.2 |

> All services communicate over the `fnr-net` Docker bridge network using container names — no host port mapping. To access a service from the host machine, add a `ports:` entry to the relevant service in `docker-compose.yml`.

---

## Prerequisites

### Required Software

- **Node.js** >= 20.0.0 (v20 LTS recommended; some services require >= 18, but fnr-status-bot and webhook require >= 20)
- **npm** >= 9 (comes with Node 20)
- **Docker** >= 24.0 and **Docker Compose** >= 2.20 (for containerized launch)
- **Git**

### Optional

- **LM Studio** — local AI inference server (for webhook service; runs on `localhost:1234`)
- **FFmpeg** — required for commanalysis service audio processing (installed automatically in Docker via `ffmpeg-static`)

---

## Environment Variables

Each service has a `.env.example` file. Before running, copy each to `.env` and fill in real values:

```bash
# From the repo root:
cp calculator/.env.example calculator/.env
cp commanalysis/.env.example commanalysis/.env
cp fnr-status-bot/.env.example fnr-status-bot/.env
cp marking/.env.example marking/.env
cp webhook/.env.example webhook/.env
```

### Key variables to configure

| Service | Variable | Description |
|---------|----------|-------------|
| **webhook** | `WEBHOOK_SECRET` | HMAC signature secret for Bitrix24 webhooks |
| **webhook** | `OPENAI_BASE_URL` | LM Studio endpoint (default: `http://localhost:1234/v1`) |
| **webhook** | `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET` | Bitrix24 OAuth2 credentials |
| **webhook** | `REDIS_URL` | Redis connection string (Docker: `redis://redis:6379`) |
| **calculator** | `BITRIX24_WEBHOOK_URL` | Bitrix24 webhook for CRM data |
| **commanalysis** | `OPENAI_API_KEY` | OpenAI API key for Whisper + GPT |
| **commanalysis** | `BITRIX24_WEBHOOK_URL` | Bitrix24 webhook for call data |
| **fnr-status-bot** | `BOT_TOKEN` | Telegram bot token from @BotFather |
| **fnr-status-bot** | `BITRIX24_WEBHOOK_URL` | Bitrix24 webhook for order lookup |
| **marking** | `MDLP_CLIENT_ID`, `MDLP_CLIENT_SECRET` | Honest Sign API credentials |
| **marking** | `BITRIX_WEBHOOK_URL` | Bitrix24 webhook for marking integration |

---

## Launch: Docker (Recommended)

### 1. Clone and configure

```bash
git clone https://github.com/Dm1tryAndreev1ch/flex-n-roll-pro.git
cd flex-n-roll-pro
```

### 2. Create `.env` files

Copy all `.env.example` files to `.env` and fill in secrets (see above).

You can also create a single root `.env` file for shared variables used by the unified `docker-compose.yml`:

```bash
cp webhook/.env.example .env
# Then add variables from other services as needed
```

### 3. Build and start all services

Place `docker-compose.yml` from this repo in the project root, then:

```bash
docker compose up --build -d
```

### 4. Verify

```bash
# Check all containers are running
docker compose ps

# Check webhook health (from inside the network)
docker exec fnr-webhook curl -f http://localhost:3000/health

# Check calculator frontend (from inside the network)
docker exec fnr-calculator curl -s http://localhost:80 | head -5

# View logs
docker compose logs -f webhook
docker compose logs -f commanalysis
```

> No ports are bound to the host by default. Services are only reachable inside `fnr-net` by container name. To expose one externally, add `ports: ["HOST:CONTAINER"]` to that service.

### 5. Stop

```bash
docker compose down

# To also remove volumes (Redis data, etc.):
docker compose down -v
```

---

## Launch: Local / Manual

### 1. Install all dependencies

```bash
# From repo root (uses npm workspaces — note: fnr-analytics not in workspaces)
npm install

# Install fnr-analytics separately
cd fnr-analytics && npm install && cd ..
```

### 2. Start Redis

```bash
# Via Docker (simplest)
docker run -d --name fnr-redis -p 6379:6379 redis:7.2-alpine redis-server --appendonly yes

# Or install Redis locally
```

### 3. Start each service

Open separate terminals for each:

```bash
# Terminal 1 — Webhook handler
cd webhook
cp .env.example .env  # edit with real values
npm run dev

# Terminal 2 — Calculator (frontend + backend)
cd calculator
cp .env.example .env
npm start            # starts both Vite dev server and Express backend

# Terminal 3 — CommAnalysis
cd commanalysis
cp .env.example .env
npm run dev

# Terminal 4 — Telegram Bot
cd fnr-status-bot
cp .env.example .env
npm start

# Terminal 5 — Marking
cd marking
cp .env.example .env
npm run dev

# Terminal 6 — Analytics Dashboard
cd fnr-analytics
npm run dev
```

---

## Per-Service Details

### webhook (port 3000)

- Requires Redis to be running
- Requires LM Studio running on port 1234 (or configure `OPENAI_BASE_URL`)
- Has a `/health` endpoint for monitoring
- Stores OAuth tokens in `./data/bitrix_tokens.json`
- Logs to `./logs/`

### calculator (port 5173 dev / 8080 prod)

- Frontend: Vite React app on port 5173 (dev) or served by nginx on port 80 (Docker)
- Backend: Express API on port 3001
- `npm start` runs both concurrently
- Frontend proxies `/api` requests to the backend

### commanalysis (port 3001 mapped from 3000)

- Requires OpenAI API key (Whisper for transcription, GPT for analysis)
- Has a scheduler (`npm run scheduler`) for daily batch processing
- Temp audio files stored in `TMP_DIR` (default `/tmp/commanalysis`)

### fnr-status-bot (no exposed port)

- Long-polling Telegram bot — no HTTP port needed
- Requires `BOT_TOKEN` from @BotFather
- Depends on webhook service for Bitrix24 data

### marking (port 3002 mapped from 3000)

- Integrates with Honest Sign (Честный ЗНАК / ГИС МТ) API
- Stores marking codes in `DATA_DIR` (JSON file-based DB)
- Has a scheduler for periodic marking status checks

### fnr-analytics (port 8081 prod / 5174 dev)

- Static SPA — no backend required
- Uses `vite-plugin-singlefile` to bundle everything into one HTML file
- Built output can be served by any static server (nginx)

---

## Known Issues and Broken References

### Critical

1. **`bot` workspace is missing**: `package.json` lists `"bot"` in workspaces, but the actual directory is `fnr-status-bot`. This causes `npm install` at root to fail.
2. **docker-compose.yml references `./bot`**: The root `docker-compose.yml` references `build: ./bot` but the directory is `fnr-status-bot`.
3. **docker-compose.yml references `./flex-n-roll-analytics`**: The analytics service references `build: ./flex-n-roll-analytics` but the directory is `fnr-analytics`.

### Missing Files

4. **fnr-status-bot/Dockerfile** — does not exist; needed for Docker deployment.
5. **fnr-analytics/Dockerfile** — does not exist; needed for Docker deployment.
6. **fnr-analytics/.env.example** — not present (may not be needed since it's a static SPA).

### Minor

7. **fnr-analytics not in workspaces**: `fnr-analytics` is not listed in the root `package.json` workspaces array.
8. **Inconsistent Node versions**: webhook and fnr-status-bot require Node >= 20, others require >= 18. The Dockerfiles for commanalysis and marking use `node:18-alpine`.
9. **Redis version mismatch**: Root docker-compose uses `redis:alpine` (latest), while webhook's standalone compose uses `redis:7.2-alpine` (pinned).
10. **`marking/.env.example`** has hardcoded absolute paths (`/home/user/workspace/flex-n-roll-marking/data`) — should use relative paths or Docker volume mounts.

---

## Troubleshooting

### `npm install` fails at root level

The root `package.json` references a `"bot"` workspace that doesn't exist (it's `fnr-status-bot`). Fix by editing `package.json`:
```json
"workspaces": ["fnr-status-bot", "webhook", "calculator", "commanalysis", "marking"]
```

### Docker build fails for bot/analytics

The original `docker-compose.yml` references `./bot` and `./flex-n-roll-analytics`. Use the unified `docker-compose.yml` provided separately which uses the correct directory names and includes Dockerfiles for all services.

### Webhook can't connect to Redis

- In Docker: use `redis://redis:6379` (service name, not localhost)
- Locally: ensure Redis is running on port 6379

### Calculator API proxy not working

- In development, Vite proxies `/api` to `http://localhost:3001`
- Ensure the calculator backend is running (`npm run server`)

### CommAnalysis FFmpeg errors

- Locally: install FFmpeg (`apt install ffmpeg` or `brew install ffmpeg`). The `ffmpeg-static` npm package may also work.
- In Docker: `ffmpeg-static` is included in node_modules

### Telegram bot not responding

- Check `BOT_TOKEN` is valid
- Ensure the bot has been started with `/start` in Telegram
- Check `BITRIX24_WEBHOOK_URL` is accessible

### Marking service: "ENOENT data directory"

- Create the data directory: `mkdir -p marking/data/production/orders`
- Or set `DATA_DIR` to a relative path in `.env`
