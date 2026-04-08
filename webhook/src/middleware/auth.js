// src/middleware/auth.js
'use strict';

const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Verify incoming request is from our Bitrix24 portal.
 * Bitrix24 outgoing webhooks send auth[application_token] or auth[domain] in the body.
 * We verify the domain matches our configured portal domain.
 */
function verifyBitrixRequest(req, res, next) {
  if (!config.server.isProduction && process.env.SKIP_VERIFY === 'true') {
    logger.warn('[auth] Verification SKIPPED (dev mode)');
    return next();
  }

  const body = req.body || {};
  const auth = body.auth || {};
  const domain = auth.domain || auth.DOMAIN || body['auth[domain]'];

  if (!domain) {
    logger.warn('[auth] Missing auth.domain in request body', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: missing auth domain' });
  }

  if (domain !== config.bitrix.portalDomain) {
    logger.warn('[auth] Domain mismatch', { received: domain, expected: config.bitrix.portalDomain, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: domain mismatch' });
  }

  logger.debug('[auth] Bitrix24 request verified', { domain });
  next();
}

module.exports = { verifyBitrixRequest };
