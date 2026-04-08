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

function parseIntSafe(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  server: {
    port: parseIntSafe(optional('PORT', '3000'), 3000),
    nodeEnv: optional('NODE_ENV', 'development'),
    isProduction: optional('NODE_ENV', 'development') === 'production',
  },

  webhook: {
    secret: required('WEBHOOK_SECRET'),
    signatureHeader: optional('WEBHOOK_SIGNATURE_HEADER', 'x-bitrix-signature'),
  },

  openai: {
    apiKey:      optional('OPENAI_API_KEY', 'lm-studio'),
    baseURL:     optional('OPENAI_BASE_URL', 'http://localhost:1234/v1'),
    model:       optional('OPENAI_MODEL', 'local-model'),
    maxTokens:   parseIntSafe(optional('OPENAI_MAX_TOKENS', '1024'), 1024),
    temperature: parseFloat(optional('OPENAI_TEMPERATURE', '0.2')),
    timeout:     parseIntSafe(optional('OPENAI_TIMEOUT_MS', '30000'), 30000),
  },

  bitrix: {
    webhookUrl: required('BITRIX_WEBHOOK_URL'),
    timeout:    parseIntSafe(optional('BITRIX_TIMEOUT_MS', '15000'), 15000),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  rateLimit: {
    windowMs:    parseIntSafe(optional('RATE_LIMIT_WINDOW_MS', '60000'), 60000),
    maxRequests: parseIntSafe(optional('RATE_LIMIT_MAX', '60'), 60),
  },

  retry: {
    maxAttempts: parseIntSafe(optional('RETRY_MAX_ATTEMPTS', '3'), 3),
    baseDelayMs: parseIntSafe(optional('RETRY_BASE_DELAY_MS', '500'), 500),
    maxDelayMs:  parseIntSafe(optional('RETRY_MAX_DELAY_MS', '8000'), 8000),
  },

  managers: {
    sales:   (optional('MANAGER_IDS_SALES',   '1,2,3')).split(',').map(Number),
    tech:    (optional('MANAGER_IDS_TECH',    '4')).split(',').map(Number),
    quality: (optional('MANAGER_IDS_QUALITY', '5')).split(',').map(Number),
    marking: (optional('MANAGER_IDS_MARKING', '6')).split(',').map(Number),
  },

  sla: {
    1: parseIntSafe(optional('SLA_P1_HOURS', '1'),  1),
    2: parseIntSafe(optional('SLA_P2_HOURS', '4'),  4),
    3: parseIntSafe(optional('SLA_P3_HOURS', '8'),  8),
    4: parseIntSafe(optional('SLA_P4_HOURS', '24'), 24),
    5: parseIntSafe(optional('SLA_P5_HOURS', '48'), 48),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR', './logs'),
  },
};

module.exports = config;