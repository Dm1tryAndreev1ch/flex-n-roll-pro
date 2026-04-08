// src/server.js
'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const helmet     = require('helmet');

const config  = require('../config/config');
const logger  = require('./utils/logger');
const { verifyBitrixRequest } = require('./middleware/auth');
const { webhookRateLimit }    = require('./middleware/rateLimit');
const webhookRouter           = require('./routes/webhook');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// Trust first proxy (nginx, Cloudflare, etc.) for correct client IP
app.set('trust proxy', 1);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// ─── Health check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'flex-n-roll-webhook',
    timestamp: new Date().toISOString(),
    env:       config.server.nodeEnv,
    uptime:    process.uptime(),
  });
});

// ─── Webhook routes ───────────────────────────────────────────────────────────
app.use(
  '/webhook',
  webhookRateLimit,
  verifyBitrixRequest,
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
    error:  err.message,
    stack:  err.stack,
    path:   req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT   = config.server.port;
const server = app.listen(PORT, () => {
  logger.info(`[server] FLEX-N-ROLL webhook listening on port ${PORT}`, {
    env:  config.server.nodeEnv,
    port: PORT,
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
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

module.exports = app;
