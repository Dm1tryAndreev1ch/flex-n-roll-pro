'use strict';

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const config = require('../config');
const logger = require('./utils/logger');
const markingRouter = require('./routes/marking');
const webhookRouter = require('./routes/webhook');
const reporter = require('./utils/reporter');

// ---------------------------------------------------------------------------
// Инициализация директорий хранилища
// ---------------------------------------------------------------------------
[config.storage.dataDir, config.storage.productionDir].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// Инициализация файла БД кодов, если отсутствует
if (!fs.existsSync(config.storage.codesDbPath)) {
  fs.writeFileSync(config.storage.codesDbPath, JSON.stringify({}), 'utf8');
}

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP-логирование через morgan → winston
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// ---------------------------------------------------------------------------
// Маршруты
// ---------------------------------------------------------------------------
app.use('/api/marking', markingRouter);
app.use('/webhook', webhookRouter);

// Статические файлы отчётов (HTML для клиентов)
app.use('/reports', express.static(path.join(config.storage.dataDir, 'reports')));

// Health-check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Глобальный обработчик ошибок
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ---------------------------------------------------------------------------
// Планировщик: ежемесячная сводка (1-е число в 08:00)
// ---------------------------------------------------------------------------
cron.schedule('0 8 1 * *', async () => {
  logger.info('[cron] Запуск ежемесячной сводки маркировки');
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // предыдущий месяц
    await reporter.generateMonthlySummary(year, month > 1 ? month - 1 : 12);
    logger.info('[cron] Ежемесячная сводка сформирована');
  } catch (e) {
    logger.error(`[cron] Ошибка генерации сводки: ${e.message}`);
  }
});

// ---------------------------------------------------------------------------
// Старт
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
  logger.info(
    `FLEX-N-ROLL Marking Service запущен на порту ${config.port} [${config.env}]`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM получен — завершение работы');
  server.close(() => process.exit(0));
  setTimeout(() => {
    logger.warn('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);
});
process.on('SIGINT', () => {
  logger.info('SIGINT получен — завершение работы');
  server.close(() => process.exit(0));
  setTimeout(() => {
    logger.warn('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);
});

module.exports = app; // для тестов