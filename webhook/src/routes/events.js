// src/routes/events.js
'use strict';

/**
 * Event Gateway Routes
 *
 * Receives Bitrix24 events via ngrok and forwards them
 * to the appropriate internal microservice over Docker network.
 *
 * POST /events/deals → fnr-marking:3000/webhook/b24
 * POST /events/calls → fnr-commanalysis:3000/api/webhook/bitrix
 */

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const logger = require('../utils/logger');
const config = require('../../config/config');

// Internal service URLs (Docker network)
const MARKING_URL      = 'http://fnr-marking:3000/webhook/b24';
const COMMANALYSIS_URL = 'http://fnr-commanalysis:3000/api/webhook/bitrix';

/**
 * POST /events/deals
 * Forward deal-related events to the marking service.
 * Events: ONCRMDEALUPDATE
 */
router.post('/deals', async (req, res) => {
  // Respond immediately to Bitrix24
  res.status(200).send('ok');

  const body  = req.body || {};
  const event = (body.event || body.EVENT || '').toUpperCase();

  logger.info('[gateway] Deal event received', { event });

  // Forward to marking service
  try {
    await axios.post(MARKING_URL, body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info('[gateway] Deal event forwarded to marking', { event });
  } catch (err) {
    logger.error('[gateway] Failed to forward deal event to marking', {
      error:  err.message,
      status: err.response?.status,
    });
  }
});

/**
 * POST /events/calls
 * Forward telephony events to the commanalysis service.
 * Events: ONVOXIMPLANTCALLEND
 */
router.post('/calls', async (req, res) => {
  // Respond immediately to Bitrix24
  res.status(200).send('ok');

  const body  = req.body || {};
  const event = (body.event || body.EVENT || '').toUpperCase();

  logger.info('[gateway] Call event received', { event });

  // Forward to commanalysis service
  try {
    await axios.post(COMMANALYSIS_URL, body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info('[gateway] Call event forwarded to commanalysis', { event });
  } catch (err) {
    logger.error('[gateway] Failed to forward call event to commanalysis', {
      error:  err.message,
      status: err.response?.status,
    });
  }
});

module.exports = router;
