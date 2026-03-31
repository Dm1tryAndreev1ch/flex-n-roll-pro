/**
 * webhook/bitrixWebhook.js
 * Express-роутер для приёма вебхуков от Битрикс24.
 *
 * Подписка: Портал → Разработчикам → Исходящий вебхук
 * URL: https://your-domain.example.com/webhook/bitrix?secret=<B24_WEBHOOK_SECRET>
 * События: ONCRMDEALADD, ONCRMDEALUPDATE
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const { notifyStageChange } = require('../services/notify');
const logger = require('../services/logger');

const router = express.Router();
const WEBHOOK_SECRET = process.env.B24_WEBHOOK_SECRET || '';

// ─── Верификация запроса ──────────────────────────────────────────────────────

/**
 * Проверить shared secret из query-параметра или заголовка.
 * В URL вебхука добавьте: ?secret=<B24_WEBHOOK_SECRET>
 */
function verifyBitrixRequest(req, res, next) {
  if (!WEBHOOK_SECRET) {
    logger.warn('[Webhook] B24_WEBHOOK_SECRET not set! Webhook is unprotected.');
    return next();
  }

  const provided =
    req.query.secret ||
    req.headers['x-webhook-secret'] ||
    req.body?.secret;

  if (!provided || !safeCompare(provided, WEBHOOK_SECRET)) {
    logger.warn(`[Webhook] Unauthorized request from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function safeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ─── Основной обработчик ──────────────────────────────────────────────────────

/**
 * POST /webhook/bitrix
 *
 * Битрикс24 шлёт application/x-www-form-urlencoded.
 * Поля в теле: event, data[FIELDS][ID], data[FIELDS][STAGE_ID],
 *              data[PREVIOUS_VALUES][STAGE_ID], ts, auth[...]
 */
router.post('/', verifyBitrixRequest, async (req, res) => {
  const body = req.body || {};

  const event = body.event || body.EVENT;
  const dealId =
    body['data[FIELDS][ID]'] ||
    body?.data?.FIELDS?.ID;
  const prevStageId =
    body['data[PREVIOUS_VALUES][STAGE_ID]'] ||
    body?.data?.PREVIOUS_VALUES?.STAGE_ID;
  const currentStageId =
    body['data[FIELDS][STAGE_ID]'] ||
    body?.data?.FIELDS?.STAGE_ID;

  logger.debug(
    `[Webhook] Event: ${event}, deal: ${dealId}, stage: ${prevStageId} → ${currentStageId}`
  );

  // Немедленно отвечаем 200 — Б24 ждёт быстрый ответ
  res.status(200).json({ ok: true });

  if (!dealId) return;

  const isUpdate = /onCrmDealUpdate/i.test(event);
  const isNew = /onCrmDealAdd/i.test(event);

  if (isUpdate && prevStageId && currentStageId && prevStageId !== currentStageId) {
    setImmediate(() => {
      notifyStageChange(dealId, prevStageId, currentStageId).catch((err) =>
        logger.error(`[Webhook] notifyStageChange failed for deal #${dealId}: ${err.message}`)
      );
    });
  } else if (isNew) {
    setImmediate(() => {
      notifyStageChange(dealId, null, currentStageId || 'NEW').catch((err) =>
        logger.error(`[Webhook] notifyStageChange (new) failed for #${dealId}: ${err.message}`)
      );
    });
  }
});

// GET — проверка доступности эндпоинта
router.get('/', (_req, res) => {
  res.json({ status: 'Bitrix24 webhook endpoint active' });
});

module.exports = router;