# FLEX-N-ROLL PRO

> **Production automation platform for a label printing company.**
> Integrates with Bitrix24 CRM, automates incoming requests via local AI, analyses calls, manages Honest Sign (Честный ЗНАК) product marking, and exposes a Telegram bot for order status lookups — all containerised in a single Docker Compose monorepo.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Bitrix24 Setup](#bitrix24-setup)
- [Monitoring](#monitoring)
- [Local Development (without Docker)](#local-development-without-docker)
- [Maintenance](#maintenance)
- [Known Issues](#known-issues)
- [Project Structure](#project-structure)

---

## Overview

FLEX-N-ROLL PRO is a **Node.js monorepo** powering backend automation for a label printing business. It connects to Bitrix24 as the CRM backbone and adds the following capabilities on top:

| Capability | How |
|---|---|
| Smart lead routing | Incoming CRM events classified by a local LLM (LM Studio) and assigned round-robin to managers |
| Call quality analysis | Sales calls transcribed with OpenAI Whisper, evaluated by GPT-4o, daily summary reports emailed |
| Product marking | Integration with Честный ЗНАК (GIS MT) state marking system; DataMatrix QR code generation |
| Order status bot | Telegram bot that lets clients and staff check the live status of any deal from Bitrix24 |
| Analytics dashboard | React SPA (Vite) with role-based access showing CRM analytics pulled directly from Bitrix24 |
| Observability | Prometheus metrics from all services; Grafana dashboards for runtime monitoring |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     fnr-net (bridge)                │
│                                                     │
│  Bitrix24 ──► fnr-webhook ──► fnr-redis             │
│                   │                                 │
│                   ├──► fnr-commanalysis             │
│                   ├──► fnr-marking                  │
│                   └──► fnr-status-bot (Telegram)    │
│                                                     │
│  Browser ──► fnr-calculator (React SPA + API)       │
│  Browser ──► fnr-analytics  (React SPA)             │
│                                                     │
│  Prometheus ◄── all services /metrics               │
│  Grafana    ◄── Prometheus                          │
└─────────────────────────────────────────────────────┘
```

All containers communicate over the internal `fnr-net` Docker bridge network using container names. **No host ports are exposed by default** (except `fnr-webhook:3000` and `fnr-grafana:3001`). A reverse proxy (nginx / Traefik) is expected in front for external access.

---

## Services

| Container | Description | Internal address |
|---|---|---|
| `fnr-webhook` | Receives Bitrix24 OAuth events, classifies with LM Studio (local LLM), routes to managers | `fnr-webhook:3000` |
| `fnr-calculator` | Label cost calculator – React SPA served by nginx | `fnr-calculator:80` |
| `fnr-calculator-api` | Express API for the calculator, integrated with Bitrix24 | `fnr-calculator-api:3001` |
| `fnr-commanalysis` | AI call analysis: Whisper transcription + GPT-4o evaluation | `fnr-commanalysis:3000` |
| `fnr-commanalysis-scheduler` | Daily batch report job (node-cron) | — |
| `fnr-status-bot` | Telegram bot for order status lookups (long-polling) | — |
| `fnr-marking` | Честный ЗНАК / GIS MT integration, DataMatrix QR generation | `fnr-marking:3000` |
| `fnr-analytics` | Analytics dashboard – React SPA served by nginx | `fnr-analytics:80` |
| `fnr-redis` | Cache, rate limiting, round-robin manager counters | `fnr-redis:6379` |
| `fnr-prometheus` | Metrics collection from all services | `fnr-prometheus:9090` |
| `fnr-grafana` | Metrics visualisation & dashboards | `fnr-grafana:3000` (host: `3001`) |

---

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Frontend**: React 18 + Vite (`fnr-analytics`, `calculator`)
- **Backend frameworks**: Express.js
- **AI / ML**: LM Studio (local LLM via OpenAI-compatible API), OpenAI Whisper (STT), GPT-4o (evaluation)
- **Integrations**: Bitrix24 REST API (OAuth + incoming webhooks), Честный ЗНАК GIS MT
- **Messaging**: Telegram Bot API (node-telegram-bot-api)
- **Infrastructure**: Docker, Docker Compose, Redis 7.2, Prometheus, Grafana
- **Tunnelling**: ngrok (for Bitrix24 → webhook event delivery in development)

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Docker | ≥ 24.0 |
| Docker Compose | ≥ 2.20 |
| LM Studio | Running on the host machine (port 1234) |
| Bitrix24 account | Admin rights required |
| Telegram Bot Token | Obtained from @BotFather |
| OpenAI API key | Used by `commanalysis` for Whisper + GPT |
| Честный ЗНАК credentials | Client ID, secret, INN, GTIN |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Dm1tryAndreev1ch/flex-n-roll-pro.git
cd flex-n-roll-pro
```

### 2. Create `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in all required variables (see [Environment Variables](#environment-variables)).

### 3. Start all services

```bash
docker compose up --build -d
```

### 4. Verify health

```bash
# All containers should show healthy / running
docker compose ps

# Check webhook
docker exec fnr-webhook curl -s http://localhost:3000/health

# Tail logs for a specific service
docker compose logs -f webhook
docker compose logs -f commanalysis
```

### 5. Start the calculator (separate compose file)

```bash
docker compose -f docker-compose.calculator.yml up --build -d
```

### 6. Start monitoring (Grafana + Prometheus)

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

Grafana is available at **http://localhost:3001** after startup.

### 7. Stop everything

```bash
docker compose down

# Remove persistent volumes (Redis data, logs, marking files)
docker compose down -v
```

### Access URLs

| Service | URL | Default credentials |
|---|---|---|
| FNR Analytics dashboard | `http://fnr-analytics:80` | `admin` / `admin123` · 2FA: `123456`<br>`analyst` / `analyst123` |
| Grafana | `http://localhost:3001` | See `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` in `.env` |

---

## Environment Variables

A single `.env` file in the repository root is shared by all services. Copy `.env.example` to get started.

### Bitrix24 – Incoming webhook (used by commanalysis, marking, fnr-status-bot)

```env
BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
BITRIX_PORTAL_DOMAIN=your-portal.bitrix24.ru
```

### Bitrix24 – OAuth application (used by webhook service for event subscription)

```env
BITRIX_CLIENT_ID=local.xxxxxxxx.xxxxxxxx
BITRIX_CLIENT_SECRET=xxxxxxxxxxxxxxxx
BITRIX_APP_TOKEN=xxxxxxxxxxxxxxxx
```

### ngrok (tunnels Bitrix24 events to the local webhook service)

```env
NGROK_AUTHTOKEN=xxxxxxxxxxxxxxxx
# NGROK_DOMAIN=your-domain.ngrok-free.app   # optional: fixed domain
```

### Telegram Bot

```env
BOT_TOKEN=<token from BotFather>
MANAGER_CONTACT=@your_manager
MANAGER_PHONE=+375XXXXXXXXX
```

### LM Studio (lead classification in webhook service)

```env
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
OPENAI_MODEL=local-model
```

### OpenAI (call analysis in commanalysis)

```env
COMMANALYSIS_OPENAI_API_KEY=sk-...
GPT_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
```

### Manager IDs in Bitrix24

```env
MANAGER_IDS_SALES=1,2,3
MANAGER_IDS_TECH=4
MANAGER_IDS_QUALITY=5
MANAGER_IDS_MARKING=6
```

### Честный ЗНАК / GIS MT

```env
MDLP_CLIENT_ID=your_client_id
MDLP_CLIENT_SECRET=your_client_secret
MDLP_PARTICIPANT_INN=your_inn
MDLP_DEFAULT_GTIN=your_gtin
```

### CRM funnel stages

```env
BITRIX_STAGE_PRODUCTION=C3:NEW
BITRIX_STAGE_SHIPMENT=C3:WON
BITRIX_STAGE_MARKING_DONE=C3:PREPARATION
BITRIX_OPERATOR_USER_ID=1
```

### Reports & SLA (optional)

```env
REPORT_MANAGER_USER_ID=1
REPORT_EMAIL=director@example.by

SLA_P1_HOURS=1
SLA_P2_HOURS=4
SLA_P3_HOURS=8
SLA_P4_HOURS=24
SLA_P5_HOURS=48
RATE_LIMIT_MAX=60
# WEBHOOK_SECRET=    # optional HMAC secret
# SKIP_VERIFY=true   # disable TLS verification in dev
```

---

## Bitrix24 Setup

### Incoming webhook (services → Bitrix24 API)

1. Go to **Settings → Integrations → Webhooks → Incoming Webhook**
2. Grant permissions: **CRM, Tasks, IM, Telephony**
3. Copy the generated URL to `BITRIX_WEBHOOK_URL`

### OAuth application (Bitrix24 → webhook service, for receiving events)

1. Go to **Developers → Other → Local Application**
2. Grant permissions: **CRM, Tasks, IM, Telephony**
3. Copy Client ID, Client Secret, App Token to the corresponding env vars
4. Register on [ngrok.com](https://ngrok.com) and set `NGROK_AUTHTOKEN`
5. Start the stack, then open `http://localhost:3000/install` to complete OAuth and auto-subscribe to events

The webhook service automatically subscribes to:

| Event | Action |
|---|---|
| `ONCRMLEADADD` | AI classification → manager routing |
| `ONIMCONNECTORMESSAGEADD` | IM message forwarding |
| `ONCRMDEALUPDATE` | Forwarded to `fnr-marking` |
| `ONVOXIMPLANTCALLEND` | Forwarded to `fnr-commanalysis` |

> Full setup guide: see [BITRIX_SETUP.md](./BITRIX_SETUP.md)

---

## Monitoring

Prometheus and Grafana run in a separate compose file so they can be managed independently.

```bash
# Start
docker compose -f docker-compose.monitoring.yml up -d

# Stop
docker compose -f docker-compose.monitoring.yml down
```

- **Prometheus** scrapes `/metrics` endpoints from all running services
- **Grafana** at `http://localhost:3001` — login configured via `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`

---

## Local Development (without Docker)

Useful for iterating on individual services.

### 1. Start Redis

```bash
docker run -d --name fnr-redis -p 6379:6379 redis:7.2-alpine redis-server --appendonly yes
```

### 2. Export env vars

```bash
export $(grep -v '^#' .env | xargs)
```

### 3. Run services individually

```bash
# Webhook
cd webhook && npm install && REDIS_URL=redis://localhost:6379 npm run dev

# Calculator API + Frontend
cd calculator && npm install && npm run server   # API
cd calculator && npm run dev                     # React SPA

# Call analysis
cd commanalysis && npm install && npm run dev

# Telegram bot
cd fnr-status-bot && npm install && npm start

# Marking
cd marking && npm install && npm run dev
mkdir -p marking/data/production/orders          # required on first run

# Analytics dashboard
cd fnr-analytics && npm install && npm run dev

# Daily batch scheduler (optional)
cd commanalysis && node scheduler/dailyBatch.js
```

---

## Maintenance

```bash
# Rebuild and restart a single service
docker compose up --build -d webhook

# Tail all logs
docker compose logs -f

# Clean unused images
docker image prune -f

# Backup marking data
docker run --rm \
  -v flex-n-roll-pro_marking-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/marking-backup-$(date +%Y%m%d).tar.gz /data
```

---

## Known Issues

### `npm install` from the monorepo root

`fnr-analytics` is **not** in the root npm workspaces list — install it separately:

```bash
npm install                         # installs webhook, calculator, commanalysis, fnr-status-bot, marking
cd fnr-analytics && npm install     # install analytics separately
```

### LM Studio unreachable from Docker on Linux

`host.docker.internal` does not resolve automatically on Linux. The `docker-compose.yml` already includes `extra_hosts: host.docker.internal:host-gateway` for the webhook service. If it still fails, verify your Docker version supports this feature (Docker 20.10+).

### Marking: data directory missing on first local run

```bash
mkdir -p marking/data/production/orders
```

In Docker, the volume `marking-data` is created automatically.

### Redis URL in local development

Use `redis://localhost:6379` (not `redis://redis:6379` — that is the in-container Docker address).

---

## Project Structure

```
flex-n-roll-pro/
├── .env.example                        # All environment variables template
├── docker-compose.yml                  # Main services (webhook, commanalysis, marking, bot, analytics, redis)
├── docker-compose.calculator.yml       # Calculator SPA + API (separate stack)
├── docker-compose.monitoring.yml       # Prometheus + Grafana
├── package.json                        # npm workspaces root
│
├── webhook/                            # Bitrix24 event receiver + LLM lead routing
├── calculator/                         # Label cost calculator (React SPA + Express API)
├── commanalysis/                       # AI call analysis (Whisper + GPT-4o)
│   └── scheduler/                      # Daily report cron job
├── fnr-status-bot/                     # Telegram order status bot
├── marking/                            # Честный ЗНАК / GIS MT integration
├── fnr-analytics/                      # Analytics dashboard (React + Vite)
└── monitoring/                         # Prometheus config & Grafana provisioning
```
