'use strict';

/**
 * bitrix.js — Клиент Битрикс24 REST API
 *
 * Реализует:
 *  - Чтение полей сделки (UF_CRM_*)
 *  - Обновление полей сделки
 *  - Создание задачи оператору маркировки
 *  - Прикрепление файла к задаче
 *  - Отправка уведомления пользователю
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const config = require('../../config');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * Выполняет вызов метода Битрикс24 REST API.
 * @param {string} method  — название метода, например 'crm.deal.get'
 * @param {object} params  — параметры вызова
 * @returns {Promise<any>} — содержимое поля result
 */
async function callBitrix(method, params = {}) {
  const url = `${config.bitrix.webhookUrl.replace(/\/+$/, '/')}${method}`;

  try {
    const resp = await axios.post(url, params, { timeout: 15000 });

    if (resp.data?.error) {
      throw new Error(`Битрикс24 ошибка [${resp.data.error}]: ${resp.data.error_description}`);
    }

    return resp.data?.result;
  } catch (err) {
    // Прикидываем дополнительный контекст
    const msg = err.response?.data?.error_description || err.message;
    logger.error(`[bitrix] Ошибка метода ${method}: ${msg}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Работа со сделками
// ---------------------------------------------------------------------------

/**
 * Получает данные сделки по ID.
 * Возвращает полный объект сделки, включая UF-поля.
 *
 * @param {string|number} dealId
 * @returns {Promise<object>}
 */
async function getDeal(dealId) {
  logger.debug(`[bitrix] getDeal(${dealId})`);
  const result = await callBitrix('crm.deal.get', { id: dealId });
  return result;
}

/**
 * Извлекает из сделки поля маркировки.
 *
 * @param {string|number} dealId
 * @returns {Promise<{
 *   markingRequired: boolean,
 *   productCategory: string,
 *   codesCount: number,
 *   stageId: string,
 *   dealTitle: string,
 * }>}
 */
async function getDealMarkingFields(dealId) {
  const deal = await getDeal(dealId);

  const markingRequired =
    deal.UF_CRM_MARKING_REQUIRED === '1' ||
    deal.UF_CRM_MARKING_REQUIRED === true ||
    deal.UF_CRM_MARKING_REQUIRED === 'Y';

  const productCategory = (deal.UF_CRM_PRODUCT_CATEGORY || '').toLowerCase();
  const codesCount = parseInt(deal.UF_CRM_MARKING_CODES_COUNT, 10) || 0;
  const stageId = deal.STAGE_ID || '';
  const dealTitle = deal.TITLE || `Сделка #${dealId}`;

  return { markingRequired, productCategory, codesCount, stageId, dealTitle };
}

/**
 * Обновляет пользовательские поля сделки.
 *
 * @param {string|number} dealId
 * @param {object} fields  — объект вида { UF_CRM_FIELD_NAME: value }
 * @returns {Promise<boolean>}
 */
async function updateDealFields(dealId, fields) {
  logger.debug(`[bitrix] updateDealFields(${dealId}): ${JSON.stringify(fields)}`);
  const result = await callBitrix('crm.deal.update', {
    id: dealId,
    fields,
  });
  return result === true || result === 1 || result;
}

/**
 * Читает контактный ИНН из связанного контакта/компании сделки.
 * Используется для регистрации отгрузки в ГИС МТ.
 *
 * @param {string|number} dealId
 * @returns {Promise<string>}
 */
async function getDealContactInn(dealId) {
  const deal = await getDeal(dealId);
  let inn = '';

  if (deal.COMPANY_ID) {
    try {
      const company = await callBitrix('crm.company.get', { id: deal.COMPANY_ID });
      inn = company.UF_CRM_COMPANY_INN || '';
    } catch (_) { /* не критично */ }
  }

  if (!inn && deal.CONTACT_ID) {
    try {
      const contact = await callBitrix('crm.contact.get', { id: deal.CONTACT_ID });
      inn = contact.UF_CRM_CONTACT_INN || '';
    } catch (_) { /* не критично */ }
  }

  return inn;
}

// ---------------------------------------------------------------------------
// Задачи и уведомления
// ---------------------------------------------------------------------------

/**
 * Создаёт задачу для оператора маркировки.
 *
 * @param {object} params
 * @param {string} params.dealId
 * @param {string} params.dealTitle
 * @param {string} params.description
 * @param {number} [params.responsibleId]  — ID ответственного (по умолч. из config)
 * @returns {Promise<{taskId: number}>}
 */
async function createMarkingTask({ dealId, dealTitle, description, responsibleId }) {
  const userId = responsibleId || config.bitrix.operatorUserId;
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +1 день

  logger.info(`[bitrix] Создание задачи для сделки ${dealId}, ответственный: ${userId}`);

  const result = await callBitrix('tasks.task.add', {
    fields: {
      TITLE: `Маркировка ЧЗ: ${dealTitle}`,
      DESCRIPTION: description,
      RESPONSIBLE_ID: userId,
      DEADLINE: deadline,
      UF_CRM_TASK: [`D_${dealId}`], // привязка к сделке
      PRIORITY: '1', // высокий
    },
  });

  const taskId = result?.task?.id;
  logger.info(`[bitrix] Задача создана: taskId=${taskId}`);
  return { taskId };
}

/**
 * Добавляет комментарий к задаче (с возможностью прикрепить CSV-файл как текст).
 *
 * @param {number} taskId
 * @param {string} text
 * @returns {Promise<void>}
 */
async function addTaskComment(taskId, text) {
  await callBitrix('task.commentitem.add', {
    TASKID: taskId,
    FIELDS: { POST_MESSAGE: text },
  });
}

/**
 * Загружает файл в «Диск» Б24 и прикрепляет к задаче.
 *
 * @param {object} params
 * @param {number} params.taskId
 * @param {string} params.filePath  — полный путь к файлу на сервере
 * @param {string} params.fileName  — имя файла в Б24
 * @returns {Promise<void>}
 */
async function attachFileToTask({ taskId, filePath, fileName }) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const base64 = fileContent.toString('base64');

    logger.debug(`[bitrix] Загрузка файла ${fileName} к задаче ${taskId}`);

    await callBitrix('task.item.addfile', {
      taskId,
      fileData: { NAME: fileName, CONTENT: base64 },
    });
  } catch (err) {
    logger.error(`[bitrix] Ошибка загрузки файла к задаче: ${err.message}`);
    // Не пробрасываем — задача уже создана
  }
}

/**
 * Отправляет уведомление пользователю через im.notify.
 *
 * @param {number} userId
 * @param {string} message
 * @returns {Promise<void>}
 */
async function sendNotification(userId, message) {
  try {
    await callBitrix('im.notify.system.add', {
      USER_ID: userId,
      MESSAGE: message,
    });
    logger.debug(`[bitrix] Уведомление отправлено пользователю ${userId}`);
  } catch (err) {
    logger.warn(`[bitrix] Не удалось отправить уведомление: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Получение списка файлов задачи (для поиска codes.csv)
// ---------------------------------------------------------------------------

/**
 * Проверяет существование пользовательского поля в сделках Б24.
 * Используется при первом запуске для диагностики конфигурации.
 * @returns {Promise<string[]>} список названий UF-полей
 */
async function listDealUserFields() {
  const result = await callBitrix('crm.deal.userfield.list', {});
  return (result || []).map((f) => f.FIELD_NAME);
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  callBitrix,
  getDeal,
  getDealMarkingFields,
  updateDealFields,
  getDealContactInn,
  createMarkingTask,
  addTaskComment,
  attachFileToTask,
  sendNotification,
  listDealUserFields,
};