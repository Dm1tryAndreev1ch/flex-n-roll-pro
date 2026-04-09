// src/routes/webhook.js
'use strict';

const express = require('express');
const router  = express.Router();

const logger = require('../utils/logger');
const {
  aiClassificationsTotal,
  aiClassificationErrorsTotal,
  aiClassificationDuration,
} = require('../utils/metrics');
const { classifyMessage } = require('../services/lmstudio');
const {
  updateLead,
  createTask,
  sendMessage,
  calculateDeadline,
  getLead,
} = require('../services/bitrix');
const {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
} = require('../services/routing');

// ─── Event dispatcher ─────────────────────────────────────────────────────────

/**
 * POST /webhook
 * Main entry point for all Bitrix24 webhook events.
 * Bitrix24 sends event data as URL-encoded or JSON body.
 */
router.post('/', async (req, res) => {
  // Respond immediately — Bitrix24 expects plain text 200, not JSON
  res.status(200).send('ok');

  const body  = req.body || {};
  const event = (body.event || body.EVENT || '').toUpperCase();

  logger.debug('[webhook] Raw payload received', {
    keys:        Object.keys(body),
    event:       event || '(empty)',
    hasAuth:     !!(body.auth || body.AUTH),
    hasData:     !!(body.data || body.DATA),
    contentType: req.get('content-type'),
  });

  if (!event) {
    logger.warn('[webhook] Received request with no event field', {
      keys: Object.keys(body),
    });
    return;
  }

  logger.info('[webhook] Event received', { event });

  try {
    switch (event) {
      case 'ONCRMLEADADD':
        await handleCrmLeadAdd(body);
        break;

      case 'ONIMCONNECTORMESSAGEADD':
        await handleImMessageAdd(body);
        break;

      default:
        logger.warn('[webhook] Unhandled event type', { event });
    }
  } catch (err) {
    logger.error('[webhook] Unhandled error in event processing', {
      event,
      error: err.message,
      stack: err.stack,
    });
  }
});

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle onCrmLeadAdd — a new lead was created in Bitrix24 CRM.
 *
 * Bitrix24 outgoing webhook for OnCrmLeadAdd sends (urlencoded):
 *   event=ONCRMLEADADD
 *   data[FIELDS][ID]=123
 *   auth[domain]=mycompany.bitrix24.ru
 *   ...
 * With body-parser extended:true these parse as body.data.FIELDS.ID
 */
async function handleCrmLeadAdd(body) {
  const data   = body.data || body.DATA || {};
  const fields = data.FIELDS || data.fields || {};
  const leadId = fields.ID || fields.id;

  if (!leadId) {
    logger.warn('[webhook:crmLeadAdd] Missing lead ID in event payload', { data });
    return;
  }

  logger.info('[webhook:crmLeadAdd] Processing new lead', { leadId });

  // Fetch full lead data from Bitrix24 (outgoing webhook only sends ID)
  let leadFields = fields;
  try {
    const leadData = await getLead(leadId);
    if (leadData) leadFields = leadData;
  } catch (err) {
    logger.warn('[webhook:crmLeadAdd] Could not fetch lead details, using payload fields', { leadId, error: err.message });
  }

  const message = [
    leadFields.COMMENTS,
    leadFields.TITLE,
    leadFields.SOURCE_DESCRIPTION,
  ].filter(Boolean).join('\n\n') || '(нет описания)';

  const contactName  = [leadFields.NAME, leadFields.SECOND_NAME, leadFields.LAST_NAME].filter(Boolean).join(' ') || null;
  const contactPhone = (leadFields.PHONE && leadFields.PHONE[0]?.VALUE) || null;
  const contactEmail = (leadFields.EMAIL && leadFields.EMAIL[0]?.VALUE) || null;

  await processLeadClassification({
    leadId,
    message,
    contactName,
    contactPhone,
    contactEmail,
    fileNames: [],
    dialogId:  null,
  });
}

/**
 * Handle onImConnectorMessageAdd — a new message arrived via Open Lines.
 *
 * Bitrix24 outgoing webhook for OnImConnectorMessageAdd sends (urlencoded):
 *   event=ONIMCONNECTORMESSAGEADD
 *   data[PARAMS][MESSAGE]=Hello
 *   data[PARAMS][DIALOG_ID]=chat123
 *   data[PARAMS][CRM_ENTITY_ID]=456
 *   data[USER][NAME]=John
 *   ...
 * With body-parser extended:true → body.data.PARAMS.MESSAGE etc.
 */
