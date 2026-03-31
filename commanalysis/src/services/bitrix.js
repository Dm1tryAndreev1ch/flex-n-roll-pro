'use strict';

/**
 * bitrix.js — Клиент Битрикс24 REST API
 *
 * Методы:
 *  - Звонки (telephony)
 *  - Сделки CRM
 *  - Контакты
 *  - Пользователи
 *  - Переписка / история
 *  - Комментарии к таймлайну
 */

const axios  = require('axios');
const config = require('../../config');
const logger = require('../utils/logger');

// ── Базовый клиент ────────────────────────────────────────────────────────
const http = axios.create({
  baseURL: config.bitrix.webhookUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Перехватчик ошибок: добавить текст ответа к сообщению
http.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error_description
      || err.response?.data?.error
      || err.message;
    logger.error(`[bitrix] HTTP ${err.response?.status}: ${msg}`);
    return Promise.reject(new Error(`Bitrix24 API: ${msg}`));
  }
);

/**
 * Базовый REST-вызов.
 * @param {string} method  — напр. 'crm.deal.get'
 * @param {object} params  — параметры запроса
 */
async function call(method, params = {}) {
  logger.debug(`[bitrix] → ${method}`);
  const { data } = await http.post(`/${method}`, params);
  if (data.error) {
    throw new Error(`Bitrix24 ${method}: ${data.error_description || data.error}`);
  }
  return data.result;
}

// ── Пагинированный список ──────────────────────────────────────────────────
async function listAll(method, params = {}) {
  let start  = 0;
  const all  = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await http.post(`/${method}`, { ...params, start });
    if (data.error) throw new Error(`Bitrix24 ${method}: ${data.error_description}`);

    const items = Array.isArray(data.result) ? data.result : Object.values(data.result || {});
    all.push(...items);

    if (!data.next || all.length >= (data.total || Infinity)) break;
    start = data.next;
  }

  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ЗВОНКИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить информацию о звонке по ID.
 * Использует telephony.externalcall.show (не требует подтверждения).
 * @param {string} callId
 */
async function getCallInfo(callId) {
  try {
    const result = await call('telephony.externalcall.show', { CALL_ID: callId });
    return result;
  } catch (e) {
    logger.warn(`[bitrix] getCallInfo failed: ${e.message}`);
    return null;
  }
}

/**
 * Получить запись звонка по ID сделки.
 * Ищем в истории активностей (crm.activity.list).
 * @param {string} dealId
 */
async function getCallByDealId(dealId) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      OWNER_TYPE_ID: 2, // Deal
      OWNER_ID: dealId,
      TYPE_ID: 2,       // Звонок
    },
    select: ['ID', 'SUBJECT', 'START_TIME', 'SETTINGS', 'COMMUNICATIONS'],
    order: { START_TIME: 'DESC' },
  });

  if (!activities.length) return null;

  const latest = activities[0];
  const recordUrl = latest?.SETTINGS?.RECORD_URL
    || latest?.SETTINGS?.recordUrl
    || null;

  return {
    CALL_ID:          latest.ID,
    RECORD_URL:       recordUrl,
    CALL_START_DATE:  latest.START_TIME,
    PORTAL_USER_ID:   latest.RESPONSIBLE_ID,
    CRM_ENTITY_ID:    dealId,
    CRM_ENTITY_TYPE: 'deal',
  };
}

/**
 * Получить список звонков за конкретный день.
 * @param {string} dateFrom  — ISO-дата начала (напр. '2024-03-01T00:00:00')
 * @param {string} dateTo    — ISO-дата конца
 */
async function getCallsForDay(dateFrom, dateTo) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      TYPE_ID: 2,           // Звонок
      '>START_TIME': dateFrom,
      '<START_TIME': dateTo,
    },
    select: ['ID', 'SUBJECT', 'START_TIME', 'OWNER_ID', 'OWNER_TYPE_ID',
             'RESPONSIBLE_ID', 'SETTINGS', 'COMMUNICATIONS'],
    order: { START_TIME: 'ASC' },
  });

  return activities.map(a => ({
    CALL_ID:         a.ID,
    RECORD_URL:      a.SETTINGS?.RECORD_URL || a.SETTINGS?.recordUrl || null,
    CALL_START_DATE: a.START_TIME,
    PORTAL_USER_ID:  a.RESPONSIBLE_ID,
    CRM_ENTITY_ID:   a.OWNER_ID,
    CRM_ENTITY_TYPE: a.OWNER_TYPE_ID === 2 ? 'deal' : 'other',
  })).filter(c => c.RECORD_URL); // только звонки с записью
}

/**
 * Получить защищённую ссылку на аудио через Б24.
 * Используется когда прямое скачивание отклоняется (403).
 */
