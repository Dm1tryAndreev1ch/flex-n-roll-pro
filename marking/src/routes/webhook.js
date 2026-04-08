'use strict';

/**
 * webhook.js — Вебхук от Битрикс24
 *
 * POST /webhook/b24  — принимает события onCrmDealUpdate
 *
 * Логика:
 *  - STAGE_ID === BITRIX_STAGE_PRODUCTION && UF_CRM_MARKING_REQUIRED === true
 *      → Запросить коды ГИС МТ + сформировать CSV + уведомить оператора
 *
 *  - STAGE_ID === BITRIX_STAGE_SHIPMENT
 *      → Зарегистрировать отгрузку в ГИС МТ
 *
 * Б24 шлёт form-urlencoded (POST body), поэтому используем express.urlencoded.
 * Вебхуки не имеют стандартной HMAC-подписи в Б24, но в .env можно задать
 * WEBHOOK_SECRET для дополнительной защиты (сравнение query-параметра secret).
 */

const router = require('express').Router();
const config = require('../../config');
const logger = require('../utils/logger');
const codeManager = require('../services/codeManager');
const bitrix = require('../services/bitrix');

// ---------------------------------------------------------------------------
// Middleware: проверка опционального секрета
// ---------------------------------------------------------------------------
router.use((req, res, next) => {
  const secret = config.security.webhookSecret;
  if (!secret) return next(); // секрет не настроен — пропускаем

  const provided = req.query.secret || req.body?.secret;
  if (provided !== secret) {
    logger.warn(`[webhook] Неверный секрет от ${req.ip}`);
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
});

// ---------------------------------------------------------------------------
// POST /webhook/b24
// ---------------------------------------------------------------------------
router.post('/b24', async (req, res) => {
  // Б24 шлёт данные как form-urlencoded или JSON в зависимости от версии
  const body = req.body || {};

  logger.debug(`[webhook] Получено событие: ${JSON.stringify(body).substring(0, 300)}`);

  // Битрикс24 передаёт данные с префиксами: data[FIELDS][ID] и т.п.
  // Нормализуем для удобства:
  const event = body.event || '';
  const dealId =
    body?.data?.FIELDS?.ID ||
    body?.['data[FIELDS][ID]'] ||
    body?.FIELDS?.ID ||
    '';

  logger.info(`[webhook] Событие: ${event}, dealId: ${dealId}`);

  if (!event || !dealId) {
    return res.status(200).send('ok');
  }

  // Б24 ожидает ответ в течение ~3 секунд, поэтому отвечаем немедленно,
  // а обработку запускаем асинхронно.
  res.status(200).send('ok');

  // Асинхронная обработка
  setImmediate(async () => {
    try {
      await handleDealUpdate(dealId, event);
    } catch (err) {
      logger.error(`[webhook] Ошибка обработки события ${event} для сделки ${dealId}: ${err.message}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Основная логика обработки события обновления сделки
// ---------------------------------------------------------------------------
async function handleDealUpdate(dealId, event) {
  const { production, shipment } = config.bitrix.stages;

  // STAGE_ID is not included in OnCrmDealUpdate payload — fetch from API
  let stageId;
  try {
    const deal = await bitrix.getDeal(dealId);
    stageId = deal?.STAGE_ID;
  } catch (err) {
    logger.error('[webhook:dealUpdate] Failed to fetch deal stage', { dealId, error: err.message });
    return;
  }

  // --- Случай 1: Переход на стадию «Производство» ---
  if (stageId === production) {
    logger.info(`[webhook] Сделка ${dealId} → стадия Производство`);
    await handleProductionStage(dealId);
    return;
  }

  // --- Случай 2: Переход на стадию «Отгрузка» ---
  if (stageId === shipment) {
    logger.info(`[webhook] Сделка ${dealId} → стадия Отгрузка`);
    await handleShipmentStage(dealId);
    return;
  }

  logger.debug(`[webhook] Стадия ${stageId} не требует действий маркировки`);
}

// ---------------------------------------------------------------------------
// Стадия «Производство» — запуск процесса маркировки
// ---------------------------------------------------------------------------
async function handleProductionStage(dealId) {
  // Читаем поля маркировки из Б24
  const fields = await bitrix.getDealMarkingFields(dealId);

  logger.info(
    `[webhook] Поля сделки ${dealId}: markingRequired=${fields.markingRequired}, ` +
    `category=${fields.productCategory}, qty=${fields.codesCount}`
  );

  if (!fields.markingRequired) {
    logger.info(`[webhook] Маркировка не требуется для сделки ${dealId}`);
    return;
  }

  if (fields.codesCount < 1) {
    logger.warn(`[webhook] Сделка ${dealId}: UF_CRM_MARKING_CODES_COUNT = 0, пропускаем`);
    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `⚠️ Сделка #${dealId}: маркировка требуется, но количество кодов не указано`
    );
    return;
  }

  // Проверяем — не запущен ли процесс уже (идемпотентность)
  const existing = codeManager.getEntry(dealId);
  if (existing && ['CODES_READY', 'IN_PRODUCTION', 'VERIFIED', 'SHIPPED'].includes(existing.status)) {
    logger.info(`[webhook] Маркировка для сделки ${dealId} уже в статусе ${existing.status}, пропускаем`);
    return;
  }

  // Запрос кодов + CSV + уведомление оператора
  const { orderId, codes } = await codeManager.requestCodesForDeal({
    dealId: String(dealId),
    productCategory: fields.productCategory,
    codesCount: fields.codesCount,
  });

  const csvPath = await codeManager.generateProductionFile(String(dealId));

  await codeManager.notifyOperator(String(dealId), csvPath);

  logger.info(
    `[webhook] Сделка ${dealId}: маркировка запущена, orderId=${orderId}, кодов=${codes.length}`
  );
}

// ---------------------------------------------------------------------------
// Стадия «Отгрузка» — регистрация отгрузки в ГИС МТ
// ---------------------------------------------------------------------------
async function handleShipmentStage(dealId) {
  const existing = codeManager.getEntry(dealId);

  if (!existing) {
    logger.info(`[webhook] Сделка ${dealId} не проходила маркировку — пропускаем отгрузку`);
    return;
  }

  if (existing.status === 'SHIPPED') {
    logger.info(`[webhook] Отгрузка для сделки ${dealId} уже зарегистрирована`);
    return;
  }

  if (!['VERIFIED', 'CODES_READY', 'IN_PRODUCTION'].includes(existing.status)) {
    logger.warn(
      `[webhook] Сделка ${dealId}: неожиданный статус ${existing.status} при отгрузке`
    );
  }

  try {
    const { reportId } = await codeManager.registerDealShipment(String(dealId));
    logger.info(`[webhook] Отгрузка сделки ${dealId} зарегистрирована: reportId=${reportId}`);

    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `📦 Сделка #${dealId}: отгрузка зарегистрирована в ГИС МТ (ID: ${reportId})`
    );
  } catch (err) {
    logger.error(`[webhook] Ошибка регистрации отгрузки для сделки ${dealId}: ${err.message}`);

    // Уведомляем оператора об ошибке
    await bitrix.sendNotification(
      config.bitrix.operatorUserId,
      `❌ Сделка #${dealId}: ОШИБКА регистрации отгрузки в ГИС МТ — ${err.message}`
    ).catch(() => {});
  }
}

module.exports = router;