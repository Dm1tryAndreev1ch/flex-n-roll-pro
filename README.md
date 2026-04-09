# FLEX-N-ROLL PRO

> **Production automation platform for a label printing company.**
> Integrates with Bitrix24 CRM, automates incoming requests via a locally-hosted Ollama LLM, analyses calls with OpenAI Whisper + GPT-4o, manages Honest Sign (Честный ЗНАК) product marking, and exposes a Telegram bot for order status lookups — all containerised in a single Docker Compose monorepo.

> **Branch: `remove-ngrok`**
> This branch removes the ngrok tunnel dependency entirely. Bitrix24 event delivery now uses a **direct public IP/URL** (`PUBLIC_APP_URL`), and the local LLM backend has been migrated from **LM Studio → Ollama** (running as a `systemd` service on the host, default port `11434`).

---

## What Changed from `main`

| Area | `main` | `remove-ngrok` (this branch) |
|---|---|---|
| Bitrix24 event tunnel | ngrok (`NGROK_AUTHTOKEN`, optional `NGROK_DOMAIN`) | Direct public server IP (`PUBLIC_APP_URL`) |
| Local LLM backend | LM Studio on port `1234` | Ollama `systemd` service on port `11434` |
| LLM env vars | `OPENAI_BASE_URL=http://host.docker.internal:1234/v1` | `OPENAI_BASE_URL=http://host.docker.internal:11434/v1` |
| LLM model default | `local-model` | `qwen2.5:14b` |
| New docs | — | `OLLAMA_UBUNTU.md` — Ollama setup guide for Ubuntu (CPU-only, 60 GB RAM) |
| Install step | `http://localhost:3000/install` after ngrok starts | `http://localhost:3000/install` after setting `PUBLIC_APP_URL` |

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Ollama Setup (Local LLM)](#ollama-setup-local-llm)
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
| Smart lead routing | Incoming CRM events classified by a local Ollama LLM and assigned round-robin to managers |
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
│  (direct IP, no tunnel)   │                        │
│                           ├──► fnr-commanalysis     │
│                           ├──► fnr-marking          │
│                           └──► fnr-status-bot       │
│                                                     │
│  Browser ──► fnr-calculator (React SPA + API)       │
│  Browser ──► fnr-analytics  (React SPA)             │
│                                                     │
│  Prometheus ◄── all services /metrics               │
│  Grafana    ◄── Prometheus                          │
└─────────────────────────────────────────────────────┘
       │
  Host machine
  Ollama :11434  ◄───────────────── fnr-webhook
  (qwen2.5:14b)
```

All containers communicate over the internal `fnr-net` Docker bridge network using container names. **No host ports are exposed by default** (except `fnr-webhook:3000` and `fnr-grafana:3001`). A reverse proxy (nginx / Traefik) is expected in front for external access. Bitrix24 sends events directly to the server's public IP — no tunnel required.

---

## Services

| Container | Description | Internal address |
|---|---|---|
| `fnr-webhook` | Receives Bitrix24 OAuth events, classifies with Ollama (local LLM), routes to managers | `fnr-webhook:3000` |
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
- **AI / ML**: Ollama with Qwen2.5 14B (local LLM, CPU), OpenAI Whisper (STT), GPT-4o (evaluation)
- **Integrations**: Bitrix24 REST API (OAuth + incoming webhooks), Честный ЗНАК GIS MT
- **Messaging**: Telegram Bot API (node-telegram-bot-api)
- **Infrastructure**: Docker, Docker Compose, Redis 7.2, Prometheus, Grafana

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Docker | ≥ 24.0 |
| Docker Compose | ≥ 2.20 |
| Ollama | Running as `systemd` service on the host (port `11434`); see [Ollama Setup](#ollama-setup-local-llm) |
| Public server IP/URL | The host must be reachable by Bitrix24 (no tunnel needed) |
| Bitrix24 account | Admin rights required |
| Telegram Bot Token | Obtained from @BotFather |
| OpenAI API key | Used by `commanalysis` for Whisper + GPT |
| Честный ЗНАК credentials | Client ID, secret, INN, GTIN |

---

## Ollama Setup (Local LLM)

This branch replaces LM Studio with **Ollama** running as a Linux `systemd` service. Full instructions are in [OLLAMA_UBUNTU.md](./OLLAMA_UBUNTU.md). Quick summary:

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl status ollama   # verify it's running
```

### 2. Configure Ollama to listen on all interfaces

By default Ollama only accepts connections from `127.0.0.1`. Docker containers need to reach it via `host.docker.internal`, so expose it on `0.0.0.0`:

```bash
sudo systemctl edit ollama.service
```

Add inside the file:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Then restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 3. Pull the recommended model

**Qwen2.5 14B** is recommended for CPU-only servers with ≥60 GB RAM — it handles Russian well, fits in ~10 GB RAM, and generates 5–15 tokens/sec on a multi-core CPU (fast enough for Bitrix24 webhook timeouts).

```bash
ollama pull qwen2.5:14b
```

Alternatives:
- `qwen2.5:32b` — smarter, but slower
- `llama3.1` — faster Llama-3.1 8B (weaker Russian support)

### 4. Verify integration env vars in `.env`

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL=qwen2.5:14b
```

> The `fnr-webhook` container is pre-configured with `extra_hosts: ["host.docker.internal:host-gateway"]` so it can reach port `11434` on the host.

---

## Quick Start

### 1. Clone the repository

```bash
git clone -b remove-ngrok https://github.com/Dm1tryAndreev1ch/flex-n-roll-pro.git
cd flex-n-roll-pro
```

### 2. Create `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in all required variables. Key fields for this branch:

```env
PUBLIC_APP_URL=http://<your-server-public-ip>:3000
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL=qwen2.5:14b
```

### 3. Start Ollama on the host (if not already running)

```bash
sudo systemctl start ollama
ollama pull qwen2.5:14b   # only needed once
```

### 4. Start all services

```bash
docker compose up --build -d
```

### 5. Complete OAuth setup with Bitrix24

Open the install URL in your browser to register the OAuth app and auto-subscribe to events:

```
http://<your-server-public-ip>:3000/install
```

### 6. Verify health

```bash
docker compose ps
docker exec fnr-webhook curl -s http://localhost:3000/health
docker compose logs -f webhook
```

### 7. Start the calculator (separate compose file)

```bash
docker compose -f docker-compose.calculator.yml up --build -d
```

### 8. Start monitoring (Grafana + Prometheus)

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

Grafana is available at **http://localhost:3001**.

### 9. Stop everything

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

### General

```env
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=./logs
```

### Bitrix24 – Incoming webhook (used by commanalysis, marking, fnr-status-bot)

```env
BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
VITE_BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
BITRIX_PORTAL_DOMAIN=your-portal.bitrix24.ru
BITRIX_TIMEOUT_MS=15000
```

### Bitrix24 – OAuth application (used by webhook service for event subscription)

```env
BITRIX_CLIENT_ID=local.xxxxxxxx.xxxxxxxx
BITRIX_CLIENT_SECRET=xxxxxxxxxxxxxxxx
BITRIX_APP_TOKEN=xxxxxxxxxxxxxxxx
```

### Public App URL (replaces ngrok)

```env
# The public IP/hostname of the server where the webhook service runs
PUBLIC_APP_URL=http://192.168.107.5:3000
```

### Telegram Bot

```env
BOT_TOKEN=<token from BotFather>
MANAGER_CONTACT=@fnr_manager
MANAGER_PHONE=+375XXXXXXXXX
```

### Ollama (lead classification in webhook service)

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL=qwen2.5:14b
OPENAI_MAX_TOKENS=3048
OPENAI_TEMPERATURE=0.2
OPENAI_TIMEOUT_MS=30000
```

### OpenAI (call analysis in commanalysis)

```env
COMMANALYSIS_OPENAI_API_KEY=sk-...
GPT_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
WHISPER_CHUNK_SIZE_MB=24
DEFAULT_LANGUAGE=ru
```

### Redis

```env
REDIS_URL=redis://redis:6379
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

### Retry policy

```env
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=500
RETRY_MAX_DELAY_MS=8000
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
MDLP_BASE_URL=https://api.mdlp.crpt.ru
MDLP_TOKEN_URL=https://api.mdlp.crpt.ru/api/v3/true-api/auth/token
MDLP_PARTICIPANT_INN=your_inn
MDLP_DEFAULT_GTIN=your_gtin
```

### CRM funnel stages

```env
BITRIX_STAGE_PRODUCTION=C3:NEW
BITRIX_STAGE_SHIPMENT=C3:WON
BITRIX_STAGE_MARKING_DONE=C3:PREPARATION
BITRIX_OPERATOR_USER_ID=1
WEBHOOK_SECRET=        # optional HMAC secret for marking webhooks
```

### Reports, SLA & other

```env
REPORT_MANAGER_USER_ID=1
REPORT_EMAIL=director@flex-n-roll.by
TMP_DIR=/tmp/commanalysis

SLA_P1_HOURS=1
SLA_P2_HOURS=4
SLA_P3_HOURS=8
SLA_P4_HOURS=24
SLA_P5_HOURS=48

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin

# SKIP_VERIFY=true   # Disable Bitrix24 domain verification in development
```

---

## Bitrix24 Setup

### Incoming webhook (services → Bitrix24 API)

1. Go to **Settings → Integrations → Webhooks → Incoming Webhook**
2. Grant permissions: **CRM, Tasks, IM, Telephony**
3. Copy the generated URL to `BITRIX_WEBHOOK_URL` (and `VITE_BITRIX_WEBHOOK_URL`)

### OAuth application (Bitrix24 → webhook service, for receiving events)

1. Go to **Developers → Other → Local Application**
2. Grant permissions: **CRM, Tasks, IM, Telephony**
3. Copy Client ID, Client Secret, App Token to the corresponding env vars
4. Set `PUBLIC_APP_URL` to the public address of your server (e.g. `http://203.0.113.10:3000`)
5. Start the stack, then open `http://<PUBLIC_APP_URL>/install` to complete OAuth and auto-subscribe to events

> **No ngrok required.** Bitrix24 sends events directly to `PUBLIC_APP_URL`. Ensure port `3000` is open on your server firewall.

The webhook service automatically subscribes to:

| Event | Action |
|---|---|
| `ONCRMLEADADD` | AI classification (Ollama) → manager routing |
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
- **Grafana** at `http://localhost:3001` — credentials set via `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`

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
# Webhook (note: local Redis URL)
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

### Ollama unreachable from Docker on Linux

Ensure `OLLAMA_HOST=0.0.0.0:11434` is set in the Ollama systemd override (see [Ollama Setup](#ollama-setup-local-llm)). The `fnr-webhook` container already has `extra_hosts: ["host.docker.internal:host-gateway"]` to resolve the host address. Verify with:

```bash
docker exec fnr-webhook curl -s http://host.docker.internal:11434/api/tags
```

### Bitrix24 event delivery failing

Bitrix24 must be able to reach `PUBLIC_APP_URL` over the internet. Check:
1. Port `3000` is open in your server's firewall / security group
2. `PUBLIC_APP_URL` in `.env` matches the actual public IP/hostname
3. Run `http://<PUBLIC_APP_URL>/install` again if the event subscription was lost

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
├── BITRIX_SETUP.md                     # Bitrix24 OAuth + event setup guide
├── OLLAMA_UBUNTU.md                    # Ollama installation guide (Ubuntu, CPU-only)
│
├── webhook/                            # Bitrix24 event receiver + Ollama lead routing
├── calculator/                         # Label cost calculator (React SPA + Express API)
├── commanalysis/                       # AI call analysis (Whisper + GPT-4o)
│   └── scheduler/                      # Daily report cron job
├── fnr-status-bot/                     # Telegram order status bot
├── marking/                            # Честный ЗНАК / GIS MT integration
├── fnr-analytics/                      # Analytics dashboard (React + Vite)
└── monitoring/                         # Prometheus config & Grafana provisioning
```
