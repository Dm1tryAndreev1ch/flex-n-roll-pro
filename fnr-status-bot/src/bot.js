const { Telegraf, Scenes, session } = require('telegraf');
const config = require('../config/config');
const { logger, loggerMiddleware } = require('./middleware/logger');
const { mainMenuKeyboard } = require('./utils/keyboards');
const { escapeMarkdown } = require('./services/formatter');
const checkOrderScene = require('./scenes/checkOrder');

// ═══════════════════════════════════════════
//  Инициализация бота
// ═══════════════════════════════════════════

const bot = new Telegraf(config.bot.token);

// Stage — менеджер сцен
const stage = new Scenes.Stage([checkOrderScene]);

// Middleware
bot.use(session());              // Сессии (Map-based по умолчанию)
bot.use(loggerMiddleware);       // Логирование всех взаимодействий
bot.use(stage.middleware());     // Сцены

// ═══════════════════════════════════════════
//  Команда /start
// ═══════════════════════════════════════════

bot.start(async (ctx) => {
  const userName = ctx.from.first_name || 'клиент';

  await ctx.reply(
    `👋 Здравствуйте, ${escapeMarkdown(userName)}\\!\n\n` +
    `Я — бот типографии *FLEX\\-N\\-ROLL PRO*\\.\n` +
    `Помогу вам узнать статус вашего заказа\\.\n\n` +
    `Выберите действие из меню ниже: 👇`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Команда /help
// ═══════════════════════════════════════════

bot.help(async (ctx) => {
  await ctx.reply(
    `❓ *Помощь*\n\n` +
    `Доступные команды:\n\n` +
    `/start — Главное меню\n` +
    `/status — Проверить статус заказа\n` +
    `/contact — Связаться с менеджером\n` +
    `/help — Показать эту справку\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Как проверить заказ:*\n` +
    `1\\. Нажмите «📦 Проверить заказ»\n` +
    `2\\. Введите номер заказа\n` +
    `3\\. Подтвердите email или телефон\n` +
    `4\\. Получите актуальный статус\\!`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Команда /status — быстрый вход в сцену
// ═══════════════════════════════════════════

bot.command('status', async (ctx) => {
  await ctx.scene.enter('check-order');
});

// ═══════════════════════════════════════════
//  Команда /contact
// ═══════════════════════════════════════════

bot.command('contact', async (ctx) => {
  await ctx.reply(
    `👨‍💼 *Контакты менеджера*\n\n` +
    `Telegram: ${escapeMarkdown(config.manager.contact)}\n` +
    `Телефон: ${escapeMarkdown(config.manager.phone)}\n\n` +
    `Мы работаем: *Пн\\-Пт 9:00 — 18:00* \\(МСК\\)`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Обработка кнопок главного меню (ReplyKeyboard)
// ═══════════════════════════════════════════

bot.hears('📦 Проверить заказ', async (ctx) => {
  await ctx.scene.enter('check-order');
});

bot.hears('👨‍💼 Связаться с менеджером', async (ctx) => {
  await ctx.reply(
    `👨‍💼 *Контакты менеджера*\n\n` +
    `Telegram: ${escapeMarkdown(config.manager.contact)}\n` +
    `Телефон: ${escapeMarkdown(config.manager.phone)}\n\n` +
    `Мы работаем: *Пн\\-Пт 9:00 — 18:00* \\(МСК\\)`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

bot.hears('❓ Помощь', async (ctx) => {
  await ctx.reply(
    `❓ *Помощь*\n\n` +
    `Я помогу узнать статус вашего заказа в типографии FLEX\\-N\\-ROLL PRO\\.\n\n` +
    `Нажмите «📦 Проверить заказ» и следуйте инструкциям\\.\n\n` +
    `Команды: /start \\| /status \\| /contact \\| /help`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Обработка inline-кнопок (из карточки заказа)
// ═══════════════════════════════════════════

bot.action('check_another', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('check-order');
});

bot.action('contact_manager', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `👨‍💼 *Контакты менеджера*\n\n` +
    `Telegram: ${escapeMarkdown(config.manager.contact)}\n` +
    `Телефон: ${escapeMarkdown(config.manager.phone)}\n\n` +
    `Мы работаем: *Пн\\-Пт 9:00 — 18:00* \\(МСК\\)`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Обработка неизвестных сообщений
// ═══════════════════════════════════════════

bot.on('message', async (ctx) => {
  await ctx.reply(
    `🤔 Не понимаю эту команду\\.\n\n` +
    `Используйте меню ниже или введите /help для справки\\.`,
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard(),
    }
  );
});

// ═══════════════════════════════════════════
//  Глобальная обработка ошибок
// ═══════════════════════════════════════════

bot.catch((err, ctx) => {
  logger.error(`Глобальная ошибка бота: ${err.message}`, {
    userId: ctx.from?.id,
    updateType: ctx.updateType,
    stack: err.stack,
  });

  // Don't try to reply if bot is blocked by user (403) or chat not found (400)
  const errCode = err?.response?.error_code || err?.code;
  if (errCode === 403 || errCode === 400) {
    logger.warn(`Бот заблокирован пользователем или чат не найден, пропуск ответа`, {
      userId: ctx.from?.id,
      errorCode: errCode,
    });
    return;
  }

  ctx.reply('⚠️ Произошла ошибка. Попробуйте позже или свяжитесь с менеджером.')
    .catch(() => {});
});

// ═══════════════════════════════════════════
//  Запуск бота
// ═══════════════════════════════════════════

async function startBot() {
  try {
    logger.info('🚀 Запуск бота FLEX-N-ROLL Status Bot...');

    // Graceful shutdown
    process.once('SIGINT', async () => { await bot.stop('SIGINT'); process.exit(0); });
    process.once('SIGTERM', async () => { await bot.stop('SIGTERM'); process.exit(0); });

    await bot.launch();

    logger.info('✅ Бот успешно запущен и ожидает сообщения');
    logger.info(`📋 Уровень логирования: ${config.logging.level}`);
  } catch (error) {
    logger.error(`❌ Не удалось запустить бота: ${error.message}`, {
      stack: error.stack,
    });
    process.exit(1);
  }
}

startBot();

module.exports = bot;
