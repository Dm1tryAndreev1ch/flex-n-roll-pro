'use strict';

require('dotenv').config();
const path = require('path');

// ---------------------------------------------------------------------------
// Валидация обязательных переменных окружения
// ---------------------------------------------------------------------------
const REQUIRED_ENV = [
  'MDLP_CLIENT_ID',
  'MDLP_CLIENT_SECRET',
  'BITRIX_WEBHOOK_URL',
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[config] Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Конфигурационный объект
// ---------------------------------------------------------------------------
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mdlp: {
    clientId: process.env.MDLP_CLIENT_ID,
    clientSecret: process.env.MDLP_CLIENT_SECRET,
    baseUrl: process.env.MDLP_BASE_URL || 'https://api.mdlp.crpt.ru',
    tokenUrl:
      process.env.MDLP_TOKEN_URL ||
      'https://api.mdlp.crpt.ru/api/v3/true-api/auth/token',
    participantInn: process.env.MDLP_PARTICIPANT_INN || '',
    defaultGtin: process.env.MDLP_DEFAULT_GTIN || '',
    /** Интервал поллинга статуса заявки, мс */
    pollIntervalMs: 5000,
    /** Максимальное время ожидания заявки, мс (15 мин) */
    pollTimeoutMs: 15 * 60 * 1000,
  },

  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL,
    portalDomain: process.env.BITRIX_PORTAL_DOMAIN || '',
    stages: {
      production: process.env.BITRIX_STAGE_PRODUCTION || 'C3:NEW',
      shipment: process.env.BITRIX_STAGE_SHIPMENT || 'C3:WON',
      markingDone: process.env.BITRIX_STAGE_MARKING_DONE || 'C3:PREPARATION',
    },
    operatorUserId: parseInt(process.env.BITRIX_OPERATOR_USER_ID, 10) || 1,
  },

  storage: {
    dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    productionDir:
      process.env.PRODUCTION_DIR ||
      path.join(__dirname, 'data', 'production', 'orders'),
    codesDbPath:
      process.env.CODES_DB_PATH ||
      path.join(__dirname, 'data', 'codes_db.json'),
  },

  security: {
    webhookSecret: (() => {
      const secret = process.env.WEBHOOK_SECRET || '';
      if (!secret && process.env.NODE_ENV === 'production') {
        console.warn('[marking] WARNING: WEBHOOK_SECRET is not set — webhook endpoint is unprotected');
      }
      return secret;
    })(),
  },

  /**
   * Соответствие категорий продукта кодам товарных групп ГИС МТ.
   * Битрикс24-поле UF_CRM_PRODUCT_CATEGORY → идентификатор группы MDLP.
   */
  productGroupMap: {
    молочная: 'milk',
    фармацевтика: 'pharma',
    табак: 'tobacco',
    обувь: 'shoes',
  },
};

module.exports = config;