async function getSignedAudioUrl(originalUrl, dealId) {
  // Битрикс24 не предоставляет отдельного метода для подписанных URL.
  // Возвращаем оригинальный URL с добавлением auth-параметра из webhook.
  const webhookBase = config.bitrix.webhookUrl;
  // Конструируем токен из webhook URL
  const match = webhookBase.match(/\/rest\/(\d+)\/([^/]+)\//);
  if (!match) return originalUrl;
  return `${originalUrl}&auth=${match[2]}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  СДЕЛКИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить сделку по ID.
 * @param {string} dealId
 */
async function getDeal(dealId) {
  return call('crm.deal.get', { id: dealId });
}

/**
 * Обновить поля сделки.
 * @param {string} dealId
 * @param {object} fields  — ключ-значение полей
 */
async function updateDealFields(dealId, fields) {
  if (!dealId || !fields || !Object.keys(fields).length) return;

  logger.debug(`[bitrix] Обновление сделки ${dealId}: ${Object.keys(fields).join(', ')}`);
  return call('crm.deal.update', { id: dealId, fields });
}

// ═══════════════════════════════════════════════════════════════════════════
//  КОНТАКТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить контакт, привязанный к сделке.
 * @param {string} dealId
 */
async function getContactByDealId(dealId) {
  const contacts = await call('crm.deal.contact.items.get', { id: dealId });
  if (!contacts?.length) return null;

  const contactId = contacts[0].CONTACT_ID;
  return call('crm.contact.get', { id: contactId });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ПОЛЬЗОВАТЕЛИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить пользователя по ID.
 * @param {string|number} userId
 */
async function getUserById(userId) {
  if (!userId) return null;
  try {
    const result = await call('user.get', { ID: userId });
    return Array.isArray(result) ? result[0] : result;
  } catch (e) {
    logger.warn(`[bitrix] getUserById(${userId}): ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ПЕРЕПИСКА / ЧАТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить историю переписки по сделке из CRM-активностей (email, чат).
 * @param {string} dealId
 */
async function getChatMessagesByDealId(dealId) {
  const activities = await listAll('crm.activity.list', {
    filter: {
      OWNER_TYPE_ID: 2, // Deal
      OWNER_ID: dealId,
      TYPE_ID: [4, 15], // 4=Email, 15=OpenChannel/Чат
    },
    select: ['ID', 'TYPE_ID', 'SUBJECT', 'START_TIME', 'DESCRIPTION',
             'AUTHOR_ID', 'RESPONSIBLE_ID', 'DIRECTION', 'SETTINGS'],
    order: { START_TIME: 'ASC' },
  });

  // Нормализовать в единый формат
  return activities.map(a => ({
    id:        a.ID,
    role:      a.DIRECTION === 1 ? 'client' : 'manager',  // 1=Входящий=Клиент, 2=Исходящий=Менеджер
    text:      a.DESCRIPTION || a.SUBJECT || '',
    timestamp: a.START_TIME,
    userId:    a.RESPONSIBLE_ID,
    type:      a.TYPE_ID === 4 ? 'email' : 'chat',
  })).filter(m => m.text.trim().length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ТАЙМЛАЙН / КОММЕНТАРИИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Добавить комментарий к таймлайну сделки.
 * @param {string} dealId
 * @param {string} htmlComment  — HTML-контент карточки
 */
async function addTimelineComment(dealId, htmlComment) {
  logger.debug(`[bitrix] addTimelineComment dealId=${dealId}`);
  return call('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID:   dealId,
      ENTITY_TYPE: 'deal',
      COMMENT:     htmlComment,
    },
  });
}

/**
 * Отправить уведомление пользователю в Б24 (им.канал).
 * @param {string|number} toUserId
 * @param {string} message
 */
async function sendNotification(toUserId, message) {
  return call('im.notify.system.add', {
    USER_ID: toUserId,
    MESSAGE: message,
  });
}

/**
 * Создать задачу на руководителя (сводный отчёт).
 * @param {string} responsibleId  — ID руководителя
 * @param {string} title
 * @param {string} description
 * @param {string} deadline       — ISO-дата
 */
async function createTask(responsibleId, title, description, deadline) {
  return call('tasks.task.add', {
    fields: {
      TITLE:          title,
      DESCRIPTION:    description,
      RESPONSIBLE_ID: responsibleId,
      DEADLINE:       deadline,
      PRIORITY:       1,
    },
  });
}

module.exports = {
  call,
  listAll,
  // Звонки
  getCallInfo,
  getCallByDealId,
  getCallsForDay,
  getSignedAudioUrl,
  // Сделки
  getDeal,
  updateDealFields,
  // Контакты
  getContactByDealId,
  // Пользователи
  getUserById,
  // Переписка
  getChatMessagesByDealId,
  // Таймлайн
  addTimelineComment,
  sendNotification,
  createTask,
};