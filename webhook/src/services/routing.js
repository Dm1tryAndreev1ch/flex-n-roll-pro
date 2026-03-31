// src/services/routing.js
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');

// Mapping from route_to label → manager pool name
const ROUTE_MAP = {
  sales:   'sales',
  tech:    'tech',
  quality: 'quality',
  marking: 'marking',
};

// Defaults for unknown / unmapped routes
const DEFAULT_POOL = 'sales';

// ─── Round-robin counter store ────────────────────────────────────────────────
// Uses Redis if available, otherwise a JSON file.

let _redisClient = null;
let _fileCounters = {};

async function _initRedis() {
  if (_redisClient) return _redisClient;
  if (config.redis.useFile) return null;

  try {
    const { createClient } = require('redis');
    const client = createClient({ url: config.redis.url });
    client.on('error', (err) => logger.error('[routing] Redis error', { error: err.message }));
    await client.connect();
    _redisClient = client;
    logger.info('[routing] Connected to Redis for round-robin counters');
    return client;
  } catch (err) {
    logger.warn('[routing] Redis unavailable for routing counters; using file fallback', {
      error: err.message,
    });
    _redisClient = null;
    return null;
  }
}

function _loadFileCounters() {
  try {
    const dir = path.dirname(config.redis.counterFile);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(config.redis.counterFile)) {
      _fileCounters = JSON.parse(fs.readFileSync(config.redis.counterFile, 'utf8'));
    }
  } catch (err) {
    logger.warn('[routing] Could not load counter file', { error: err.message });
  }
}

function _saveFileCounters() {
  try {
    const dir = path.dirname(config.redis.counterFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.redis.counterFile, JSON.stringify(_fileCounters, null, 2), 'utf8');
  } catch (err) {
    logger.error('[routing] Could not save counter file', { error: err.message });
  }
}

_loadFileCounters();

/**
 * Atomically increment a counter for a pool and return the new value.
 * Used to implement round-robin assignment.
 */
async function _incrementCounter(pool) {
  const key = `fnr:routing:${pool}`;

  const redis = await _initRedis();
  if (redis) {
    try {
      return Number(await redis.incr(key));
    } catch (err) {
      logger.warn('[routing] Redis incr failed, falling back to file', { error: err.message });
    }
  }

  // File fallback
  _fileCounters[key] = (_fileCounters[key] || 0) + 1;
  _saveFileCounters();
  return _fileCounters[key];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Select the next manager for a given pool using round-robin.
 *
 * @param {string} pool - Pool name: 'sales' | 'tech' | 'quality' | 'marking'
 * @returns {Promise<number>} Bitrix24 user ID of the selected manager
 */
async function getNextManager(pool) {
  const normalised = (ROUTE_MAP[pool] || DEFAULT_POOL);
  const managers   = config.managers[normalised];

  if (!managers || managers.length === 0) {
    logger.warn('[routing] No managers configured for pool, using default', { pool: normalised });
    return config.managers[DEFAULT_POOL][0];
  }

  if (managers.length === 1) {
    return managers[0];
  }

  const counter = await _incrementCounter(normalised);
  const index   = (counter - 1) % managers.length;
  const manager = managers[index];

  logger.info('[routing] Assigned manager via round-robin', {
    pool: normalised,
    counter,
    index,
    managerId: manager,
  });

  return manager;
}

/**
 * Resolve the pool name from a GPT-4 classification result.
 *
 * @param {object} classification - Output of classifyMessage()
 * @returns {string} Pool name
 */
function resolvePool(classification) {
  const { route_to, intent } = classification;

  // Direct route_to takes priority
  if (route_to && ROUTE_MAP[route_to]) {
    return ROUTE_MAP[route_to];
  }

  // Fallback mapping by intent
  const intentMap = {
    quote_request:   'sales',
    order_placement: 'sales',
    reorder:         'sales',
    design_question: 'tech',
    technical_issue: 'quality',
    delivery_inquiry:'sales',
    general_inquiry: 'sales',
    spam:            'sales',
  };

  return intentMap[intent] || DEFAULT_POOL;
}

/**
 * Build a human-readable task title based on classification.
 */
function buildTaskTitle(classification, leadId) {
  const intentLabels = {
    quote_request:    'Запрос КП',
    order_placement:  'Новый заказ',
    reorder:          'Повторный заказ',
    design_question:  'Вопрос по макету',
    technical_issue:  'Рекламация',
    delivery_inquiry: 'Запрос по доставке',
    general_inquiry:  'Общий запрос',
    spam:             'Спам',
  };

  const productLabels = {
    wide_format: 'Широкоформатная печать',
    interior:    'Интерьерная печать',
    souvenirs:   'Сувениры',
    polygraphy:  'Полиграфия',
    labeling:    'Маркировка',
    express:     'Срочный заказ',
    post_print:  'Постпечать',
    unknown:     'Продукт не определён',
  };

  const intentLabel   = intentLabels[classification.intent]      || classification.intent;
  const productLabel  = productLabels[classification.product_type] || classification.product_type;
  const priorityLabel = classification.priority === 1 ? ' [HOT]' : '';

  return `[Лид #${leadId}]${priorityLabel} ${intentLabel} — ${productLabel}`;
}

/**
 * Build the task description from the classification and extracted data.
 */
function buildTaskDescription(classification, leadId) {
  const { extracted_data: d } = classification;
  const lines = [
    `Лид: #${leadId}`,
    `Намерение: ${classification.intent}`,
    `Продукт: ${classification.product_type}`,
    `Срочность: ${classification.urgency}`,
    `Приоритет: P${classification.priority}`,
    '',
    '─── Данные из заявки ───',
  ];

  if (d.contact_name)  lines.push(`Клиент: ${d.contact_name}`);
  if (d.company)       lines.push(`Компания: ${d.company}`);
  if (d.contact_phone) lines.push(`Телефон: ${d.contact_phone}`);
  if (d.contact_email) lines.push(`Email: ${d.contact_email}`);
  if (d.quantity)      lines.push(`Тираж: ${d.quantity}`);
  if (d.dimensions)    lines.push(`Размеры: ${d.dimensions}`);
  if (d.material)      lines.push(`Материал: ${d.material}`);
  if (d.deadline)      lines.push(`Срок клиента: ${d.deadline}`);
  if (d.budget)        lines.push(`Бюджет: ${d.budget} руб.`);
  if (d.has_files && d.file_names.length) {
    lines.push(`Файлы: ${d.file_names.join(', ')}`);
  }
  if (d.notes) lines.push(`Примечания: ${d.notes}`);

  return lines.join('\n');
}

module.exports = {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
  ROUTE_MAP,
};