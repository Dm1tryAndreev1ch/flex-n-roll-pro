const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

fs.mkdirSync(path.join(process.cwd(), 'logs'), { recursive: true });

// Формат логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

// Инстанс логгера Winston
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Middleware для логирования входящих сообщений Telegraf
 */
function loggerMiddleware(ctx, next) {
  const start = Date.now();

  const userId = ctx.from?.id || 'unknown';
  const username = ctx.from?.username || 'unknown';
  const chatId = ctx.chat?.id || 'unknown';
  const messageType = ctx.updateType || 'unknown';
  const text = ctx.message?.text || ctx.callbackQuery?.data || '';

  logger.info(`Входящее сообщение`, {
    userId,
    username,
    chatId,
    messageType,
    text: text.substring(0, 100), // обрезаем для безопасности
  });

  return next().then(() => {
    const duration = Date.now() - start;
    logger.debug(`Обработка завершена за ${duration}ms`, { userId, chatId });
  }).catch((err) => {
    const duration = Date.now() - start;
    logger.error(`Ошибка обработки (${duration}ms): ${err.message}`, {
      userId,
      chatId,
      stack: err.stack,
    });
    throw err;
  });
}

module.exports = { logger, loggerMiddleware };
