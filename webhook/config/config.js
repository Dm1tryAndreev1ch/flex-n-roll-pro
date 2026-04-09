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

function parseFloatSafe(val, fallback) {
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  server: {
    port: parseIntSafe(optional('PORT', '3000'), 3000),
    nodeEnv: optional('NODE_ENV', 'development'),
    isProduction: optional('NODE_ENV', 'development') === 'production',
  },

  openai: {
    apiKey:      optional('OPENAI_API_KEY', 'lm-studio'),
    baseURL:     optional('OPENAI_BASE_URL', 'http://localhost:1234/v1'),
    model:       optional('OPENAI_MODEL', 'local-model'),
    maxTokens:   parseIntSafe(optional('OPENAI_MAX_TOKENS', '1024'), 1024),
    temperature: parseFloatSafe(optional('OPENAI_TEMPERATURE', '0.2'), 0.2),
    timeout:     parseIntSafe(optional('OPENAI_TIMEOUT_MS', '30000'), 30000),
  },

  bitrix: {
    // Incoming webhook URL (fallback for API calls if OAuth not configured)
    webhookUrl:     optional('BITRIX_WEBHOOK_URL', ''),
    portalDomain:   optional('BITRIX_PORTAL_DOMAIN', ''),
    // Legacy outgoing webhook token (kept for backward compatibility)
    outgoingToken:  optional('BITRIX_OUTGOING_TOKEN', ''),
    timeout:        parseIntSafe(optional('BITRIX_TIMEOUT_MS', '15000'), 15000),
    // OAuth application credentials (local app)
    clientId:       optional('BITRIX_CLIENT_ID', ''),
    clientSecret:   optional('BITRIX_CLIENT_SECRET', ''),
    // Application token (from app settings in Bitrix24, used to verify incoming events)
    appToken:       optional('BITRIX_APP_TOKEN', ''),
  },

  ngrok: {
    authToken: optional('NGROK_AUTHTOKEN', ''),
    // Optional: fixed domain (paid ngrok plans only)
    domain:    optional('NGROK_DOMAIN', ''),
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

  pools: {
    sales:   optional('POOL_KEYWORDS_SALES',   'продаж,менеджер,sales').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
    tech:    optional('POOL_KEYWORDS_TECH',    'дизайн,технолог,prepress,tech').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
    quality: optional('POOL_KEYWORDS_QUALITY', 'качество,контроль,отк,quality').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
    marking: optional('POOL_KEYWORDS_MARKING', 'маркиров,честный знак,marking').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
    // Fallback user ID if no one matches the keywords
    fallbackIds: optional('POOL_FALLBACK_IDS', '1').split(',').map(Number).filter(n => !Number.isNaN(n)),
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