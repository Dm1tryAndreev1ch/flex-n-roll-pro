/**
 * bitrix.js
 * Клиент для работы с Битрикс24 REST API через входящий вебхук.
 *
 * Документация: https://dev.1c-bitrix.ru/rest_help/
 */

'use strict';

const axios = require('axios');
const logger = require('./logger');

const BASE_URL = process.env.B24_BASE_URL;
const WEBHOOK_TOKEN = process.env.B24_WEBHOOK_TOKEN;
const ORDER_NUMBER_FIELD = process.env.B24_ORDER_NUMBER_FIELD || 'UF_CRM_ORDER_NUMBER';
const TELEGRAM_CHATID_FIELD =
  process.env.B24_TELEGRAM_CHATID_FIELD || 'UF_CRM_TELEGRAM_CHAT_ID';
const PROOF_PHOTO_FIELD = process.env.B24_PROOF_PHOTO_FIELD || 'UF_CRM_PROOF_PHOTO';
const NPS_SCORE_FIELD = process.env.B24_NPS_SCORE_FIELD || 'UF_CRM_NPS_SCORE';
const NPS_COMMENT_FIELD = process.env.B24_NPS_COMMENT_FIELD || 'UF_CRM_NPS_COMMENT';
const PIPELINE_ID = process.env.B24_PIPELINE_ID || '0';

const http = axios.create({
  baseURL: `${BASE_URL}/rest/${WEBHOOK_TOKEN}/`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  logger.debug(`[B24] → ${config.url}`, { params: config.params });
  return config;
});

http.interceptors.response.use(
  (res) => {
    if (res.data.error) {
      const err = new Error(res.data.error_description || res.data.error);
      err.b24Error = res.data.error;
      logger.error(`[B24] API error: ${err.message}`);
      throw err;
    }
    return res;
  },
  (err) => {
    logger.error(`[B24] HTTP error: ${err.message}`);
    throw err;
  }
);

/**
 * Вызов метода Битрикс24 REST API.
 * @param {string} method
 * @param {object} params
 * @returns {Promise<any>}
 */
async function call(method, params = {}) {
  const res = await http.post(`${method}.json`, params);
  return res.data.result;
}

// ─── Сделки ──────────────────────────────────────────────────────────────────

/**
 * Найти сделку по номеру заказа.
 * @param {string} orderNumber
 * @returns {Promise<object|null>}
 */
async function getDealByOrderNumber(orderNumber) {
  const result = await call('crm.deal.list', {
    filter: {
      [ORDER_NUMBER_FIELD]: orderNumber,
      ...(PIPELINE_ID !== '0' ? { CATEGORY_ID: PIPELINE_ID } : {}),
    },
    select: [
      'ID',
      'TITLE',
      'STAGE_ID',
      'DATE_MODIFY',
      'DATE_CREATE',
      'ASSIGNED_BY_ID',
      ORDER_NUMBER_FIELD,
      TELEGRAM_CHATID_FIELD,
      PROOF_PHOTO_FIELD,
      NPS_SCORE_FIELD,
      NPS_COMMENT_FIELD,
    ],
  });
  if (!result || result.length === 0) return null;
  return result[0];
}

/**
 * Получить сделку по ID.
 * @param {string|number} dealId
 * @returns {Promise<object>}
 */
async function getDealById(dealId) {
  return call('crm.deal.get', { id: dealId });
}

/**
 * Обновить поля сделки.
 * @param {string|number} dealId
 * @param {object} fields
 * @returns {Promise<boolean>}
 */
async function updateDeal(dealId, fields) {
  return call('crm.deal.update', { id: dealId, fields });
}

/**
 * Привязать Telegram chat_id к сделке.
 * @param {string|number} dealId
 * @param {string|number} chatId
 */
async function linkTelegramChatId(dealId, chatId) {
  return updateDeal(dealId, { [TELEGRAM_CHATID_FIELD]: String(chatId) });
}

/**
 * Сохранить NPS оценку и комментарий.
 * @param {string|number} dealId
 * @param {number} score
 * @param {string} [comment]
 */
async function saveNps(dealId, score, comment = '') {
  const fields = { [NPS_SCORE_FIELD]: score };
  if (comment) fields[NPS_COMMENT_FIELD] = comment;
  return updateDeal(dealId, fields);
}

// ─── Контакты ────────────────────────────────────────────────────────────────

async function getDealContacts(dealId) {
  return call('crm.deal.contact.items.get', { id: dealId });
}

async function getContact(contactId) {
  return call('crm.contact.get', { id: contactId });
}

// ─── Пользователи ────────────────────────────────────────────────────────────

async function getUser(userId) {
  const result = await call('user.get', { ID: userId });
  return Array.isArray(result) ? result[0] : result;
}

// ─── Файлы ───────────────────────────────────────────────────────────────────

/**
 * Получить прямую ссылку на фото пробной печати.
 * @param {object} deal
 * @returns {string|null}
 */
function extractProofPhotoUrl(deal) {
  const raw = deal[PROOF_PHOTO_FIELD];
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length > 0)
    return raw[0].downloadUrl || raw[0].url || null;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;
  if (typeof raw === 'object' && raw.url) return raw.url;
  return null;
}

// ─── Стадии ──────────────────────────────────────────────────────────────────

async function getDealStages(categoryId = PIPELINE_ID) {
  return call('crm.dealcategory.stages', { id: categoryId });
}

// ─── Timeline ────────────────────────────────────────────────────────────────

async function addTimelineComment(dealId, text) {
  return call('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID: dealId,
      ENTITY_TYPE: 'deal',
      COMMENT: text,
    },
  });
}

module.exports = {
  call,
  getDealByOrderNumber,
  getDealById,
  updateDeal,
  linkTelegramChatId,
  saveNps,
  getDealContacts,
  getContact,
  getUser,
  extractProofPhotoUrl,
  getDealStages,
  addTimelineComment,
  ORDER_NUMBER_FIELD,
  TELEGRAM_CHATID_FIELD,
  PROOF_PHOTO_FIELD,
  NPS_SCORE_FIELD,
  NPS_COMMENT_FIELD,
};