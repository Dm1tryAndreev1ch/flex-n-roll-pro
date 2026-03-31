'use strict';

/**
 * logger.js — Winston logger для всего приложения
 */

const winston = require('winston');
const path    = require('path');
const config  = require('../../config');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Консоль с цветами
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),
    // Файл: все логи
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'app.log'),
      maxsize:  10 * 1024 * 1024,  // 10 MB rotate
      maxFiles: 5,
      tailable: true,
    }),
    // Файл: только ошибки
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'error.log'),
      level:    'error',
      maxsize:  5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;