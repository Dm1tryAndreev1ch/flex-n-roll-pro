/**
 * handlers/start.js
 * Обработчик команд /start и /help.
 */

'use strict';

const { Markup } = require('telegraf');

/**
 * Главное меню с inline-кнопками.
 */
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Статус заказа', 'action_check_order')],
    [Markup.button.callback('📷 Фото пробной печати', 'get_proof_photo')],
    [Markup.button.callback('⭐ Оставить отзыв (NPS)', 'action_nps')],
    [Markup.button.callback('❓ FAQ', 'faq_main')],
  ]);
}

/**
 * Обработчик /start.
 */
async function handleStart(ctx) {
  const name = ctx.from.first_name || 'клиент';
  await ctx.replyWithMarkdown(
    `👋 Добро пожаловать, *${name}*!\n\n` +
      `Я бот типографии *FLEX\\-N\\-ROLL PRO*.\n` +
      `Помогу узнать статус заказа, прислать фото пробной печати и ответить на вопросы.\n\n` +
      `*Что я умею:*\n` +
      `• Показывать статус заказа по его номеру\n` +
      `• Присылать push-уведомления при смене статуса\n` +
      `• Отправлять фото пробной печати\n` +
      `• Отвечать на часто задаваемые вопросы\n\n` +
      `Выберите действие ниже или просто отправьте номер заказа:`,
    mainMenuKeyboard()
  );
}

/**
 * Обработчик /help.
 */
async function handleHelp(ctx) {
  await ctx.replyWithMarkdown(
    `*Справка по командам:*\n\n` +
      `/start — Главное меню\n` +
      `/status — Проверить статус заказа\n` +
      `/proof — Запросить фото пробной печати\n` +
      `/nps — Оставить отзыв о заказе\n` +
      `/faq — Часто задаваемые вопросы\n` +
      `/help — Эта справка\n\n` +
      `Или просто отправьте *номер заказа* (например: \`12345\`), и я покажу его статус.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Callback: вернуться в главное меню.
 */
async function handleMainMenuCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(`🏠 *Главное меню*\n\nВыберите действие:`, mainMenuKeyboard());
}

/**
 * Callback: инициировать проверку заказа.
 */
async function handleCheckOrderCallback(ctx) {
  await ctx.answerCbQuery();
  ctx.session = ctx.session || {};
  ctx.session.awaitingOrderNumber = true;
  await ctx.replyWithMarkdown(
    `📦 *Проверка статуса заказа*\n\n` +
      `Отправьте номер вашего заказа (только цифры или формат «ФЛ-ХХХХ»):`,
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'action_main_menu')]])
  );
}

module.exports = {
  handleStart,
  handleHelp,
  handleMainMenuCallback,
  handleCheckOrderCallback,
  mainMenuKeyboard,
};