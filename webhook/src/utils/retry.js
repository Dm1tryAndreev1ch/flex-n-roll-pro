// src/utils/retry.js
'use strict';

const logger = require('./logger');
const config = require('../../config/config');

/**
 * Exponential backoff with jitter.
 *
 * @param {number} attempt  - Current attempt index (0-based).
 * @param {number} baseMs   - Base delay in milliseconds.
 * @param {number} maxMs    - Maximum delay cap in milliseconds.
 * @returns {number} Delay in milliseconds.
 */
function calcDelay(attempt, baseMs, maxMs) {
  // Full jitter strategy: delay = random(0, min(cap, base * 2^attempt))
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exponential);
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 *
 * @param {Function} fn           - Async function to execute; receives the attempt number (1-based).
 * @param {object}   [opts]       - Override options.
 * @param {number}   [opts.maxAttempts]  - Max total attempts.
 * @param {number}   [opts.baseDelayMs] - Base backoff delay.
 * @param {number}   [opts.maxDelayMs]  - Max backoff delay.
 * @param {Function} [opts.shouldRetry] - Predicate(error) → bool; return false to abort early.
 * @param {string}   [opts.label]       - Label for log messages.
 * @returns {Promise<*>} Resolved value of fn.
 * @throws {Error} Last error after all retries exhausted.
 */
async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? config.retry.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? config.retry.baseDelayMs;
  const maxDelayMs  = opts.maxDelayMs  ?? config.retry.maxDelayMs;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  const label       = opts.label       ?? 'operation';

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      if (attempt > 1) {
        logger.info(`[retry] ${label} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (err) {
      lastError = err;

      const isRetryable = shouldRetry(err);
      const isLastAttempt = attempt === maxAttempts;

      if (!isRetryable || isLastAttempt) {
        logger.error(`[retry] ${label} failed permanently after ${attempt} attempt(s)`, {
          error: err.message,
          stack: err.stack,
          retryable: isRetryable,
        });
        throw err;
      }

      const delayMs = calcDelay(attempt - 1, baseDelayMs, maxDelayMs);
      logger.warn(`[retry] ${label} failed on attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms`, {
        error: err.message,
        attempt,
        delayMs,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Predicate: retry on network / 5xx errors, not on 4xx client errors.
 * Works with axios errors and standard fetch-style errors.
 */
function isTransientError(err) {
  if (err.code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'].includes(err.code)) {
    return true;
  }
  // Axios HTTP response
  if (err.response) {
    return err.response.status >= 500;
  }
  // Generic network errors (no response)
  if (err.isAxiosError && !err.response) {
    return true;
  }
  return false;
}

module.exports = { withRetry, isTransientError, sleep, calcDelay };