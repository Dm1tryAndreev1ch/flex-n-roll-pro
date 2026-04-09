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
  getDeal,
  updateDeal,
  addTimelineComment,
  sendEmailReply,
  convertLeadToDeal,
} = require('../services/bitrix');
const { resolveEnumId } = require('../services/fieldProvisioner');
const {
  getNextManager,
  resolvePool,
  buildTaskTitle,
  buildTaskDescription,
  getPreferredManager,
} = require('../services/routing');
const { checkAndLinkDuplicate } = require('../services/duplicates');
const { estimatePrice } = require('../services/calculatorClient');
const { generateAndAttachQuote } = require('../services/quoteGenerator');

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

      case 'ONCRMDEALADD':
        await handleCrmDealAdd(body);
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
  const contactId    = leadFields.CONTACT_ID || null;

  // Step 0: Duplicate detection
  const dupeResult = await safeCall(
    () => checkAndLinkDuplicate({ leadId, phone: contactPhone, email: contactEmail }),
    '[webhook:crmLeadAdd] Duplicate check failed'
  );

  if (dupeResult?.isDuplicate) {
    logger.info('[webhook:crmLeadAdd] Duplicate detected, continuing with linked contact', {
      leadId, contactId: dupeResult.contactId,
    });
  }

  await processLeadClassification({
    leadId,
    message,
    contactName,
    contactPhone,
    contactEmail,
    contactId:  dupeResult?.contactId || contactId,
    fileNames: [],
    dialogId:  null,
  });
}

/**
 * Handle onCrmDealAdd — a new deal was created in Bitrix24 CRM.
 */
