/**
 * bot.js
 * Главная точка входа: инициализация бота, middleware stack,
 * регистрация обработчиков, запуск Express-сервера.
 */

'use strict';

require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const express = require('express');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const logger = require('./services/logger');
const notifyService = require('./services/notify');
const bitrixWebhookRouter = require('./webhook/bitrixWebhook');

const { handleStart, handleHelp, handleMainMenuCallback, handleCheckOrderCallback, mainMenuKeyboard } = require('./handlers/start');
const { orderMiddleware, handleCheckStatusCallback, handleStatusCommand, handleProofPhotoRequest, handleRetryOrderCallback } = require('./handlers/order');
const { handleFaqCommand, handleFaqMainCallback, faqSectionHandler } = require('./handlers/faq');
const { handleNpsCommand, handleNpsCallback, handleNpsScoreCallback, handleNpsSkipCommentCallback, npsCommentMiddleware } = require('./handlers/nps');

// ─── Валидация конфигурации ───────────────────────────────────────────────────

function validateConfig() {
  const required = ['BOT_TOKEN', 'B24_BASE_URL', 'B24_WEBHOOK_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
validateConfig();

// ─── Telegraf Bot ─────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: { webhookReply: false },
});

notifyService.init(bot);

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_POINTS || '10', 10),
  duration: parseInt(process.env.RATE_WINDOW_SEC || '60', 10),
});

async function rateLimitMiddleware(ctx, next) {
  const key = ctx.from?.id;
  if (!key) return next();
  try {
    await rateLimiter.consume(key);
    return next();
  } catch {
    logger.warn(`[RateLimit] Chat ${key} exceeded rate limit`);
    await ctx.reply('⏳ Слишком много запросов. Подождите немного и попробуйте снова.');
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

// Сессия (in-memory; в production замените на telegraf-session-redis)
bot.use(
  session({
    defaultSession: () => ({
      dealId: null,
      orderNumber: null,
      awaitingOrderNumber: false,
      awaitingNpsComment: false,
      npsScore: null,
      npsDealId: null,
    }),
  })
);

// Rate limiting
bot.use(rateLimitMiddleware);

// Глобальная обработка ошибок
bot.catch((err, ctx) => {
  logger.error(`[Bot] Unhandled error for ${ctx.updateType}: ${err.message}`, { stack: err.stack });
  ctx.reply('⚠️ Внутренняя ошибка. Попробуйте позже или обратитесь к менеджеру.').catch(() => {});
});

// ─── Команды ─────────────────────────────────────────────────────────────────

bot.start(handleStart);
bot.help(handleHelp);
bot.command('status', handleStatusCommand);
bot.command('proof', handleProofPhotoRequest);
bot.command('nps', handleNpsCommand);
bot.command('faq', handleFaqCommand);

// ─── Callbacks ────────────────────────────────────────────────────────────────

bot.action('action_main_menu', handleMainMenuCallback);
bot.action('action_check_order', handleCheckOrderCallback);

bot.action('check_status', handleCheckStatusCallback);
bot.action('get_proof_photo', handleProofPhotoRequest);
bot.action(/^retry_order_(.+)$/, handleRetryOrderCallback);

bot.action('faq_main', handleFaqMainCallback);
bot.action('faq_min_quantity', faqSectionHandler('min_quantity'));
bot.action('faq_production_time', faqSectionHandler('production_time'));
bot.action('faq_materials', faqSectionHandler('materials'));
bot.action('faq_delivery', faqSectionHandler('delivery'));
bot.action('faq_contacts', faqSectionHandler('contacts'));

bot.action('action_nps', handleNpsCallback);
bot.action(/^nps_score_\d+_\d+$/, handleNpsScoreCallback);
bot.action(/^nps_skip_comment_\d+$/, handleNpsSkipCommentCallback);

// ─── Text middleware (порядок важен!) ─────────────────────────────────────────

bot.on('text', npsCommentMiddleware);    // 1. NPS комментарий
bot.on('text', orderMiddleware);         // 2. Номер заказа

// Fallback
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;
  await ctx.replyWithMarkdown(
    `🤔 Не понял ваше сообщение.\n\nОтправьте *номер заказа* или выберите действие:`,
    mainMenuKeyboard()
  );
});

// ─── Express сервер ───────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

const TELEGRAM_WEBHOOK_PATH = `/tg-webhook/${process.env.BOT_TOKEN}`;
app.use(TELEGRAM_WEBHOOK_PATH, bot.webhookCallback(TELEGRAM_WEBHOOK_PATH));

app.use('/webhook/bitrix', bitrixWebhookRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Запуск ───────────────────────────────────────────────────────────────────

async function start() {
  const server = app.listen(PORT, () => {
    logger.info(`[Server] Listening on port ${PORT}`);
  });

  const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

  if (BOT_WEBHOOK_URL) {
    // Production: webhook
    const webhookUrl = `${BOT_WEBHOOK_URL}${TELEGRAM_WEBHOOK_PATH}`;
    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      allowed_updates: ['message', 'callback_query'],
    });
    logger.info(`[Bot] Webhook set: ${webhookUrl}`);
  } else {
    // Development: long polling
    await bot.telegram.deleteWebhook();
    bot.launch();
    logger.info('[Bot] Long polling started (development mode)');
  }

  await bot.telegram.setMyCommands([
    { command: 'start',  description: 'Главное меню' },
    { command: 'status', description: 'Статус заказа' },
    { command: 'proof',  description: 'Фото пробной печати' },
    { command: 'nps',    description: 'Оценить наш сервис' },
    { command: 'faq',    description: 'Часто задаваемые вопросы' },
    { command: 'help',   description: 'Справка по командам' },
  ]);

  logger.info('[Bot] FLEX-N-ROLL PRO bot started successfully.');

  const shutdown = async (signal) => {
    logger.info(`[Bot] Received ${signal}. Shutting down...`);
    bot.stop(signal);
    server.close(() => {
      logger.info('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error(`[Bot] Fatal startup error: ${err.message}`, { stack: err.stack });
  process.exit(1);
});