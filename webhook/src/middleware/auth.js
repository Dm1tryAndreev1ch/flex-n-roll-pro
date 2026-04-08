// src/middleware/auth.js
'use strict';

const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Verify incoming request is from our Bitrix24 portal.
 *
 * Bitrix24 outgoing webhooks send (url-encoded):
 *   auth[application_token]=<secret>   — unique token from the outgoing webhook settings
 *   auth[domain]=b24-xxx.bitrix24.ru   — portal domain
 *
 * Verification strategy:
 *   1. If BITRIX_OUTGOING_TOKEN is configured → verify auth.application_token (primary, secure)
 *   2. If BITRIX_PORTAL_DOMAIN is configured → verify auth.domain (secondary, less secure)
 *   3. If neither is configured → log warning and pass through (dev mode)
 */
function verifyBitrixRequest(req, res, next) {
  // Skip verification in dev mode if explicitly opted out
  if (!config.server.isProduction && process.env.SKIP_VERIFY === 'true') {
    logger.warn('[auth] Verification SKIPPED (dev mode)');
    return next();
  }

  const body = req.body || {};

  // Extract auth object — body-parser with extended:true parses
  // auth[application_token] → body.auth.application_token
  // auth[domain]            → body.auth.domain
  const auth = body.auth || body.AUTH || {};

  const applicationToken = auth.application_token || auth.APPLICATION_TOKEN || '';
  const domain           = auth.domain            || auth.DOMAIN            || '';

  logger.debug('[auth] Verifying request', {
    hasDomain: !!domain,
    hasToken:  !!applicationToken,
    ip:        req.ip,
  });

  // ── Strategy 1: Verify application_token (primary, secure) ──────────────
  if (config.bitrix.outgoingToken) {
    if (!applicationToken) {
      logger.warn('[auth] Missing application_token in request', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized: missing application_token' });
    }

    if (applicationToken !== config.bitrix.outgoingToken) {
      logger.warn('[auth] application_token mismatch', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized: invalid application_token' });
    }

    // Token verified — optionally warn if domain doesn't match
    if (config.bitrix.portalDomain && domain && domain !== config.bitrix.portalDomain) {
      logger.warn('[auth] Domain mismatch (token OK, proceeding)', {
        received: domain,
        expected: config.bitrix.portalDomain,
      });
    }

    logger.debug('[auth] Request verified via application_token', { domain });
    return next();
  }

  // ── Strategy 2: Verify domain only (fallback, less secure) ──────────────
  if (config.bitrix.portalDomain) {
    if (!domain) {
      logger.warn('[auth] Missing auth.domain in request body', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized: missing auth domain' });
    }

    if (domain !== config.bitrix.portalDomain) {
      logger.warn('[auth] Domain mismatch', {
        received: domain,
        expected: config.bitrix.portalDomain,
        ip:       req.ip,
      });
      return res.status(401).json({ error: 'Unauthorized: domain mismatch' });
    }

    logger.debug('[auth] Request verified via domain', { domain });
    return next();
  }

  // ── No verification configured ──────────────────────────────────────────
  logger.warn('[auth] No BITRIX_OUTGOING_TOKEN or BITRIX_PORTAL_DOMAIN configured — skipping verification', {
    ip: req.ip,
  });
  next();
}

module.exports = { verifyBitrixRequest };
