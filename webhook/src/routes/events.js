// src/routes/events.js
'use strict';

/**
 * Event Gateway Routes
 *
 * Receives Bitrix24 events via ngrok and forwards them
 * to internal processing + microservices.
 *
 * POST /events/deals → deal stage automation + forward to fnr-marking
 * POST /events/calls → missed call tasks + forward to fnr-commanalysis
 */

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const logger = require('../utils/logger');
const config = require('../../config/config');
const {
  callBitrix,
  createTask,
  getDealStage,
  sendNotification,
  addTimelineComment,
  calculateDeadline,
} = require('../services/bitrix');

// Internal service URLs (Docker network)
const MARKING_URL      = 'http://fnr-marking:3000/webhook/b24';
const COMMANALYSIS_URL = 'http://fnr-commanalysis:3000/api/webhook/bitrix';

// ─── Deal stage → task mapping ────────────────────────────────────────────────

const STAGE_TASKS = {
  'NEW': {
    title:  'Связаться с клиентом',
    pool:   'sales',
    hours:  4,
  },
  'PREPARATION': {
    title:  'Подготовить коммерческое предложение',
    pool:   'sales',
    hours:  8,
  },
  'PREPAYMENT_INVOICE': {
    title:  'Контроль оплаты счёта',
    pool:   'sales',
    hours:  24,
  },
  'EXECUTING': {
    title:  'Запуск в производство',
    pool:   'tech',
    hours:  2,
  },
  // Custom stages (if configured in Bitrix24)
  'UC_DESIGN': {
    title:  'Разработка/согласование макета',
    pool:   'tech',
    hours:  24,
  },
  'UC_PREPRESS': {
    title:  'Препресс подготовка',
    pool:   'tech',
    hours:  8,
  },
  'UC_PRODUCTION': {
    title:  'Производство тиража',
    pool:   'tech',
    hours:  48,
  },
  'UC_QUALITY': {
    title:  'Контроль качества',
    pool:   'quality',
    hours:  4,
  },
  'UC_DELIVERY': {
    title:  'Организация доставки',
    pool:   'sales',
    hours:  8,
  },
  'FINAL_INVOICE': {
    title:  'Финальный расчёт',
    pool:   'sales',
    hours:  8,
  },
};

// Track processed stage changes to avoid duplicate task creation
const processedStageChanges = new Map();

/**
 * POST /events/deals
 * Handle deal stage changes + forward to marking service.
 * Events: ONCRMDEALUPDATE
 */
router.post('/deals', async (req, res) => {
  // Respond immediately to Bitrix24
  res.status(200).send('ok');

  const body  = req.body || {};
  const event = (body.event || body.EVENT || '').toUpperCase();
  const data  = body.data || body.DATA || {};
  const fields = data.FIELDS || data.fields || {};
  const dealId = fields.ID || fields.id;

  logger.info('[gateway] Deal event received', { event, dealId });

  // Forward to marking service (non-blocking)
  forwardToService(MARKING_URL, body, 'marking').catch(() => {});

  // Process deal stage change
  if (event === 'ONCRMDEALUPDATE' && dealId) {
    processDealStageChange(dealId).catch(err =>
      logger.error('[gateway] Deal stage processing failed', { dealId, error: err.message })
    );
  }
});

/**
 * Process a deal stage change and create appropriate tasks.
 */
