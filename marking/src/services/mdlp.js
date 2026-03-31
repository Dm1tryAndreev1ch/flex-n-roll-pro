'use strict';

/**
 * mdlp.js — Клиент ГИС МТ (api.mdlp.crpt.ru)
 *
 * Реализует:
 *  - OAuth2 client_credentials аутентификацию с кешированием токена
 *  - Создание заявки на эмиссию кодов DataMatrix
 *  - Polling статуса заявки
 *  - Скачивание и распаковку ZIP с кодами
 *  - Регистрацию факта нанесения кодов (applied)
 *  - Регистрацию факта отгрузки (shipment)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { Readable } = require('stream');

const config = require('../../config');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Токен-менеджер
// ---------------------------------------------------------------------------
let _accessToken = null;
let _tokenExpiresAt = 0;

/**
 * Получает действующий access_token (из кеша или обновляет через OAuth2).
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);

  // Токен действителен ещё минимум 60 секунд
  if (_accessToken && _tokenExpiresAt - nowSec > 60) {
    return _accessToken;
  }

  logger.debug('[mdlp] Запрос нового access_token');

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.mdlp.clientId,
    client_secret: config.mdlp.clientSecret,
  });

  const resp = await axios.post(config.mdlp.tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  _accessToken = resp.data.access_token;
  // expires_in в секундах; если не пришёл — ставим 3600
  _tokenExpiresAt = nowSec + (resp.data.expires_in || 3600);

  logger.info('[mdlp] Токен обновлён, истекает через ' + resp.data.expires_in + ' сек');
  return _accessToken;
}

// ---------------------------------------------------------------------------
// Вспомогательный HTTP-клиент
// ---------------------------------------------------------------------------
/**
 * Создаёт axios-инстанс с авторизационным заголовком.
 * @returns {Promise<import('axios').AxiosInstance>}
 */
