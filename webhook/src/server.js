// src/server.js
'use strict';

const express    = require('express');
const helmet     = require('helmet');

const config  = require('../config/config');
const logger  = require('./utils/logger');
const { metricsMiddleware, metricsEndpoint } = require('./utils/metrics');
const { verifyBitrixRequest } = require('./middleware/auth');
const { webhookRateLimit }    = require('./middleware/rateLimit');
const webhookRouter           = require('./routes/webhook');
const installRouter           = require('./routes/install');
const eventsRouter            = require('./routes/events');

// ─── Event binding ──────────────────────────────────────────────────────────────
const { bindAllEvents }           = require('./services/eventBinder');
const { provisionAllFields }      = require('./services/fieldProvisioner');
const slaMonitor                  = require('./services/slaMonitor');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  xFrameOptions: false,
}));

// Trust first proxy (nginx, Cloudflare, ngrok, etc.) for correct client IP
app.set('trust proxy', 1);

// ─── Prometheus metrics ───────────────────────────────────────────────────────
app.use(metricsMiddleware);
app.get('/metrics', metricsEndpoint);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ─── Health check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'flex-n-roll-webhook',
    timestamp: new Date().toISOString(),
    env:       config.server.nodeEnv,
    uptime:    process.uptime(),
    appUrl:    config.appUrl || null,
  });
});

// ─── OAuth installation routes (no auth) ──────────────────────────────────────
app.use('/install', installRouter);

// ─── Webhook routes (Bitrix24 events for leads & IM) ──────────────────────────
app.use(
  '/webhook',
  webhookRateLimit,
  verifyBitrixRequest,
  webhookRouter
);

// ─── Event Gateway routes (forward to internal services) ──────────────────────
app.use(
  '/events',
  verifyBitrixRequest,
  eventsRouter
);

// ─── Serve Analytics UI inside Bitrix24 iframe ────────────────────────────────
app.all('/', async (req, res) => {
  // Bulletproof against Bitrix24 config mistake where Redirect URI is set to '/'
  if (req.method === 'GET' && req.query.code) {
    logger.info('[server] Caught OAuth code on root / URL, redirecting to /install/callback');
    return res.redirect(`/install/callback?code=${req.query.code}&domain=${req.query.domain || ''}`);
  }

  try {
    const axios = require('axios');
    // Fetch the single-file compiled React app from the analytics container
    const response = await axios.get('http://fnr-analytics:80/');
    res.set('Content-Type', 'text/html');
    res.send(response.data);
  } catch (err) {
    logger.error('[server] Failed to proxy analytics UI', { error: err.message });
    res.status(500).send('Аналитика временно недоступна');
  }
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('[server] Unhandled Express error', {
    error:  err.message,
    stack:  err.stack,
    path:   req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server + event binding ─────────────────────────────────────────────
const PORT   = config.server.port;
const server = app.listen(PORT, async () => {
  logger.info(`[server] FLEX-N-ROLL webhook listening on port ${PORT}`, {
    env:  config.server.nodeEnv,
    port: PORT,
  });

  const publicUrl = config.appUrl;
  if (publicUrl) {
    logger.info(`[server] App public URL: ${publicUrl}`);

    // Bind Bitrix24 events to the public URL (if OAuth is already configured)
    try {
      await bindAllEvents(publicUrl);
    } catch (err) {
      logger.warn('[server] Event binding deferred — install the app first via /install', {
        error: err.message,
      });
    }

    // Provision custom UF fields in CRM (idempotent)
    try {
      await provisionAllFields();
    } catch (err) {
      logger.warn('[server] Field provisioning deferred', { error: err.message });
    }

    // Start SLA monitor
    slaMonitor.start();
  } else {
    logger.warn('[server] PUBLIC_APP_URL not set — running without event binding. Set it in .env to receive Bitrix24 events.');
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info(`[server] Received ${signal}, shutting down gracefully…`);

  // Stop SLA monitor
  slaMonitor.stop();

  // Signal rate limiter to cleanup Redis
  const { cleanup } = require('./middleware/rateLimit');
  if (cleanup) await cleanup();

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

module.exports = app;