async function processDealStageChange(dealId) {
  let deal;
  try {
    deal = await getDealStage(dealId);
  } catch (err) {
    logger.warn('[gateway] Cannot fetch deal for stage processing', { dealId, error: err.message });
    return;
  }

  if (!deal || !deal.STAGE_ID) return;

  const stageId    = deal.STAGE_ID;
  const assignedTo = deal.ASSIGNED_BY_ID;
  const dealTitle  = deal.TITLE || `Сделка #${dealId}`;

  // Dedup: skip if we already processed this exact stage change
  const dedupeKey = `${dealId}:${stageId}`;
  if (processedStageChanges.has(dedupeKey)) {
    logger.debug('[gateway] Stage change already processed, skipping', { dedupeKey });
    return;
  }
  processedStageChanges.set(dedupeKey, Date.now());

  // Cleanup old entries (keep last 1000)
  if (processedStageChanges.size > 1000) {
    const entries = [...processedStageChanges.entries()];
    entries.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < entries.length - 500; i++) {
      processedStageChanges.delete(entries[i][0]);
    }
  }

  const stageConfig = STAGE_TASKS[stageId];
  if (!stageConfig) {
    logger.debug('[gateway] No task config for stage', { stageId, dealId });
    return;
  }

  logger.info('[gateway] Creating task for deal stage', {
    dealId, stageId, taskTitle: stageConfig.title,
  });

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + stageConfig.hours);

  try {
    await createTask({
      title:         `[Сделка #${dealId}] ${stageConfig.title}`,
      description:   `Автозадача при переходе на стадию "${stageId}".\n\nСделка: ${dealTitle}\nID: ${dealId}`,
      responsibleId: assignedTo,
      deadline,
      leadId:        null,
    });

    // Add timeline comment
    await addTimelineComment('deal', dealId,
      `<b>📋 Автозадача:</b> ${stageConfig.title}<br>` +
      `Дедлайн: ${deadline.toLocaleString('ru-RU')}`
    ).catch(() => {});

    logger.info('[gateway] Stage task created', { dealId, stageId });
  } catch (err) {
    logger.error('[gateway] Failed to create stage task', { dealId, error: err.message });
  }

  // Special actions for specific stages
  if (stageId === 'UC_DELIVERY' || stageId === 'FINAL_INVOICE') {
    // Notify the client (if we have their contact info)
    try {
      if (deal.CONTACT_ID) {
        const contact = await callBitrix('crm.contact.get', { id: deal.CONTACT_ID });
        if (contact) {
          const clientName = [contact.NAME, contact.LAST_NAME].filter(Boolean).join(' ');
          await addTimelineComment('deal', dealId,
            `<b>📦 Уведомление клиенту:</b><br>` +
            `${clientName}, ваш заказ "${dealTitle}" готов к отгрузке!`
          ).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn('[gateway] Failed to notify client about delivery', { error: err.message });
    }
  }
}

// ─── Call handling ─────────────────────────────────────────────────────────────

/**
 * POST /events/calls
 * Handle telephony events + forward to commanalysis.
 * Events: ONVOXIMPLANTCALLEND
 */
router.post('/calls', async (req, res) => {
  // Respond immediately to Bitrix24
  res.status(200).send('ok');

  const body  = req.body || {};
  const event = (body.event || body.EVENT || '').toUpperCase();
  const data  = body.data || body.DATA || {};

  logger.info('[gateway] Call event received', { event });

  // Forward to commanalysis service (non-blocking)
  forwardToService(COMMANALYSIS_URL, body, 'commanalysis').catch(() => {});

  // Handle missed calls
  if (event === 'ONVOXIMPLANTCALLEND') {
    processMissedCall(data).catch(err =>
      logger.error('[gateway] Missed call processing failed', { error: err.message })
    );
  }
});

/**
 * Process a call event — if the call was missed or unanswered,
 * create a "Call back" task for the responsible manager.
 */
async function processMissedCall(data) {
  const callData = data.CALL || data.call || data;
  const callType     = callData.CALL_TYPE || callData.call_type;           // 1=outbound, 2=inbound
  const callDuration = Number(callData.CALL_DURATION || callData.duration || 0);
  const callStatus   = callData.CALL_FAILED_CODE || callData.status_code;  // 304=missed
  const portalUserId = callData.PORTAL_USER_ID || callData.user_id;
  const phoneNumber  = callData.PHONE_NUMBER || callData.phone;
  const crmEntityId  = callData.CRM_ENTITY_ID;
  const crmEntityType = callData.CRM_ENTITY_TYPE;

  // Only process incoming missed/unanswered calls
  const isIncoming = String(callType) === '2';
  const isMissed   = callDuration === 0 || String(callStatus) === '304';

  if (!isIncoming || !isMissed) {
    logger.debug('[gateway] Call is not a missed incoming call, skipping', {
      callType, callDuration, callStatus,
    });
    return;
  }

  logger.info('[gateway] Missed call detected!', {
    phoneNumber, portalUserId, crmEntityId,
  });

  // Determine who should call back
  const responsibleId = portalUserId || 1; // Fallback to admin

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 1); // 1 hour to call back

  // Create task
  try {
    await createTask({
      title:         `📞 Перезвонить: ${phoneNumber || 'неизвестный номер'}`,
      description:   [
        'Пропущенный входящий звонок.',
        '',
        `Номер: ${phoneNumber || 'не определён'}`,
        crmEntityId ? `CRM: ${crmEntityType || 'Lead'} #${crmEntityId}` : '',
        `Время звонка: ${new Date().toLocaleString('ru-RU')}`,
        '',
        'Необходимо перезвонить клиенту в течение 1 часа.',
      ].filter(Boolean).join('\n'),
      responsibleId,
      deadline,
      leadId: crmEntityType === 'LEAD' ? crmEntityId : null,
    });

    logger.info('[gateway] Callback task created', { phoneNumber, responsibleId });
  } catch (err) {
    logger.error('[gateway] Failed to create callback task', { error: err.message });
  }

  // Send immediate notification
  if (portalUserId) {
    await sendNotification(portalUserId,
      `📞 [b]Пропущенный звонок![/b]\nНомер: ${phoneNumber || 'не определён'}. Перезвоните!`
    ).catch(() => {});
  }

  // Add timeline comment if we have a CRM entity
  if (crmEntityId && crmEntityType) {
    const entityType = crmEntityType === 'DEAL' ? 'deal' : 'lead';
    await addTimelineComment(entityType, crmEntityId,
      `<b>📞 Пропущенный звонок</b><br>Номер: ${phoneNumber || 'не определён'}<br>Создана задача на перезвон.`
    ).catch(() => {});
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Forward event payload to an internal microservice.
 */
async function forwardToService(url, body, serviceName) {
  try {
    await axios.post(url, body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info(`[gateway] Event forwarded to ${serviceName}`);
  } catch (err) {
    logger.error(`[gateway] Failed to forward event to ${serviceName}`, {
      error:  err.message,
      status: err.response?.status,
    });
  }
}

module.exports = router;
