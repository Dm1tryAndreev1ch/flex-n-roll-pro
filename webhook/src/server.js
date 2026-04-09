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

// ─── ngrok & event binding ────────────────────────────────────────────────────
const { startTunnel, stopTunnel } = require('./services/ngrok');
const { bindAllEvents }           = require('./services/eventBinder');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

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
  const { getPublicUrl } = require('./services/ngrok');
  res.json({
    status:    'ok',
    service:   'flex-n-roll-webhook',
    timestamp: new Date().toISOString(),
    env:       config.server.nodeEnv,
    uptime:    process.uptime(),
    ngrok:     getPublicUrl() || null,
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

// ─── Start server + ngrok tunnel ──────────────────────────────────────────────
const PORT   = config.server.port;
const server = app.listen(PORT, async () => {
  logger.info(`[server] FLEX-N-ROLL webhook listening on port ${PORT}`, {
    env:  config.server.nodeEnv,
    port: PORT,
  });

  // Start ngrok tunnel (if configured)
  if (config.ngrok.authToken) {
    try {
      const publicUrl = await startTunnel(PORT);
      if (publicUrl) {
        logger.info(`[server] ngrok tunnel: ${publicUrl}`);

        // Bind Bitrix24 events to the public URL (if OAuth is already configured)
        try {
          await bindAllEvents(publicUrl);
        } catch (err) {
          logger.warn('[server] Event binding deferred — install the app first via /install', {
            error: err.message,
          });
        }
      }
    } catch (err) {
      logger.error('[server] Failed to start ngrok tunnel', { error: err.message });
      logger.warn('[server] Service is running but Bitrix24 events will not work without ngrok');
    }
  } else {
    logger.warn('[server] NGROK_AUTHTOKEN not set — running without tunnel. Set it in .env to receive Bitrix24 events.');
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info(`[server] Received ${signal}, shutting down gracefully…`);

  // Stop ngrok tunnel
  await stopTunnel();

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