async function handleImMessageAdd(body) {
  const data   = body.data || body.DATA || {};
  const params = data.PARAMS || data.params || data;

  const message  = params.MESSAGE  || params.message  || data.MESSAGE || '';
  const leadId   = params.CRM_ENTITY_ID || data.CRM_ENTITY_ID || null;
  const dialogId = params.DIALOG_ID     || data.DIALOG_ID     || null;

  // Extract attached files
  const files    = params.FILES || data.FILES || data.ATTACHMENTS || [];
  const fileNames = Array.isArray(files)
    ? files.map((f) => f.NAME || f.name || String(f)).filter(Boolean)
    : [];

  // Contact data from connector user
  const connectorUser = data.USER || data.user || {};
  const contactName   = connectorUser.NAME  || connectorUser.name  || null;
  const contactPhone  = connectorUser.PHONE || connectorUser.phone || null;
  const contactEmail  = connectorUser.EMAIL || connectorUser.email || null;

  logger.info('[webhook:imMessage] Processing IM message', {
    leadId,
    dialogId,
    fileCount: fileNames.length,
  });

  if (!message) {
    logger.warn('[webhook:imMessage] Empty message body, skipping');
    return;
  }

  await processLeadClassification({
    leadId,
    message,
    contactName,
    contactPhone,
    contactEmail,
    fileNames,
    dialogId,
  });
}

// ─── Core orchestration ───────────────────────────────────────────────────────

/**
 * Full pipeline: classify → route → update lead → create task → auto-reply.
 */
async function processLeadClassification({
  leadId,
  message,
  contactName,
  contactPhone,
  contactEmail,
  fileNames,
  dialogId,
}) {
  // Step 1: AI classification (with metrics instrumentation)
  let classification;
  const classificationTimer = aiClassificationDuration.startTimer();
  try {
    classification = await classifyMessage({
      message,
      contactName,
      contactPhone,
      contactEmail,
      fileNames,
    });
    classificationTimer(); // stop timer on success
  } catch (err) {
    classificationTimer(); // stop timer on error
    aiClassificationErrorsTotal.inc();
    logger.error('[pipeline] AI classification failed', { leadId, error: err.message });
    // Send generic auto-reply if we have a dialog
    if (dialogId) {
      await safeCall(() =>
        sendMessage(dialogId, 'Ваше сообщение получено. Менеджер свяжется с вами в ближайшее время.')
      );
    }
    return;
  }

  const { intent, product_type, urgency, route_to, priority, auto_reply, extracted_data } = classification;

  // Record classification metrics
  aiClassificationsTotal.inc({ intent, product_type, priority: String(priority) });

  logger.info('[pipeline] Classification result', {
    leadId, intent, product_type, priority, route_to, urgency,
  });

  // Step 2: Resolve pool & select manager (round-robin)
  const pool      = resolvePool(classification);
  const managerId = await getNextManager(pool);

  logger.info('[pipeline] Manager assigned', { leadId, pool, managerId });

  // Step 3: Update lead fields in Bitrix24
  if (leadId) {
    const crmFields = buildCrmFields(classification, managerId);
    await safeCall(
      () => updateLead(leadId, crmFields),
      `[pipeline] Failed to update lead ${leadId}`
    );
  }

  // Step 4: Create SLA-based task
  if (leadId) {
    const deadline        = calculateDeadline(priority);
    const taskTitle       = buildTaskTitle(classification, leadId);
    const taskDescription = buildTaskDescription(classification, leadId);

    await safeCall(
      () => createTask({
        title:         taskTitle,
        description:   taskDescription,
        responsibleId: managerId,
        deadline,
        leadId,
      }),
      '[pipeline] Failed to create task'
    );
  }

  // Step 5: Send auto-reply to client
  if (dialogId && auto_reply) {
    await safeCall(
      () => sendMessage(dialogId, auto_reply),
      '[pipeline] Failed to send auto-reply'
    );
  }

  logger.info('[pipeline] Lead processing complete', { leadId, dialogId, priority });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map AI classification to Bitrix24 CRM field names.
 * Adjust UF_ field names to match your Bitrix24 configuration.
 */
function buildCrmFields(classification, managerId) {
  const { intent, product_type, urgency, priority, extracted_data: d } = classification;

  const fields = {
    ASSIGNED_BY_ID:        managerId,
    UF_CRM_REQUEST_TYPE:   intent,
    UF_CRM_PRODUCT_TYPE:   product_type,
    UF_CRM_URGENCY:        urgency,
    UF_CRM_AI_PRIORITY:    String(priority),
    COMMENTS:              `[AI] Классифицировано: ${intent} / ${product_type} / P${priority}`,
  };

  if (d.contact_name)  fields.NAME  = d.contact_name;
  if (d.contact_phone) fields.PHONE = [{ VALUE: d.contact_phone, VALUE_TYPE: 'WORK' }];
  if (d.contact_email) fields.EMAIL = [{ VALUE: d.contact_email, VALUE_TYPE: 'WORK' }];
  if (d.company)       fields.COMPANY_TITLE = d.company;

  if (d.budget) {
    fields.OPPORTUNITY = d.budget;
    fields.CURRENCY_ID = 'RUB';
  }

  return fields;
}

/**
 * Execute an async call, logging errors without propagating.
 * Ensures one failed step doesn't abort the entire pipeline.
 */
async function safeCall(fn, label = '[pipeline:safeCall]') {
  try {
    return await fn();
  } catch (err) {
    logger.error(`${label}: ${err.message}`, { stack: err.stack });
    return null;
  }
}

module.exports = router;