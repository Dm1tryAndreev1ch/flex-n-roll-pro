// src/services/bitrix.js
'use strict';

const axios  = require('axios');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

// ─── REST API client ──────────────────────────────────────────────────────────

/**
 * Call a Bitrix24 REST API method.
 *
 * Supports two modes:
 *   1. OAuth (primary)  — uses access_token from oauth module
 *   2. Webhook (fallback) — uses BITRIX_WEBHOOK_URL if OAuth not configured
 *
 * @param {string} method - e.g. 'crm.lead.update'
 * @param {object} params - Method parameters
 * @returns {Promise<*>}  - The `result` field of the API response
 */
async function callBitrix(method, params = {}) {
  return withRetry(
    async (attempt) => {
      let url;

      // Try OAuth first
      try {
        const oauth = require('./oauth');
        const accessToken = await oauth.getAccessToken();
        const domain = await oauth.getPortalDomain();

        if (accessToken && domain) {
          url = `https://${domain}/rest/${method}?auth=${accessToken}`;
          logger.debug(`[bitrix] Calling ${method} via OAuth`, { attempt });
        }
      } catch {
        // OAuth not available — fall through to webhook URL
      }

      // Fallback to webhook URL
      if (!url) {
        if (!config.bitrix.webhookUrl) {
          throw new Error('Neither OAuth nor BITRIX_WEBHOOK_URL configured');
        }
        url = `${config.bitrix.webhookUrl.replace(/\/+$/, '/')}${method}`;
        logger.debug(`[bitrix] Calling ${method} via webhook URL`, { attempt });
      }

      const response = await axios.post(url, params, {
        timeout: config.bitrix.timeout,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true, // Don't throw AxiosError on 4XX/5XX to parse Bitrix JSON
      });

      if (response.data && response.data.error) {
        const err = new Error(`Bitrix24 error [${response.status}]: ${response.data.error} — ${response.data.error_description}`);
        // If token expired, try to refresh and retry
        if (response.data.error === 'expired_token') {
          try {
            const oauth = require('./oauth');
            await oauth.refreshTokens();
            logger.info('[bitrix] Token refreshed after expired_token error');
          } catch (refreshErr) {
            logger.error('[bitrix] Failed to refresh token', { error: refreshErr.message });
          }
          err.isTokenExpired = true;
        }
        throw err;
      }

      return response.data.result;
    },
    {
      label: `bitrix.${method}`,
      shouldRetry: (err) => {
        // Always retry token expiry (after refresh)
        if (err.isTokenExpired) return true;
        return isTransientError(err);
      },
    }
  );
}

// ─── CRM operations ───────────────────────────────────────────────────────────

/**
 * Create a task in Bitrix24.
 *
 * @param {object}       taskData
 * @param {string}       taskData.title
 * @param {string}       taskData.description
 * @param {number|string} taskData.responsibleId - Assignee user ID
 * @param {Date}         taskData.deadline
 * @param {number|string} [taskData.leadId]      - Related CRM lead ID
 */
async function createTask({ title, description, responsibleId, deadline, leadId }) {
  logger.info('[bitrix] Creating task', { title, responsibleId, deadline });

  const fields = {
    TITLE:          title,
    DESCRIPTION:    description,
    RESPONSIBLE_ID: responsibleId,
    DEADLINE:       formatBitrixDate(deadline),
    PRIORITY:       '1',
  };

  if (leadId) {
    fields['UF_CRM_TASK'] = [`L_${leadId}`];
  }

  return callBitrix('tasks.task.add', { fields });
}

/**
 * Send a message via Bitrix24 Open Lines (IM).
 *
 * @param {string|number} dialogId - Dialog/chat ID from the webhook event
 * @param {string}        text     - Message text
 */
async function sendMessage(dialogId, text) {
  logger.info('[bitrix] Sending message', { dialogId });
  return callBitrix('im.message.add', {
    DIALOG_ID: dialogId,
    MESSAGE:   text,
  });
}

/**
 * Retrieve a lead by ID.
 * @param {number|string} leadId
 */
async function getLead(leadId) {
  return callBitrix('crm.lead.get', { id: leadId });
}

