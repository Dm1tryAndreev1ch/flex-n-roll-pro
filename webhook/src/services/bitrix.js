// src/services/bitrix.js
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

// ─── Token storage ────────────────────────────────────────────────────────────
let _tokens = {
  accessToken:  config.bitrix.accessToken,
  refreshToken: config.bitrix.refreshToken,
};

function loadTokensFromFile() {
  try {
    const dir = path.dirname(config.bitrix.tokenFile);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(config.bitrix.tokenFile)) {
      const data = JSON.parse(fs.readFileSync(config.bitrix.tokenFile, 'utf8'));
      _tokens = { ...data };
      logger.debug('[bitrix] Tokens loaded from file');
    }
  } catch (err) {
    logger.warn('[bitrix] Could not load tokens from file', { error: err.message });
  }
}

function saveTokensToFile() {
  try {
    const dir = path.dirname(config.bitrix.tokenFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.bitrix.tokenFile, JSON.stringify(_tokens, null, 2), 'utf8');
    logger.debug('[bitrix] Tokens saved to file');
  } catch (err) {
    logger.error('[bitrix] Could not save tokens to file', { error: err.message });
  }
}

// Attempt to bootstrap tokens from file on module load
loadTokensFromFile();

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/**
 * Returns the OAuth2 authorisation URL.
 * Direct users here to obtain the initial code.
 */
function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     config.bitrix.clientId,
    response_type: 'code',
    redirect_uri:  config.bitrix.redirectUri,
  });
  return `https://${config.bitrix.portalDomain}/oauth/authorize/?${params.toString()}`;
}

/**
 * Exchange an authorisation code for access + refresh tokens.
 * Call this once from your /oauth/callback route.
 */
async function exchangeCode(code) {
  const url = `https://${config.bitrix.portalDomain}/oauth/token/`;
  const params = {
    grant_type:    'authorization_code',
    client_id:     config.bitrix.clientId,
    client_secret: config.bitrix.clientSecret,
    redirect_uri:  config.bitrix.redirectUri,
    code,
  };

  const response = await axios.get(url, { params, timeout: config.bitrix.timeout });
  _tokens = {
    accessToken:  response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
  saveTokensToFile();
  logger.info('[bitrix] OAuth tokens obtained via code exchange');
  return _tokens;
}

/**
 * Refresh the access token using the stored refresh token.
 */
async function refreshAccessToken() {
  logger.info('[bitrix] Refreshing access token…');
  const url = `https://${config.bitrix.portalDomain}/oauth/token/`;
  const params = {
    grant_type:    'refresh_token',
    client_id:     config.bitrix.clientId,
    client_secret: config.bitrix.clientSecret,
    refresh_token: _tokens.refreshToken,
  };

  const response = await axios.get(url, { params, timeout: config.bitrix.timeout });
  _tokens = {
    accessToken:  response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
  saveTokensToFile();
  logger.info('[bitrix] Access token refreshed successfully');
  return _tokens.accessToken;
}

// ─── REST API client ──────────────────────────────────────────────────────────

const baseURL = (domain) => `https://${domain}/rest/`;

/**
 * Call a Bitrix24 REST API method.
 * Automatically refreshes the access token on 401 and retries once.
 *
 * @param {string} method - e.g. 'crm.lead.update'
 * @param {object} params - Method parameters
 * @returns {Promise<*>}  - The `result` field of the API response
 */
async function callBitrix(method, params = {}) {
  return withRetry(
    async (attempt) => {
      try {
        const url = `${baseURL(config.bitrix.portalDomain)}${method}`;
        const body = { ...params, auth: _tokens.accessToken };

        logger.debug(`[bitrix] Calling ${method}`, { attempt });

        const response = await axios.post(url, body, {
          timeout: config.bitrix.timeout,
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.data.error) {
          const err = new Error(`Bitrix24 API error: ${response.data.error} — ${response.data.error_description}`);
          err.bitrixError = response.data.error;
          throw err;
        }

        return response.data.result;
      } catch (err) {
        // If Bitrix24 returns EXPIRED_TOKEN, refresh and retry
        if (err.bitrixError === 'expired_token' || (err.response && err.response.status === 401)) {
          logger.warn('[bitrix] Token expired, refreshing…');
          await refreshAccessToken();
          // Re-throw to trigger retry
          const retryErr = new Error('Token refreshed, retrying');
          retryErr.code = 'TOKEN_REFRESHED';
          throw retryErr;
        }
        throw err;
      }
    },
    {
      label: `bitrix.${method}`,
      shouldRetry: (err) => {
        if (err.code === 'TOKEN_REFRESHED') return true;
        return isTransientError(err);
      },
    }
  );
}

// ─── CRM operations ───────────────────────────────────────────────────────────

/**
 * Update a lead's fields in Bitrix24.
 *
 * @param {number|string} leadId
 * @param {object} fields - Key/value map of CRM fields to update
 */
async function updateLead(leadId, fields) {
  logger.info('[bitrix] Updating lead', { leadId, fields: Object.keys(fields) });
  return callBitrix('crm.lead.update', {
    id:     leadId,
    fields,
  });
}

/**
 * Create a task in Bitrix24.
 *
 * @param {object} taskData
 * @param {string}        taskData.title
 * @param {string}        taskData.description
 * @param {number|string} taskData.responsibleId - Assignee user ID
 * @param {Date}          taskData.deadline
 * @param {number|string} [taskData.leadId]      - Related CRM lead ID
 */
async function createTask({ title, description, responsibleId, deadline, leadId }) {
  logger.info('[bitrix] Creating task', { title, responsibleId, deadline });

  const fields = {
    TITLE:          title,
    DESCRIPTION:    description,
    RESPONSIBLE_ID: responsibleId,
    DEADLINE:       formatBitrixDate(deadline),
    PRIORITY:       '1', // High priority
  };

  // Attach to lead via UF field if provided
  if (leadId) {
    fields['UF_CRM_TASK'] = [`L_${leadId}`];
  }

  return callBitrix('tasks.task.add', { fields });
}

/**
 * Send a message in Bitrix24 Open Lines (IM).
 *
 * @param {string|number} dialogId - Dialog/chat ID from the webhook event
 * @param {string}        text     - Message text
 */
async function sendImMessage(dialogId, text) {
  logger.info('[bitrix] Sending IM message', { dialogId });
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
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  callBitrix,
  updateLead,
  createTask,
  sendImMessage,
  getLead,
  calculateDeadline,
  formatBitrixDate,
};