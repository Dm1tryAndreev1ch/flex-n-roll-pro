// src/middleware/auth.js
'use strict';

const crypto = require('crypto');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Verify Bitrix24 webhook signature (HMAC-SHA256).
 *
 * Bitrix24 (or reverse proxy) signs payloads:
 *   signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET)
 * and sends the hex digest in the configured header (default: x-bitrix-signature).
 *
 * Requires `req.rawBody` populated by the bodyParser `verify` callback in server.js.
 */
function verifyWebhookSignature(req, res, next) {
  // In development mode, allow skipping signature verification
  if (!config.server.isProduction && process.env.SKIP_SIGNATURE_VERIFY === 'true') {
    logger.warn('[auth] Signature verification SKIPPED (development mode)');
    return next();
  }

  const receivedSig = req.headers[config.webhook.signatureHeader];

  if (!receivedSig) {
    logger.warn('[auth] Missing signature header', {
      header: config.webhook.signatureHeader,
      ip:     req.ip,
      path:   req.path,
    });
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error('[auth] rawBody not available — ensure bodyParser verify callback is configured');
    return res.status(500).json({ error: 'Internal server error' });
  }

  const expectedSig = crypto
    .createHmac('sha256', config.webhook.secret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  let valid = false;
  try {
    const receivedBuf = Buffer.from(receivedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    valid = receivedBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    valid = false;
  }

  if (!valid) {
    logger.warn('[auth] Invalid webhook signature', {
      ip:   req.ip,
      path: req.path,
      receivedSig: receivedSig.substring(0, 8) + '…',
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  logger.debug('[auth] Webhook signature verified');
  next();
}

module.exports = { verifyWebhookSignature };