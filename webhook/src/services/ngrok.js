// src/services/ngrok.js
'use strict';

/**
 * ngrok Tunnel Manager
 *
 * Creates a public HTTPS tunnel to the local webhook service using ngrok SDK.
 * Provides the public URL for Bitrix24 event.bind subscriptions.
 */

const config = require('../../config/config');
const logger = require('../utils/logger');

let _publicUrl = null;
let _listener  = null;

/**
 * Start the ngrok tunnel.
 * @param {number} port - Local port to tunnel (default: 3000)
 * @returns {Promise<string>} Public HTTPS URL
 */
async function startTunnel(port) {
  if (_publicUrl) {
    logger.info('[ngrok] Tunnel already running', { url: _publicUrl });
    return _publicUrl;
  }

  const authToken = config.ngrok.authToken;
  if (!authToken) {
    logger.warn('[ngrok] NGROK_AUTHTOKEN not set — tunnel will not be started. Events from Bitrix24 will not work.');
    return null;
  }

  try {
    const ngrok = require('@ngrok/ngrok');

    logger.info('[ngrok] Starting tunnel…', { port });

    _listener = await ngrok.forward({
      addr: port,
      authtoken: authToken,
      // Domain is available on paid plans; omit for free tier (random URL)
      ...(config.ngrok.domain ? { domain: config.ngrok.domain } : {}),
    });

    _publicUrl = _listener.url();

    logger.info('[ngrok] Tunnel established', { url: _publicUrl, port });
    return _publicUrl;
  } catch (err) {
    logger.error('[ngrok] Failed to start tunnel', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Get the current public URL (null if tunnel not running).
 * @returns {string|null}
 */
function getPublicUrl() {
  return _publicUrl;
}

/**
 * Stop the ngrok tunnel gracefully.
 */
async function stopTunnel() {
  if (!_listener) return;

  try {
    logger.info('[ngrok] Stopping tunnel…');
    await _listener.close();
    _listener  = null;
    _publicUrl = null;
    logger.info('[ngrok] Tunnel stopped');
  } catch (err) {
    logger.warn('[ngrok] Error stopping tunnel', { error: err.message });
  }
}

module.exports = {
  startTunnel,
  getPublicUrl,
  stopTunnel,
};
