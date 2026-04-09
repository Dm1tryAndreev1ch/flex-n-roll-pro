// src/services/oauth.js
'use strict';

/**
 * Bitrix24 OAuth Token Manager
 *
 * Manages OAuth access_token and refresh_token for a local Bitrix24 application.
 * Tokens are stored in Redis for persistence across restarts.
 *
 * Flow:
 *   1. User visits /install → redirected to Bitrix24 OAuth authorize URL
 *   2. Bitrix24 redirects back to /install/callback?code=xxx
 *   3. exchangeCode(code) → stores access_token + refresh_token in Redis
 *   4. getAccessToken() auto-refreshes when token nears expiry
 */

const axios  = require('axios');
const config = require('../../config/config');
const logger = require('../utils/logger');

const REDIS_KEY   = 'fnr:oauth:tokens';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

let _redisClient = null;

/**
 * Initialize Redis client for token storage.
 */
async function _getRedis() {
  if (_redisClient) return _redisClient;

  try {
    const { createClient } = require('redis');
    _redisClient = createClient({ url: config.redis.url });

    _redisClient.on('error', (err) => {
      logger.error('[oauth] Redis error', { error: err.message });
    });

    await _redisClient.connect();
    logger.info('[oauth] Connected to Redis for token storage');
    return _redisClient;
  } catch (err) {
    logger.error('[oauth] Failed to connect to Redis', { error: err.message });
    throw err;
  }
}

/**
 * Build the Bitrix24 OAuth authorize URL for app installation.
 * @returns {string}
 */
function getAuthUrl() {
  const domain = config.bitrix.portalDomain;
  const clientId = config.bitrix.clientId;

  if (!domain || !clientId) {
    throw new Error('BITRIX_PORTAL_DOMAIN and BITRIX_CLIENT_ID are required for OAuth');
  }

  return `https://${domain}/oauth/authorize/?client_id=${clientId}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called once during app installation.
 *
 * @param {string} code - Authorization code from Bitrix24 callback
 * @returns {Promise<object>} Token data
 */
async function exchangeCode(code) {
  const domain = config.bitrix.portalDomain;

  logger.info('[oauth] Exchanging authorization code for tokens');

  const response = await axios.get(`https://${domain}/oauth/token/`, {
    params: {
      grant_type:    'authorization_code',
      client_id:     config.bitrix.clientId,
      client_secret: config.bitrix.clientSecret,
      code,
    },
    timeout: 15000,
  });

  const tokenData = response.data;

  if (tokenData.error) {
    throw new Error(`OAuth error: ${tokenData.error} — ${tokenData.error_description}`);
  }

  await _storeTokens(tokenData);

  logger.info('[oauth] Tokens obtained successfully', {
    domain:    tokenData.domain,
    expiresIn: tokenData.expires_in,
  });

  return tokenData;
}

/**
 * Refresh the access token using the stored refresh token.
 * @returns {Promise<object>} New token data
 */
async function refreshTokens() {
  const stored = await _loadTokens();
  if (!stored || !stored.refresh_token) {
    throw new Error('No refresh_token stored — reinstall the app via /install');
  }

  logger.info('[oauth] Refreshing access token');

  const domain = config.bitrix.portalDomain;
  const response = await axios.get(`https://${domain}/oauth/token/`, {
    params: {
      grant_type:    'refresh_token',
      client_id:     config.bitrix.clientId,
      client_secret: config.bitrix.clientSecret,
      refresh_token: stored.refresh_token,
    },
    timeout: 15000,
  });

  const tokenData = response.data;

  if (tokenData.error) {
    throw new Error(`OAuth refresh error: ${tokenData.error} — ${tokenData.error_description}`);
  }

  await _storeTokens(tokenData);

  logger.info('[oauth] Token refreshed successfully', {
    expiresIn: tokenData.expires_in,
  });

  return tokenData;
}

/**
 * Get a valid access token, auto-refreshing if needed.
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  const stored = await _loadTokens();

  if (!stored) {
    throw new Error('OAuth not configured — install the app via /install');
  }

  // Check if token needs refresh (within 5 min of expiry)
  const now = Date.now();
  const expiresAt = stored.expires_at || 0;

  if (now >= expiresAt - REFRESH_MARGIN_MS) {
    logger.info('[oauth] Token expired or near expiry, refreshing…');
    const newTokens = await refreshTokens();
    return newTokens.access_token;
  }

  return stored.access_token;
}

/**
 * Get the stored portal domain from OAuth tokens.
 * @returns {Promise<string|null>}
 */
async function getPortalDomain() {
  const stored = await _loadTokens();
  return stored?.domain || config.bitrix.portalDomain || null;
}

/**
 * Check if OAuth tokens are installed and valid.
 * @returns {Promise<{installed: boolean, domain: string|null, expiresAt: number|null}>}
 */
async function getStatus() {
  try {
    const stored = await _loadTokens();
    if (!stored) {
      return { installed: false, domain: null, expiresAt: null };
    }

    return {
      installed:  true,
      domain:     stored.domain || null,
      expiresAt:  stored.expires_at || null,
      hasRefresh: !!stored.refresh_token,
    };
  } catch {
    return { installed: false, domain: null, expiresAt: null };
  }
}

// ─── Internal token storage ──────────────────────────────────────────────────

async function _storeTokens(tokenData) {
  const redis = await _getRedis();

  const toStore = {
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    domain:        tokenData.domain || config.bitrix.portalDomain,
    member_id:     tokenData.member_id || '',
    expires_in:    tokenData.expires_in || 3600,
    expires_at:    Date.now() + (tokenData.expires_in || 3600) * 1000,
    updated_at:    Date.now(),
  };

  await redis.set(REDIS_KEY, JSON.stringify(toStore));
}

async function _loadTokens() {
  try {
    const redis = await _getRedis();
    const raw = await redis.get(REDIS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error('[oauth] Failed to load tokens from Redis', { error: err.message });
    return null;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshTokens,
  getAccessToken,
  getPortalDomain,
  getStatus,
};
