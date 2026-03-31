// src/utils/logger.js
'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

// Ensure log directory exists
fs.mkdirSync(config.logging.dir, { recursive: true });

const { combine, timestamp, errors, json, colorize, printf, splat } = format;

// Human-readable format for development console
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
  })
);

// JSON format for production / file output
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

const logger = createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'flex-n-roll-webhook' },
  transports: [
    // Combined log (all levels)
    new transports.File({
      filename: path.join(config.logging.dir, 'combined.log'),
      format: prodFormat,
      maxsize: 20 * 1024 * 1024,   // 20 MB
      maxFiles: 14,
      tailable: true,
    }),
    // Error-only log
    new transports.File({
      filename: path.join(config.logging.dir, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
      tailable: true,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(config.logging.dir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(config.logging.dir, 'rejections.log') }),
  ],
});

// Add console transport based on environment
if (config.server.isProduction) {
  logger.add(new transports.Console({ format: prodFormat }));
} else {
  logger.add(new transports.Console({ format: devFormat }));
}

/**
 * Create a child logger scoped to a specific module / request.
 * @param {object} meta - Additional default metadata for all log entries.
 */
logger.child = (meta) => logger.child(meta);

module.exports = logger;