/**
 * Update a lead's fields in Bitrix24.
 *
 * @param {number|string} leadId
 * @param {object} fields
 */
async function updateLead(leadId, fields) {
  logger.info('[bitrix] Updating lead', { leadId, fields: Object.keys(fields) });
  return callBitrix('crm.lead.update', { id: leadId, fields });
}

/**
 * Get all active users from Bitrix24.
 * Requires the "user" scope in the OAuth application settings.
 */
async function getUsers() {
  logger.info('[bitrix] Fetching active users');
  return callBitrix('user.get', {
    FILTER: { ACTIVE: 'Y' },
  });
}

/**
 * Retrieve a deal by ID.
 * @param {number|string} dealId
 */
async function getDeal(dealId) {
  return callBitrix('crm.deal.get', { id: dealId });
}

/**
 * Update a deal's fields in Bitrix24.
 * @param {number|string} dealId
 * @param {object} fields
 */
async function updateDeal(dealId, fields) {
  logger.info('[bitrix] Updating deal', { dealId, fields: Object.keys(fields) });
  return callBitrix('crm.deal.update', { id: dealId, fields });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a JS Date to Bitrix24 expected ISO 8601 string.
 * Bitrix24 REST expects: "YYYY-MM-DDTHH:MM:SS+HH:MM"
 */
function formatBitrixDate(date) {
  return date.toISOString().replace('Z', '+00:00');
}

/**
 * Calculate a task deadline based on SLA priority.
 * @param {number} priority - 1 (HOT) to 5 (COLD)
 * @returns {Date}
 */
function calculateDeadline(priority) {
  const hoursToAdd = config.sla[priority] ?? config.sla[4];
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hoursToAdd);
  return deadline;
}

/**
 * Add a comment to a CRM entity's timeline.
 * @param {'lead'|'deal'|'contact'|'company'} entityType
 * @param {number|string} entityId
 * @param {string} comment - Comment text (HTML supported)
 */
async function addTimelineComment(entityType, entityId, comment) {
  const ownerTypeMap = {
    lead: 'CRM_LEAD',
    deal: 'CRM_DEAL',
    contact: 'CRM_CONTACT',
    company: 'CRM_COMPANY',
  };

  const ownerType = ownerTypeMap[entityType] || 'CRM_LEAD';
  logger.info('[bitrix] Adding timeline comment', { entityType, entityId });

  return callBitrix('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID:   entityId,
      ENTITY_TYPE: ownerType,
      COMMENT:     comment,
    },
  });
}

/**
 * Send an email reply via CRM activity.
 * This creates an outgoing email activity on the entity and actually sends the email
 * if the CRM mailbox integration is configured in Bitrix24.
 *
 * @param {object} params
 * @param {'lead'|'deal'} params.entityType
 * @param {number|string} params.entityId
 * @param {string} params.toEmail - Recipient email address
 * @param {string} params.toName  - Recipient name
 * @param {string} params.subject - Email subject
 * @param {string} params.body    - Email body (HTML)
 */
async function sendEmailReply({ entityType, entityId, toEmail, toName, subject, body }) {
  if (!toEmail) {
    logger.warn('[bitrix] Cannot send email reply — no email address', { entityType, entityId });
    return null;
  }

  // Bitrix24 OWNER_TYPE_ID: 1 = Lead, 2 = Deal, 3 = Contact, 4 = Company
  const ownerTypeId = entityType === 'deal' ? 2 : 1;

  logger.info('[bitrix] Sending email reply', { entityType, entityId, toEmail });

  return callBitrix('crm.activity.add', {
    fields: {
      OWNER_TYPE_ID:    ownerTypeId,
      OWNER_ID:         entityId,
      TYPE_ID:          4,           // Email
      DIRECTION:        2,           // Outgoing
      SUBJECT:          subject,
      DESCRIPTION:      body,
      DESCRIPTION_TYPE: 3,           // HTML
      COMPLETED:        'Y',
      COMMUNICATIONS:   [{
        VALUE:      toEmail,
        ENTITY_ID:  0,
        TYPE:       'EMAIL',
      }],
    },
  });
}

