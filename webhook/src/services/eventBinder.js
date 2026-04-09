// src/services/eventBinder.js
'use strict';

/**
 * Bitrix24 Event Binder
 *
 * Uses the REST API event.bind method to programmatically subscribe
 * to CRM events. This replaces the manual "outgoing webhook" setup.
 *
 * Events are bound to the public ngrok URL so Bitrix24 can reach
 * the local webhook service.
 */

const logger = require('../utils/logger');
const oauth  = require('./oauth');
const axios  = require('axios');

// Events that the webhook service handles directly
const WEBHOOK_EVENTS = [
  'ONCRMLEADADD',
];

// Events forwarded to internal services via Event Gateway
const GATEWAY_EVENTS = [
  { event: 'ONCRMDEALUPDATE',       path: '/events/deals' },
  { event: 'ONVOXIMPLANTCALLEND',   path: '/events/calls' },
];

/**
 * Bind all required events to the given public URL.
 * Uses OAuth access_token for authentication.
 *
 * @param {string} publicUrl - Public ngrok URL (e.g., https://abc123.ngrok-free.app)
 */
async function bindAllEvents(publicUrl) {
  if (!publicUrl) {
    logger.warn('[eventBinder] No public URL provided — skipping event binding');
    return;
  }

  let accessToken;
  try {
    accessToken = await oauth.getAccessToken();
  } catch (err) {
    logger.warn('[eventBinder] OAuth not configured — skipping event binding. Install the app first via /install', {
      error: err.message,
    });
    return;
  }

  const domain = await oauth.getPortalDomain();
  if (!domain) {
    logger.error('[eventBinder] Cannot determine Bitrix24 portal domain');
    return;
  }

  const baseApiUrl = `https://${domain}/rest`;

  // First, unbind old handlers to avoid duplicates
  await _unbindAll(baseApiUrl, accessToken);

  // Bind webhook events (handled directly by webhook service)
  for (const event of WEBHOOK_EVENTS) {
    const handlerUrl = `${publicUrl}/webhook`;
    await _bindEvent(baseApiUrl, accessToken, event, handlerUrl);
  }

  // Bind gateway events (forwarded to internal services)
  for (const { event, path } of GATEWAY_EVENTS) {
    const handlerUrl = `${publicUrl}${path}`;
    await _bindEvent(baseApiUrl, accessToken, event, handlerUrl);
  }

  logger.info('[eventBinder] All events bound successfully', {
    publicUrl,
    events: [
      ...WEBHOOK_EVENTS,
      ...GATEWAY_EVENTS.map(e => e.event),
    ],
  });
}

/**
 * Unbind all existing event handlers to prevent duplicates.
 */
async function _unbindAll(baseApiUrl, accessToken) {
  try {
    const { data } = await axios.post(
      `${baseApiUrl}/event.get?auth=${accessToken}`,
      {},
      { timeout: 15000 }
    );

    const handlers = data.result || [];
    if (!Array.isArray(handlers) || handlers.length === 0) {
      logger.debug('[eventBinder] No existing event handlers to unbind');
      return;
    }

    for (const handler of handlers) {
      try {
        await axios.post(
          `${baseApiUrl}/event.unbind?auth=${accessToken}`,
          {
            event:   handler.event || handler.EVENT,
            handler: handler.handler || handler.HANDLER,
          },
          { timeout: 15000 }
        );
        logger.debug('[eventBinder] Unbound event', {
          event:   handler.event || handler.EVENT,
          handler: handler.handler || handler.HANDLER,
        });
      } catch (err) {
        logger.warn('[eventBinder] Failed to unbind event', {
          event: handler.event,
          error: err.message,
        });
      }
    }

    logger.info(`[eventBinder] Unbound ${handlers.length} existing handler(s)`);
  } catch (err) {
    logger.warn('[eventBinder] Failed to get existing handlers', { error: err.message });
  }
}

/**
 * Bind a single event to a handler URL.
 */
async function _bindEvent(baseApiUrl, accessToken, event, handlerUrl) {
  try {
    const { data } = await axios.post(
      `${baseApiUrl}/event.bind?auth=${accessToken}`,
      {
        event,
        handler:    handlerUrl,
        event_type: 'online',
      },
      { timeout: 15000 }
    );

    if (data.error) {
      logger.error(`[eventBinder] Failed to bind ${event}`, {
        error: data.error,
        description: data.error_description,
      });
      return;
    }

    logger.info(`[eventBinder] Bound ${event} → ${handlerUrl}`);
  } catch (err) {
    logger.error(`[eventBinder] Error binding ${event}`, { error: err.message });
  }
}

module.exports = {
  bindAllEvents,
};