async function createApiClient() {
  const token = await getAccessToken();
  return axios.create({
    baseURL: config.mdlp.baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// 1. Создание заявки на эмиссию кодов
// ---------------------------------------------------------------------------

/**
 * Отправляет заявку на эмиссию кодов DataMatrix в ГИС МТ.
 *
 * @param {object} params
 * @param {string} params.gtin        — GTIN-14 товара
 * @param {number} params.quantity    — количество кодов
 * @param {string} params.productGroup — группа товаров (milk/pharma/tobacco/shoes)
 * @param {string} params.dealId      — идентификатор сделки Б24 (для заметок)
 * @returns {Promise<{orderId: string}>}
 */
async function createEmissionOrder({ gtin, quantity, productGroup, dealId }) {
  const client = await createApiClient();

  const body = {
    create_method_type: 'SELF_MADE',
    product_group: productGroup,
    gtin,
    quantity,
    // Дополнительные поля, требуемые ГИС МТ
    serialization_type: 'OPERATOR',
    // Шаблон серийного номера — оставляем auto
    serial_number_type: 'RANDOM',
    contact: {
      name: 'FLEX-N-ROLL PRO',
      inn: config.mdlp.participantInn,
    },
    release_method_type: 'PRODUCTION',
    // Привязка к внутреннему номеру заказа
    external_order_id: `B24-${dealId}`,
  };

  logger.info(`[mdlp] Создание заявки на эмиссию: gtin=${gtin}, qty=${quantity}, deal=${dealId}`);

  const resp = await client.post('/api/v3/true-api/codes/emissionOrder', body);

  const orderId = resp.data?.order_id || resp.data?.id;
  if (!orderId) {
    throw new Error(`[mdlp] Не удалось получить order_id: ${JSON.stringify(resp.data)}`);
  }

  logger.info(`[mdlp] Заявка создана: order_id=${orderId}`);
  return { orderId };
}

// ---------------------------------------------------------------------------
// 2. Polling статуса заявки
// ---------------------------------------------------------------------------

/**
 * Ожидает перехода заявки в статус DONE или REJECTED.
 *
 * @param {string} orderId
 * @returns {Promise<'DONE'|'REJECTED'>}
 */
async function pollOrderStatus(orderId) {
  const start = Date.now();
  const { pollIntervalMs, pollTimeoutMs } = config.mdlp;

  logger.info(`[mdlp] Polling статуса заявки ${orderId}`);

  while (true) {
    if (Date.now() - start > pollTimeoutMs) {
      throw new Error(`[mdlp] Timeout ожидания заявки ${orderId}`);
    }

    await sleep(pollIntervalMs);

    const client = await createApiClient();
    const resp = await client.get(`/api/v3/true-api/codes/emissionOrder/${orderId}`);
    const status = resp.data?.status;

    logger.debug(`[mdlp] Заявка ${orderId}: статус=${status}`);

    if (status === 'DONE' || status === 'READY') {
      logger.info(`[mdlp] Заявка ${orderId} завершена: ${status}`);
      return 'DONE';
    }

    if (status === 'REJECTED' || status === 'ERROR') {
      const reason = resp.data?.rejection_reason || 'неизвестно';
      throw new Error(`[mdlp] Заявка ${orderId} отклонена: ${reason}`);
    }
    // Иначе: PENDING / IN_PROGRESS — продолжаем
  }
}

// ---------------------------------------------------------------------------
// 3. Скачивание и парсинг ZIP с кодами
// ---------------------------------------------------------------------------

/**
 * Скачивает файл с кодами (ZIP → CSV/TXT) и возвращает массив кодов DataMatrix.
 *
 * @param {string} orderId
 * @returns {Promise<string[]>} массив строк DataMatrix
 */
async function downloadCodes(orderId) {
  const client = await createApiClient();

  logger.info(`[mdlp] Скачивание кодов для заявки ${orderId}`);

  // GET /api/v3/true-api/codes/emissionOrder/{orderId}/file
  const resp = await client.get(
    `/api/v3/true-api/codes/emissionOrder/${orderId}/file`,
    { responseType: 'arraybuffer' }
  );

  const zipBuffer = Buffer.from(resp.data);
  const codes = await extractCodesFromZip(zipBuffer);

  logger.info(`[mdlp] Распаковано ${codes.length} кодов для заявки ${orderId}`);
  return codes;
}

/**
 * Распаковывает ZIP-буфер и читает строки из CSV/TXT файлов внутри.
 * @param {Buffer} zipBuffer
 * @returns {Promise<string[]>}
 */
async function extractCodesFromZip(zipBuffer) {
  const codes = [];

  const directory = await unzipper.Open.buffer(zipBuffer);
  for (const file of directory.files) {
    if (file.type === 'File' && (file.path.endsWith('.csv') || file.path.endsWith('.txt'))) {
      const content = await file.buffer();
      const lines = content
        .toString('utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Первая строка может быть заголовком
      const dataLines = lines[0]?.toLowerCase().includes('datamatrix') || lines[0]?.toLowerCase().includes('code')
        ? lines.slice(1)
        : lines;

      codes.push(...dataLines);
    }
  }

  return codes;
}

// ---------------------------------------------------------------------------
// 4. Регистрация факта нанесения кодов (applied)
// ---------------------------------------------------------------------------

/**
 * Регистрирует в ГИС МТ факт нанесения кодов на продукцию.
 *
 * @param {object} params
 * @param {string[]} params.codes   — массив DataMatrix-кодов
 * @param {string}   params.gtin    — GTIN товара
 * @param {string}   params.dealId  — ID сделки
 * @returns {Promise<{reportId: string}>}
 */
async function registerCodesApplied({ codes, gtin, dealId }) {
  const client = await createApiClient();

  const body = {
    participant_inn: config.mdlp.participantInn,
    products: codes.map((code) => ({
      uit_code: code,
      gtin,
    })),
    production_date: new Date().toISOString().split('T')[0],
    external_order_id: `B24-${dealId}`,
  };

  logger.info(`[mdlp] Регистрация нанесения ${codes.length} кодов (deal=${dealId})`);

  const resp = await client.post('/api/v3/true-api/codes/applied', body);

  const reportId = resp.data?.report_id || resp.data?.id;
  logger.info(`[mdlp] Нанесение зарегистрировано, report_id=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// 5. Регистрация факта отгрузки
// ---------------------------------------------------------------------------

/**
 * Регистрирует в ГИС МТ отгрузку товара с нанесёнными кодами.
 *
 * @param {object} params
 * @param {string[]} params.codes      — коды, нанесённые на отгружаемый товар
 * @param {string}   params.dealId     — ID сделки Б24
 * @param {string}   params.receiverInn — ИНН получателя
 * @returns {Promise<{reportId: string}>}
 */
async function registerShipment({ codes, dealId, receiverInn }) {
  const client = await createApiClient();

  const body = {
    participant_inn: config.mdlp.participantInn,
    receiver_inn: receiverInn || '',
    transfer_date: new Date().toISOString().split('T')[0],
    transfer_document_number: `B24-${dealId}`,
    transfer_document_date: new Date().toISOString().split('T')[0],
    products: codes.map((code) => ({ uit_code: code })),
  };

  logger.info(`[mdlp] Регистрация отгрузки ${codes.length} кодов (deal=${dealId})`);

  const resp = await client.post('/api/v3/true-api/documents/create', {
    document_format: 'MANUAL',
    product_document: JSON.stringify(body),
    type: '415', // тип документа «Отгрузка»
  });

  const reportId = resp.data?.document_id || resp.data?.id;
  logger.info(`[mdlp] Отгрузка зарегистрирована, document_id=${reportId}`);
  return { reportId };
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  getAccessToken,
  createEmissionOrder,
  pollOrderStatus,
  downloadCodes,
  registerCodesApplied,
  registerShipment,
};