// ─── Automation API methods ───────────────────────────────────────────────────

/**
 * Convert a lead to a deal + contact.
 * Bitrix24 handles the conversion natively via STATUS_ID change.
 * @param {number|string} leadId
 * @returns {Promise<*>}
 */
async function convertLeadToDeal(leadId) {
  logger.info('[bitrix] Converting lead to deal', { leadId });
  return callBitrix('crm.lead.update', {
    id: leadId,
    fields: { STATUS_ID: 'CONVERTED' },
  });
}

/**
 * Search for duplicate contacts/leads by phone or email.
 * @param {object} params
 * @param {string[]} [params.phones] - Phone numbers to search
 * @param {string[]} [params.emails] - Email addresses to search
 * @returns {Promise<object>} Duplicate matches { LEAD, CONTACT, COMPANY }
 */
async function findDuplicates({ phones = [], emails = [] }) {
  const results = { LEAD: [], CONTACT: [], COMPANY: [] };

  if (phones.length > 0) {
    try {
      const phoneResult = await callBitrix('crm.duplicate.findbycomm', {
        type: 'PHONE',
        values: phones,
        entity_type: 'ALL',
      });
      if (phoneResult) Object.assign(results, phoneResult);
    } catch (err) {
      logger.warn('[bitrix] Duplicate phone search failed', { error: err.message });
    }
  }

  if (emails.length > 0) {
    try {
      const emailResult = await callBitrix('crm.duplicate.findbycomm', {
        type: 'EMAIL',
        values: emails,
        entity_type: 'ALL',
      });
      if (emailResult) {
        // Merge with phone results
        for (const key of ['LEAD', 'CONTACT', 'COMPANY']) {
          if (emailResult[key]) {
            results[key] = [...new Set([...(results[key] || []), ...emailResult[key]])];
          }
        }
      }
    } catch (err) {
      logger.warn('[bitrix] Duplicate email search failed', { error: err.message });
    }
  }

  return results;
}

/**
 * Send an in-app notification to a user.
 * @param {number|string} userId
 * @param {string} message - Notification text (BB-code supported)
 */
async function sendNotification(userId, message) {
  logger.info('[bitrix] Sending notification', { userId });
  return callBitrix('im.notify.system.add', {
    USER_ID: userId,
    MESSAGE: message,
  });
}

/**
 * Get open (not completed) tasks with CRM bindings.
 * Used by SLA monitor to check overdue tasks.
 * @returns {Promise<Array>}
 */
async function getOpenTasks() {
  const result = await callBitrix('tasks.task.list', {
    filter: {
      '!STATUS': 5,          // Not completed
      '!UF_CRM_TASK': '',    // Has CRM binding
    },
    select: ['ID', 'TITLE', 'RESPONSIBLE_ID', 'DEADLINE', 'CREATED_DATE', 'STATUS', 'UF_CRM_TASK'],
    order: { DEADLINE: 'asc' },
    start: 0,
  });
  // Bitrix returns { tasks: [...] } for tasks.task.list
  return result?.tasks || result || [];
}

/**
 * Get deals associated with a contact.
 * Used for smart routing (find previous manager).
 * @param {number|string} contactId
 * @returns {Promise<Array>}
 */
async function getDealsByContact(contactId) {
  return callBitrix('crm.deal.list', {
    filter: { CONTACT_ID: contactId },
    select: ['ID', 'ASSIGNED_BY_ID', 'STAGE_ID', 'CLOSEDATE'],
    order: { CLOSEDATE: 'desc' },
  }) || [];
}

/**
 * Get a deal's full data including stage.
 * @param {number|string} dealId
 * @returns {Promise<object>}
 */
async function getDealStage(dealId) {
  return callBitrix('crm.deal.get', { id: dealId });
}

module.exports = {
  callBitrix,
  createTask,
  sendMessage,
  getLead,
  updateLead,
  getUsers,
  getDeal,
  updateDeal,
  addTimelineComment,
  sendEmailReply,
  convertLeadToDeal,
  findDuplicates,
  sendNotification,
  getOpenTasks,
  getDealsByContact,
  getDealStage,
  calculateDeadline,
  formatBitrixDate,
};
