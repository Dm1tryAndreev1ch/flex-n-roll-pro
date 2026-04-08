'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');

// ── Валидация обязательных переменных ──────────────────────────────────────
const REQUIRED = ['COMMANALYSIS_OPENAI_API_KEY', 'BITRIX_WEBHOOK_URL'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error(`[config] Отсутствуют переменные окружения: ${missing.join(', ')}`);
}

// ── Создание временной директории ─────────────────────────────────────────
const TMP_DIR = process.env.TMP_DIR || '/tmp/commanalysis';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Создание директории логов ──────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR || './logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

module.exports = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    apiKey:       process.env.COMMANALYSIS_OPENAI_API_KEY,
    gptModel:     process.env.GPT_MODEL     || 'gpt-4o',
    whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
  },

  // ── Битрикс24 ─────────────────────────────────────────────────────────────
  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL.replace(/\/$/, ''),
    portal:     process.env.BITRIX_PORTAL_DOMAIN || '',
  },

  // ── Сервер ────────────────────────────────────────────────────────────────
  server: {
    port:     parseInt(process.env.PORT || '3000', 10),
    nodeEnv:  process.env.NODE_ENV || 'development',
  },

  // ── Аудио / Whisper ───────────────────────────────────────────────────────
  audio: {
    chunkSizeMB: parseFloat(process.env.WHISPER_CHUNK_SIZE_MB || '24'),
    tmpDir:      TMP_DIR,
    defaultLang: process.env.DEFAULT_LANGUAGE || 'ru',
    supportedLangs: ['ru', 'be'],
  },

  // ── Отчёты ────────────────────────────────────────────────────────────────
  reports: {
    managerUserId: process.env.REPORT_MANAGER_USER_ID || '1',
    email:         process.env.REPORT_EMAIL || '',
  },

  // ── Логирование ───────────────────────────────────────────────────────────
  logging: {
    level:  process.env.LOG_LEVEL || 'info',
    logDir: LOG_DIR,
  },
};