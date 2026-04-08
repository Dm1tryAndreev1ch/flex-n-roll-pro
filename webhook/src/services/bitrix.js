// src/services/bitrix.js
'use strict';

const axios  = require('axios');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

// ─── REST API client ──────────────────────────────────────────────────────────

/**
 * Call a Bitrix24 REST API method via incoming webhook URL.
 *
 * @param {string} method - e.g. 'crm.lead.update'
 * @param {object} params - Method parameters
 * @returns {Promise<*>}  - The `result` field of the API response
 */
async function callBitrix(method, params = {}) {
  return withRetry(
    async (attempt) => {
      const url = `${config.bitrix.webhookUrl.replace(/\/+$/, '/')}${method}`;

      logger.debug(`[bitrix] Calling ${method}`, { attempt });

      const response = await axios.post(url, params, {
        timeout: config.bitrix.timeout,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data.error) {
        throw new Error(`Bitrix24 error: ${response.data.error} — ${response.data.error_description}`);
      }

      return response.data.result;
    },
    {
      label: `bitrix.${method}`,
      shouldRetry: (err) => isTransientError(err),
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
 * Update a deal's fields in Bitrix24.
 *
 * @param {number|string} dealId
 * @param {object} fields - Key/value map of CRM fields to update
 */
async function updateDeal(dealId, fields) {
  logger.info('[bitrix] Updating deal', { dealId, fields: Object.keys(fields) });
  return callBitrix('crm.deal.update', { id: dealId, fields });
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
 * Retrieve a contact by ID.
 * @param {number|string} contactId
 */
async function getContact(contactId) {
  return callBitrix('crm.contact.get', { id: contactId });
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

module.exports = {
  callBitrix,
  createTask,
  updateDeal,
  sendMessage,
  getLead,
  getContact,
  updateLead,
  calculateDeadline,
  formatBitrixDate,
};