async function handleCrmDealAdd(body) {
  const data   = body.data || body.DATA || {};
  const fields = data.FIELDS || data.fields || {};
  const dealId = fields.ID || fields.id;

  if (!dealId) {
    logger.warn('[webhook:crmDealAdd] Missing deal ID in event payload', { data });
    return;
  }

  logger.info('[webhook:crmDealAdd] Processing new deal', { dealId });

  let dealFields = fields;
  try {
    const dealData = await getDeal(dealId);
    if (dealData) dealFields = dealData;
  } catch (err) {
    logger.warn('[webhook:crmDealAdd] Could not fetch deal details', { dealId, error: err.message });
  }

  const message = [
    dealFields.COMMENTS,
    dealFields.TITLE,
  ].filter(Boolean).join('\n\n') || '(нет описания)';

  await processDealClassification({
    dealId,
    message,
    dealFields,
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
  contactId,
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
    logger.error('[pipeline] AI classification failed, using fallback', { leadId, error: err.message });
    // Send generic auto-reply if we have a dialog
    if (dialogId) {
      await safeCall(() =>
        sendMessage(dialogId, 'Ваше сообщение получено. Менеджер свяжется с вами в ближайшее время.')
      );
    }
    
    // Fallback classification to ensure the lead is not dropped
    classification = {
      intent: 'general_inquiry',
      product_type: 'unknown',
      urgency: 'medium',
      route_to: 'sales',
      priority: 3,
      auto_reply: null,
      extracted_data: {
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        company: null,
        budget: null,
        deadline: null,
        material: null,
        dimensions: null,
        quantity: null,
        has_files: false,
        notes: `[ВНИМАНИЕ: Ошибка AI при анализе: ${err.message}]`
      }
    };
  }

  const { intent, product_type, urgency, route_to, priority, auto_reply, extracted_data } = classification;

  // Record classification metrics
  aiClassificationsTotal.inc({ intent, product_type, priority: String(priority) });

  logger.info('[pipeline] Classification result', {
    leadId, intent, product_type, priority, route_to, urgency,
  });

  // Step 2: Resolve pool & select manager (smart routing + round-robin fallback)
  const pool = resolvePool(classification);

  // Try smart routing first: check if this contact had a previous manager
  let managerId = await safeCall(
    () => getPreferredManager(contactId),
    '[pipeline] Smart routing check failed'
  );

  if (managerId) {
    logger.info('[pipeline] Smart routing: using preferred manager', { leadId, managerId, contactId });
  } else {
    managerId = await getNextManager(pool);
    logger.info('[pipeline] Round-robin manager assigned', { leadId, pool, managerId });
  }

  // Step 2b: Auto-calculate price if we have enough data
  if (extracted_data.quantity && leadId) {
    const estimate = await safeCall(
      () => estimatePrice({
        quantity:    Number(extracted_data.quantity),
        material:    extracted_data.material,
        dimensions:  extracted_data.dimensions,
        productType: product_type,
      }),
      '[pipeline] Price estimation failed'
    );

    if (estimate?.price) {
      classification.extracted_data.budget = estimate.price;
      logger.info('[pipeline] Auto-calculated price', { leadId, price: estimate.price });

      // Generate PDF quote
      await safeCall(
        () => generateAndAttachQuote({
          clientName:   extracted_data.contact_name || contactName,
          clientCompany: extracted_data.company,
          clientEmail:  extracted_data.contact_email || contactEmail,
          productType:  product_type,
          material:     extracted_data.material,
          dimensions:   extracted_data.dimensions,
          quantity:     Number(extracted_data.quantity),
          price:        estimate.price,
          pricePerUnit: estimate.pricePerUnit,
          deadline:     extracted_data.deadline,
        }, 'lead', leadId),
        '[pipeline] Quote generation failed'
      );
    }
  }

  // Step 3: Update lead fields in Bitrix24
  if (leadId) {
    const crmFields = buildCrmFields('lead', classification, managerId);
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
  if (auto_reply) {
    // If there's an open dialog (IM / Open Lines), reply directly
    if (dialogId) {
      await safeCall(
        () => sendMessage(dialogId, auto_reply),
        '[pipeline] Failed to send auto-reply via IM'
      );
    }

    // Send email reply if the client has an email address
    const emailAddr = extracted_data.contact_email || contactEmail;
    if (emailAddr && leadId) {
      const emailName = extracted_data.contact_name || contactName || '';
      await safeCall(
        () => sendEmailReply({
          entityType: 'lead',
          entityId:   leadId,
          toEmail:    emailAddr,
          toName:     emailName,
          subject:    `Re: ${classification.intent === 'quote_request' ? 'Your quote request' : 'Your inquiry'} - FLEX-N-ROLL PRO`,
          body:       auto_reply.replace(/\n/g, '<br>'),
        }),
        '[pipeline] Failed to send email reply'
      );
    }

    // Save auto-reply in the lead's timeline for the manager to see
    if (leadId) {
      await safeCall(
        () => addTimelineComment('lead', leadId,
          `<b>AI auto-reply:</b><br>${auto_reply}`),
        '[pipeline] Failed to add timeline comment'
      );
    }
  }

  // Step 6: Auto-convert hot leads to deals
  if (leadId && (priority <= 2 || intent === 'order_placement')) {
    logger.info('[pipeline] Hot lead detected — auto-converting to deal', { leadId, priority, intent });
    await safeCall(
      () => convertLeadToDeal(leadId),
      `[pipeline] Failed to auto-convert lead ${leadId}`
    );
    if (leadId) {
      await safeCall(
        () => addTimelineComment('lead', leadId,
          `<b>🔥 Автоконвертация</b><br>Лид автоматически конвертирован в сделку (P${priority}, ${intent}).`),
        '[pipeline] Failed to add conversion comment'
      );
    }
  }

  logger.info('[pipeline] Lead processing complete', { leadId, dialogId, priority });
}

/**
 * Full pipeline for deals: classify → route → update deal → create task.
 */
async function processDealClassification({ dealId, message, dealFields }) {
  let classification;
  const classificationTimer = aiClassificationDuration.startTimer();
  try {
    classification = await classifyMessage({ message, fileNames: [] });
    classificationTimer();
  } catch (err) {
    classificationTimer();
    aiClassificationErrorsTotal.inc();
    logger.error('[pipeline:deal] AI classification failed, using fallback', { dealId, error: err.message });
    classification = {
      intent: 'general_inquiry',
      product_type: 'unknown',
      urgency: 'medium',
      route_to: 'sales',
      priority: 3,
      auto_reply: null,
      extracted_data: {
        contact_name: null, contact_phone: null, contact_email: null,
        company: null, budget: null, deadline: null,
        material: null, dimensions: null, quantity: null,
        has_files: false, notes: `[Ошибка AI: ${err.message}]`,
      },
    };
  }

  const { intent, product_type, priority } = classification;

  aiClassificationsTotal.inc({ intent, product_type, priority: String(priority) });

  logger.info('[pipeline:deal] Classification result', { dealId, intent, product_type, priority });

  const pool      = resolvePool(classification);
  const managerId = await getNextManager(pool);

  logger.info('[pipeline:deal] Manager assigned', { dealId, pool, managerId });

  // Update deal fields
  const crmFields = buildCrmFields('deal', classification, managerId);
  await safeCall(
    () => updateDeal(dealId, crmFields),
    `[pipeline:deal] Failed to update deal ${dealId}`
  );

  // Create task linked to deal
  const deadline        = calculateDeadline(priority);
  const taskTitle       = buildTaskTitle(classification, dealId, 'deal');
  const taskDescription = buildTaskDescription(classification, dealId, 'deal');

  await safeCall(
    () => createTask({
      title:         taskTitle,
      description:   taskDescription,
      responsibleId: managerId,
      deadline,
      leadId:        null,  // No lead - it's a deal
    }),
    '[pipeline:deal] Failed to create task'
  );

  // Save auto-reply in the deal's timeline
  if (classification.auto_reply) {
    await safeCall(
      () => addTimelineComment('deal', dealId,
        `<b>AI auto-reply:</b><br>${classification.auto_reply}`),
      '[pipeline:deal] Failed to add timeline comment'
    );
  }

  logger.info('[pipeline:deal] Deal processing complete', { dealId, priority });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map AI classification to Bitrix24 CRM field names.
 * Works for both leads and deals.
 * @param {'lead'|'deal'} entityType
 */
function buildCrmFields(entityType, classification, managerId) {
  const { intent, product_type, urgency, priority, extracted_data: d } = classification;

  const fields = {
    ASSIGNED_BY_ID:        managerId,
    UF_CRM_REQUEST_TYPE:   resolveEnumId(entityType, 'REQUEST_TYPE', intent),
    UF_CRM_PRODUCT_TYPE:   resolveEnumId(entityType, 'PRODUCT_TYPE', product_type),
    UF_CRM_URGENCY:        resolveEnumId(entityType, 'URGENCY', urgency),
    UF_CRM_AI_PRIORITY:    `P${priority}`,
    COMMENTS:              `[AI] Классифицировано: ${intent} / ${product_type} / P${priority}`,
  };

  // Set status depending on entity type
  if (entityType === 'lead') {
    fields.STATUS_ID = 'IN_PROCESS';
  } else if (entityType === 'deal') {
    // При успешной классификации перекинуть сделку на подготовку документов
    const isError = classification.extracted_data?.notes?.includes('[Ошибка AI:') || false;
    if (!isError) {
      fields.STAGE_ID = 'PREPARATION';
    }
  }

  // Extracted data → custom fields
  if (d.material)    fields.UF_CRM_MATERIAL       = d.material;
  if (d.dimensions)  fields.UF_CRM_DIMENSIONS     = d.dimensions;
  if (d.quantity)    fields.UF_CRM_QUANTITY        = Number(d.quantity) || 0;
  if (d.deadline)    fields.UF_CRM_CLIENT_DEADLINE = d.deadline;

  // Standard CRM fields
  if (d.contact_name && entityType === 'lead')  fields.NAME  = d.contact_name;
  if (d.contact_phone && entityType === 'lead') fields.PHONE = [{ VALUE: d.contact_phone, VALUE_TYPE: 'WORK' }];
  if (d.contact_email && entityType === 'lead') fields.EMAIL = [{ VALUE: d.contact_email, VALUE_TYPE: 'WORK' }];
  if (d.company && entityType === 'lead')       fields.COMPANY_TITLE = d.company;

  if (d.budget) {
    fields.OPPORTUNITY = d.budget;
    fields.CURRENCY_ID = 'BYN';
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