// src/middleware/rateLimit.js
'use strict';

const rateLimit = require('express-rate-limit');
const config    = require('../../config/config');
const logger    = require('../utils/logger');

let limiter;

/**
 * Build and return the rate-limiter middleware.
 * Tries Redis-backed store first; falls back to in-memory if Redis is unavailable.
 */
async function buildRateLimiter() {
  if (limiter) return limiter;

  const baseOptions = {
    windowMs:        config.rateLimit.windowMs,
    max:             config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator:    (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
    handler:         (req, res) => {
      logger.warn('[rateLimit] Rate limit exceeded', {
        ip:       req.ip,
        path:     req.path,
        limit:    config.rateLimit.maxRequests,
        windowMs: config.rateLimit.windowMs,
      });
      res.status(429).json({
        error:      'Too many requests',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      });
    },
    skip: (req) => req.path === '/health',
  };

  // Attempt Redis-backed store
  try {
    const RedisStore          = require('rate-limit-redis');
    const { createClient }    = require('redis');
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

  // Fallback: in-memory store (works for single-instance deployment)
  limiter = rateLimit(baseOptions);
  logger.info('[rateLimit] Using in-memory rate limiter');
  return limiter;
}

// ─── Express middleware factory (lazy init) ──────────────────────────────────
let initPromise = null;

function webhookRateLimit(req, res, next) {
  if (!initPromise) {
    initPromise = buildRateLimiter();
  }
  initPromise
    .then((mw) => mw(req, res, next))
    .catch((err) => {
      logger.error('[rateLimit] Failed to build rate limiter', { error: err.message });
      next(); // Fail open — don't block requests if limiter fails
    });
}

module.exports = { webhookRateLimit, buildRateLimiter };