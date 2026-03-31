/**
 * logger.js
 * Центральный логгер на базе winston.
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_LEVEL =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production' || process.stdout.isTTY) {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
} else {
  logger.add(new transports.Console({ format: format.json() }));
}

module.exports = logger;