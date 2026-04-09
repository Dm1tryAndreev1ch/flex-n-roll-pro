// src/services/routing.js
'use strict';

const fs     = require('fs');
const path   = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');

// Mapping from route_to label → manager pool name
const ROUTE_MAP = {
  sales:   'sales',
  tech:    'tech',
  quality: 'quality',
  marking: 'marking',
};

const DEFAULT_POOL = 'sales';

// Counter file path (fallback when Redis is unavailable)
const COUNTER_FILE = path.resolve(__dirname, '../../data/routing_counters.json');

// ─── Round-robin counter store ────────────────────────────────────────────────
// Uses Redis if available, otherwise a local JSON file.

let _redisClient  = null;
let _redisReady   = false;
let _fileCounters = {};

async function _initRedis() {
  if (_redisClient) return _redisReady ? _redisClient : null;

  try {
    const { createClient } = require('redis');
    const client = createClient({ url: config.redis.url });

    client.on('error', (err) => {
      logger.error('[routing] Redis error', { error: err.message });
      _redisReady = false;
    });

    client.on('ready', () => {
      _redisReady = true;
    });

    await client.connect();
    _redisClient = client;
    _redisReady  = true;
    logger.info('[routing] Connected to Redis for round-robin counters');
    return client;
  } catch (err) {
    logger.warn('[routing] Redis unavailable; using file fallback', { error: err.message });
    _redisClient = null;
    _redisReady  = false;
    return null;
  }
}

function _loadFileCounters() {
  try {
    const dir = path.dirname(COUNTER_FILE);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(COUNTER_FILE)) {
      _fileCounters = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    }
  } catch (err) {
    logger.warn('[routing] Could not load counter file', { error: err.message });
  }
}

function _saveFileCounters() {
  try {
    const dir = path.dirname(COUNTER_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(_fileCounters, null, 2), 'utf8');
  } catch (err) {
    logger.error('[routing] Could not save counter file', { error: err.message });
  }
}

// Load counters from file on startup
_loadFileCounters();

/**
 * Atomically increment a counter for a pool and return the new value.
 */
async function _incrementCounter(pool) {
  const key = `fnr:routing:${pool}`;

  const redis = await _initRedis();
  if (redis && _redisReady) {
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

let _managerCache  = null;
let _lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function _refreshManagerCache() {
  const now = Date.now();
  if (_managerCache && (now - _lastCacheTime < CACHE_TTL_MS)) {
    return _managerCache;
  }

  const bitrix = require('./bitrix');
  try {
    const users = await bitrix.getUsers();
    const newCache = { sales: [], tech: [], quality: [], marking: [] };

    for (const user of users) {
      // Skip inactive users just in case filter fails
      if (user.ACTIVE && user.ACTIVE !== 'Y' && user.ACTIVE !== true) continue;

      const position = (user.WORK_POSITION || '').toLowerCase();
      const id = Number(user.ID);
      if (!position || isNaN(id)) continue;
      
      logger.info(`[routing] Found active user`, { id, name: user.NAME, position });

      if (config.pools.sales.some(k => position.includes(k)))   newCache.sales.push(id);
      else if (config.pools.tech.some(k => position.includes(k)))    newCache.tech.push(id);
      else if (config.pools.quality.some(k => position.includes(k))) newCache.quality.push(id);
      else if (config.pools.marking.some(k => position.includes(k))) newCache.marking.push(id);
    }

    _managerCache = newCache;
    _lastCacheTime = now;
    logger.info('[routing] Refreshed active workers cache', { 
      totalActive: users.length, 
      matched: { 
        sales: newCache.sales.length, tech: newCache.tech.length, 
        quality: newCache.quality.length, marking: newCache.marking.length 
      }
    });
  } catch (err) {
    logger.error('[routing] Failed to fetch users from Bitrix24', { error: err.message });
    if (!_managerCache) {
      _managerCache = { sales: [], tech: [], quality: [], marking: [] };
    }
  }

  return _managerCache;
}

/**
 * Select the next manager for a given pool using round-robin.
 *
 * @param {string} pool - Pool name: 'sales' | 'tech' | 'quality' | 'marking'
 * @returns {Promise<number>} Bitrix24 user ID of the selected manager
 */
async function getNextManager(pool) {
  const normalised = ROUTE_MAP[pool] || DEFAULT_POOL;
  const cache = await _refreshManagerCache();
  
  let managers = cache[normalised];

  // Try DEFAULT_POOL if specific pool is empty
  if ((!managers || managers.length === 0) && normalised !== DEFAULT_POOL) {
    logger.warn(`[routing] No workers found for pool ${normalised}, falling back to ${DEFAULT_POOL}`);
    managers = cache[DEFAULT_POOL];
  }

  // Fallback to absolute default IDs if no one is found anywhere
  if (!managers || managers.length === 0) {
    managers = config.pools.fallbackIds;
    logger.warn('[routing] No matching workers found at all, using fallback IDs', { ids: managers });
  }
  
  if (!managers || managers.length === 0) {
    managers = [1]; // Hard failure fallback
  }

  if (managers.length === 1) {
    return managers[0];
  }

  const counter = await _incrementCounter(normalised);
  const index   = (counter - 1) % managers.length;
  const manager = managers[index];

  logger.info('[routing] Assigned manager via round-robin', {
    pool:      normalised,
    counter,
    index,
    managerId: manager,
  });

  return manager;
}

/**
 * Resolve the pool name from an AI classification result.
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
function buildTaskTitle(classification, entityId, entityType = 'lead') {
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
    self_adhesive_paper: 'Самоклейка (бумага)',
    self_adhesive_pe:    'Самоклейка (PE)',
    self_adhesive_pet:   'Самоклейка (PET)',
    self_adhesive_bopp:  'Самоклейка (BOPP)',
    self_adhesive_pp:    'Самоклейка (PP)',
    sleeve:              'Sleeve-этикетка',
    ar_label:            'AR Live Label',
    thermochrome:        'Термохром',
    linerless:           'Linerless',
    datamatrix:          'DataMatrix / ЧЗ',
    unknown:             'Продукт не определён',
  };

  const intentLabel   = intentLabels[classification.intent]        || classification.intent;
  const productLabel  = productLabels[classification.product_type]  || classification.product_type;
  const priorityLabel = classification.priority === 1 ? ' [HOT]' : '';
  const prefix        = entityType === 'deal' ? 'Сделка' : 'Лид';

  return `[${prefix} #${entityId}]${priorityLabel} ${intentLabel} — ${productLabel}`;
}

/**
 * Build the task description from the classification and extracted data.
 */
function buildTaskDescription(classification, entityId, entityType = 'lead') {
  const { extracted_data: d } = classification;
  const prefix = entityType === 'deal' ? 'Сделка' : 'Лид';
  const lines = [
    `${prefix}: #${entityId}`,
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
  if (d.has_files)     lines.push('Есть прикреплённые файлы');
  if (d.notes)         lines.push(`Примечания: ${d.notes}`);

  return lines.join('\n');
}

module.exports = {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
};