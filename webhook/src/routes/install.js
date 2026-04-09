// src/routes/install.js
'use strict';

/**
 * OAuth Installation Routes
 *
 * GET  /install          — Redirect to Bitrix24 OAuth authorize page
 * GET  /install/callback — Handle OAuth callback, exchange code for tokens
 * GET  /install/status   — Check if OAuth tokens are installed
 */

const express = require('express');
const router  = express.Router();

const logger = require('../utils/logger');
const oauth  = require('../services/oauth');
const { bindAllEvents } = require('../services/eventBinder');
const config = require('../../config/config');

/**
 * GET /install
 * Redirects to Bitrix24 OAuth authorization page.
 * User must be a Bitrix24 admin to install the app.
 */
router.get('/', (_req, res) => {
  try {
    const authUrl = oauth.getAuthUrl();
    logger.info('[install] Redirecting to Bitrix24 OAuth', { url: authUrl });
    res.redirect(authUrl);
  } catch (err) {
    logger.error('[install] Failed to generate auth URL', { error: err.message });
    res.status(500).json({
      error:   'OAuth not configured',
      message: 'Set BITRIX_CLIENT_ID and BITRIX_PORTAL_DOMAIN in .env',
    });
  }
});

/**
 * GET /install/callback
 * Handles the OAuth callback from Bitrix24.
 * Exchanges the authorization code for access + refresh tokens.
 * Then binds all events to the current ngrok URL.
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokenData = await oauth.exchangeCode(code);

    logger.info('[install] App installed successfully', {
      domain: tokenData.domain,
    });

    // Automatically bind events after successful installation
    const publicUrl = config.appUrl;
    if (publicUrl) {
      try {
        await bindAllEvents(publicUrl);
      } catch (bindErr) {
        logger.warn('[install] Events bound partially', { error: bindErr.message });
      }
    }

    res.json({
      success: true,
      message: 'Приложение установлено! Токены сохранены в Redis.',
      domain:  tokenData.domain,
      events_bound: !!publicUrl,
      app_url: publicUrl || 'PUBLIC_APP_URL not set — events not bound',
    });
  } catch (err) {
    logger.error('[install] OAuth callback failed', { error: err.message });
    res.status(500).json({
      error:   'OAuth token exchange failed',
      message: err.message,
    });
  }
});

/**
 * GET /install/status
 * Returns the current OAuth installation status.
 */
router.get('/status', async (_req, res) => {
  try {
    const status    = await oauth.getStatus();
    const publicUrl = config.appUrl;

    res.json({
      oauth:     status,
      appUrl:    publicUrl || null,
      ready:     status.installed && !!publicUrl,
    });
  } catch (err) {
    logger.error('[install] Status check failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
