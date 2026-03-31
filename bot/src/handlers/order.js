/**
 * handlers/order.js
 * Обработка номера заказа: поиск в Битрикс24, отображение статуса,
 * привязка Telegram chat_id, фото пробной печати.
 */

'use strict';

const { Markup } = require('telegraf');
const bitrix = require('../services/bitrix');
const { buildStatusMessage, getStageInfo } = require('../utils/stageMapper');
const { buildStatusKeyboard } = require('../services/notify');
const logger = require('../services/logger');

// Номер заказа: цифры, или формат ФЛ-1234 / FL-1234 / FNR-1234
const ORDER_NUMBER_REGEX = /^(ФЛ|FL|FNR|FNRP)?[-–]?\d{1,10}$/i;

/**
 * Middleware: проверяет, является ли текст номером заказа.
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function orderMiddleware(ctx, next) {
  const text = ctx.message?.text?.trim();
  if (!text) return next();

  const isOrderNumber = ORDER_NUMBER_REGEX.test(text);
  const awaitingOrder = ctx.session?.awaitingOrderNumber;

  if (!isOrderNumber && !awaitingOrder) return next();

  if (ctx.session) ctx.session.awaitingOrderNumber = false;
  await handleOrderLookup(ctx, text);
}

/**
 * Основная логика поиска и отображения заказа.
 * @param {import('telegraf').Context} ctx
 * @param {string} orderNumber
 */
async function handleOrderLookup(ctx, orderNumber) {
  const chatId = ctx.from.id;
  const normalizedOrder = normalizeOrderNumber(orderNumber);

  const loadingMsg = await ctx.reply('🔍 Ищу ваш заказ...');

  let deal;
  try {
    deal = await bitrix.getDealByOrderNumber(normalizedOrder);
  } catch (err) {
    logger.error(`[Order] B24 error for order ${normalizedOrder}: ${err.message}`);
    await deleteMessage(ctx, loadingMsg);
    await ctx.replyWithMarkdown(
      `⚠️ Не удалось связаться с сервером. Попробуйте позже или обратитесь к менеджеру.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Попробовать снова', `retry_order_${normalizedOrder}`)],
      ])
    );
    return;
  }

  await deleteMessage(ctx, loadingMsg);

  if (!deal) {
    await ctx.replyWithMarkdown(
      `❌ *Заказ не найден*\n\n` +
        `Заказ с номером *${normalizedOrder}* не найден в системе.\n\n` +
        `Убедитесь, что номер введён верно. Если проблема сохраняется — обратитесь к менеджеру.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Ввести другой номер', 'action_check_order')],
        [Markup.button.callback('📞 Контакты', 'faq_contacts')],
      ])
    );
    return;
  }

  // ─── Проверка принадлежности заказа ───────────────────────────────────────
  const ownerChatId = deal[bitrix.TELEGRAM_CHATID_FIELD];

  if (ownerChatId && String(ownerChatId) !== String(chatId)) {
    logger.warn(`[Order] Chat ${chatId} tried to access deal #${deal.ID} owned by ${ownerChatId}`);
    await ctx.replyWithMarkdown(
      `⛔ *Доступ запрещён*\n\n` +
        `Этот заказ уже привязан к другому аккаунту.\n` +
        `Если вы уверены, что это ваш заказ — обратитесь к менеджеру.`,
      Markup.inlineKeyboard([[Markup.button.callback('📞 Контакты', 'faq_contacts')]])
    );
    return;
  }

  // ─── Привязка chat_id ──────────────────────────────────────────────────────
  if (!ownerChatId) {
    try {
      await bitrix.linkTelegramChatId(deal.ID, chatId);
      ctx.session = ctx.session || {};
      ctx.session.dealId = deal.ID;
      ctx.session.orderNumber = normalizedOrder;
      logger.info(`[Order] Linked chat ${chatId} to deal #${deal.ID}`);
    } catch (err) {
      logger.warn(`[Order] Failed to link chat_id for deal #${deal.ID}: ${err.message}`);
    }
  } else {
    ctx.session = ctx.session || {};
    ctx.session.dealId = deal.ID;
    ctx.session.orderNumber = normalizedOrder;
  }

  // ─── Отправка статуса ─────────────────────────────────────────────────────
  const statusText = buildStatusMessage(deal);
  await ctx.replyWithMarkdown(statusText, {
    reply_markup: buildStatusKeyboard(deal.STAGE_ID),
  });

  logger.info(`[Order] Status check: chat ${chatId}, order ${normalizedOrder}, stage ${deal.STAGE_ID}`);
}

/**
 * Callback «Проверить статус» из push-уведомления.
 */
async function handleCheckStatusCallback(ctx) {
  await ctx.answerCbQuery('Получаю актуальный статус...');
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(`ℹ️ Отправьте номер заказа, чтобы я мог показать статус.`);
    return;
  }

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await ctx.reply('⚠️ Не удалось получить статус. Попробуйте позже.');
    return;
  }

  const statusText = buildStatusMessage(deal);
  await ctx.replyWithMarkdown(statusText, {
    reply_markup: buildStatusKeyboard(deal.STAGE_ID),
  });
}

/**
 * Обработчик команды /status.
 */
async function handleStatusCommand(ctx) {
  const dealId = ctx.session?.dealId;

  if (dealId) {
    await handleOrderLookup(ctx, ctx.session.orderNumber || dealId);
  } else {
    ctx.session = ctx.session || {};
    ctx.session.awaitingOrderNumber = true;
    await ctx.replyWithMarkdown(
      `📦 Отправьте номер заказа для проверки статуса:`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'action_main_menu')]])
    );
  }
}

/**
 * Обработчик запроса фото пробной печати.
 */
async function handleProofPhotoRequest(ctx) {
  await ctx.answerCbQuery?.();
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Сначала введите номер заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  const loadingMsg = await ctx.reply('📷 Загружаю фото...');

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await deleteMessage(ctx, loadingMsg);
    await ctx.reply('⚠️ Не удалось загрузить данные заказа.');
    return;
  }

  await deleteMessage(ctx, loadingMsg);

  const photoUrl = bitrix.extractProofPhotoUrl(deal);
  if (!photoUrl) {
    await ctx.replyWithMarkdown(
      `📷 *Фото ещё недоступно*\n\n` +
        `Пробная печать для вашего заказа ещё не готова или не загружена.\n` +
        `Мы уведомим вас, когда фото появится.`
    );
    return;
  }

  try {
    await ctx.replyWithPhoto(photoUrl, {
      caption:
        `📷 *Фото пробной печати*\n` +
        `Заказ: ${ctx.session.orderNumber || dealId}\n\n` +
        `Если у вас есть замечания — свяжитесь с менеджером.`,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.error(`[Order] Failed to send proof photo: ${err.message}`);
    await ctx.replyWithMarkdown(
      `⚠️ Не удалось загрузить фото из системы.\n[Открыть фото по ссылке](${photoUrl})`
    );
  }
}

/**
 * Callback retry_order_<number>.
 */
async function handleRetryOrderCallback(ctx) {
  await ctx.answerCbQuery();
  const data = ctx.callbackQuery?.data || '';
  const orderNumber = data.replace('retry_order_', '');
  if (orderNumber) await handleOrderLookup(ctx, orderNumber);
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function normalizeOrderNumber(raw) {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

async function deleteMessage(ctx, msg) {
  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
  } catch (_) { /* ignore */ }
}

module.exports = {
  orderMiddleware,
  handleOrderLookup,
  handleCheckStatusCallback,
  handleStatusCommand,
  handleProofPhotoRequest,
  handleRetryOrderCallback,
};