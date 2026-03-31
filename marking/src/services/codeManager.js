'use strict';

/**
 * codeManager.js — Управление кодами DataMatrix
 *
 * Отвечает за:
 *  1. Оркестрацию полного цикла получения кодов из ГИС МТ
 *  2. Сохранение кодов в JSON-«базу» (codes_db.json)
 *  3. Формирование CSV-файла задания для печатного оборудования
 *  4. Верификацию (подтверждение нанесения)
 *  5. Уведомление оператора в Б24
 */

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const logger = require('../utils/logger');
const mdlp = require('./mdlp');
const bitrix = require('./bitrix');

// ---------------------------------------------------------------------------
// JSON-база кодов (file-based store)
// ---------------------------------------------------------------------------

/**
 * Читает codes_db.json.
 * Структура: { [dealId]: { orderId, gtin, productGroup, codes: [...], status, createdAt, appliedAt } }
 * @returns {object}
 */
function readDb() {
  try {
    const raw = fs.readFileSync(config.storage.codesDbPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Записывает обновлённую БД.
 * @param {object} db
 */
function writeDb(db) {
  fs.writeFileSync(config.storage.codesDbPath, JSON.stringify(db, null, 2), 'utf8');
}

/**
 * Возвращает запись по dealId или undefined.
 * @param {string} dealId
 */
function getEntry(dealId) {
  return readDb()[String(dealId)];
}

/**
 * Обновляет поля записи для dealId.
 * @param {string} dealId
 * @param {object} patch
 */
function upsertEntry(dealId, patch) {
  const db = readDb();
  const key = String(dealId);
  db[key] = { ...(db[key] || {}), dealId: key, ...patch };
  writeDb(db);
}

// ---------------------------------------------------------------------------
// 1. Полный цикл: получение кодов из ГИС МТ
// ---------------------------------------------------------------------------

/**
 * Запрашивает коды DataMatrix у ГИС МТ, сохраняет в БД.
 *
 * @param {object} params
 * @param {string} params.dealId
 * @param {string} params.productCategory  — из UF_CRM_PRODUCT_CATEGORY
 * @param {number} params.codesCount
 * @param {string} [params.gtin]           — переопределение GTIN (по умолч. из config)
 * @returns {Promise<{orderId: string, codes: string[]}>}
 */
async function requestCodesForDeal({ dealId, productCategory, codesCount, gtin }) {
  const resolvedGtin = gtin || config.mdlp.defaultGtin;
  const productGroup = config.productGroupMap[productCategory] || productCategory;

  logger.info(
    `[codeManager] Запрос ${codesCount} кодов для сделки ${dealId} ` +
    `(категория: ${productCategory}, GTIN: ${resolvedGtin})`
  );

  // Обновляем статус в Б24
  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'REQUESTING',
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  // 1. Создать заявку
  const { orderId } = await mdlp.createEmissionOrder({
    gtin: resolvedGtin,
    quantity: codesCount,
    productGroup,
    dealId,
  });

  upsertEntry(dealId, {
    orderId,
    gtin: resolvedGtin,
    productGroup,
    status: 'PENDING',
    codesCount,
    createdAt: new Date().toISOString(),
  });

  // 2. Polling статуса
  await mdlp.pollOrderStatus(orderId);

  // 3. Скачать коды
  const codes = await mdlp.downloadCodes(orderId);

  upsertEntry(dealId, { codes, status: 'CODES_READY', codesReadyAt: new Date().toISOString() });

  // Обновляем Б24
  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'CODES_READY',
    UF_CRM_MARKING_ORDER_ID: orderId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] ${codes.length} кодов получено для сделки ${dealId}`);
  return { orderId, codes };
}

// ---------------------------------------------------------------------------
// 2. Формирование CSV-файла для печатного оборудования
// ---------------------------------------------------------------------------

/**
 * Создаёт CSV-файл задания для типографского оборудования.
 * Формат: serial_number, datamatrix_code, order_id
 *
 * @param {string} dealId
 * @returns {Promise<string>} путь к созданному файлу
 */
async function generateProductionFile(dealId) {
  const entry = getEntry(dealId);
  if (!entry || !entry.codes || entry.codes.length === 0) {
    throw new Error(`[codeManager] Коды для сделки ${dealId} не найдены в БД`);
  }

  const orderDir = path.join(config.storage.productionDir, String(dealId));
  fs.mkdirSync(orderDir, { recursive: true });

  const filePath = path.join(orderDir, 'codes.csv');

  // Заголовок + строки
  const header = 'serial_number,datamatrix_code,order_id\n';
  const rows = entry.codes
    .map((code, idx) => `${String(idx + 1).padStart(6, '0')},${code},B24-${dealId}`)
    .join('\n');

  fs.writeFileSync(filePath, header + rows, 'utf8');

  logger.info(`[codeManager] CSV-файл задания сохранён: ${filePath}`);
  return filePath;
}

// ---------------------------------------------------------------------------
// 3. Уведомление оператора в Б24 + задача с файлом
// ---------------------------------------------------------------------------

/**
 * Создаёт задачу оператору и прикрепляет CSV-файл с кодами.
 *
 * @param {string} dealId
 * @param {string} csvFilePath
 * @returns {Promise<{taskId: number}>}
 */
async function notifyOperator(dealId, csvFilePath) {
  const entry = getEntry(dealId);
  const deal = await bitrix.getDeal(dealId);
  const dealTitle = deal?.TITLE || `Сделка #${dealId}`;

  const description =
    `Сделка: ${dealTitle}\n` +
    `Количество кодов: ${entry?.codesCount || '?'}\n` +
    `Товарная группа: ${entry?.productGroup || '?'}\n` +
    `GTIN: ${entry?.gtin || '?'}\n` +
    `Заявка ГИС МТ: ${entry?.orderId || '?'}\n\n` +
    `Файл задания прикреплён. После завершения печати подтвердите нанесение ` +
    `через API: POST /api/marking/verify {"dealId": "${dealId}"}`;

  const { taskId } = await bitrix.createMarkingTask({
    dealId,
    dealTitle,
    description,
    responsibleId: config.bitrix.operatorUserId,
  });

  // Прикрепляем CSV
  await bitrix.attachFileToTask({
    taskId,
    filePath: csvFilePath,
    fileName: `codes_${dealId}.csv`,
  });

  // Системное уведомление
  await bitrix.sendNotification(
    config.bitrix.operatorUserId,
    `✅ Коды DataMatrix готовы к печати. Сделка: ${dealTitle}. Задача: #${taskId}`
  );

  upsertEntry(dealId, { taskId, status: 'IN_PRODUCTION' });

  logger.info(`[codeManager] Оператор уведомлён, taskId=${taskId}`);
  return { taskId };
}

// ---------------------------------------------------------------------------
// 4. Верификация: подтверждение нанесения кодов
// ---------------------------------------------------------------------------

/**
 * Регистрирует факт нанесения кодов в ГИС МТ и обновляет статус в Б24.
 *
 * @param {string} dealId
 * @param {string[]} [appliedCodes]  — если не передан, берём все коды из БД
 * @returns {Promise<{reportId: string}>}
 */
async function verifyCodesApplied(dealId, appliedCodes) {
  const entry = getEntry(dealId);
  if (!entry) throw new Error(`[codeManager] Сделка ${dealId} не найдена в БД`);

  const codes = appliedCodes || entry.codes || [];
  if (codes.length === 0) throw new Error(`[codeManager] Нет кодов для верификации`);

  logger.info(`[codeManager] Верификация ${codes.length} кодов для сделки ${dealId}`);

  const { reportId } = await mdlp.registerCodesApplied({
    codes,
    gtin: entry.gtin,
    dealId,
  });

  upsertEntry(dealId, {
    status: 'VERIFIED',
    reportId,
    appliedAt: new Date().toISOString(),
    appliedCodes: codes,
  });

  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'VERIFIED',
    UF_CRM_MARKING_REPORT_ID: reportId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] Верификация завершена: reportId=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// 5. Регистрация отгрузки
// ---------------------------------------------------------------------------

/**
 * Регистрирует отгрузку товара с нанесёнными кодами в ГИС МТ.
 *
 * @param {string} dealId
 * @returns {Promise<{reportId: string}>}
 */
async function registerDealShipment(dealId) {
  const entry = getEntry(dealId);
  if (!entry) throw new Error(`[codeManager] Сделка ${dealId} не найдена`);

  const codes = entry.appliedCodes || entry.codes || [];
  if (codes.length === 0) throw new Error(`[codeManager] Нет кодов для отгрузки`);

  // Получаем ИНН получателя
  const receiverInn = await bitrix.getDealContactInn(dealId).catch(() => '');

  const { reportId } = await mdlp.registerShipment({ codes, dealId, receiverInn });

  upsertEntry(dealId, {
    status: 'SHIPPED',
    shipmentReportId: reportId,
    shippedAt: new Date().toISOString(),
  });

  await bitrix.updateDealFields(dealId, {
    UF_CRM_MARKING_STATUS: 'SHIPPED',
    UF_CRM_MARKING_SHIP_ID: reportId,
  }).catch((e) => logger.warn(`[codeManager] updateDealFields: ${e.message}`));

  logger.info(`[codeManager] Отгрузка зарегистрирована: reportId=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// Вспомогательные экспорты
// ---------------------------------------------------------------------------

/**
 * Возвращает все записи из БД (для отчётов).
 * @returns {object}
 */
function getAllEntries() {
  return readDb();
}

module.exports = {
  requestCodesForDeal,
  generateProductionFile,
  notifyOperator,
  verifyCodesApplied,
  registerDealShipment,
  getEntry,
  getAllEntries,
};