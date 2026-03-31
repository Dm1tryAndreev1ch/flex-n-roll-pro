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