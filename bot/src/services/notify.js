/**
 * notify.js
 * Сервис push-уведомлений: отправляет сообщения клиентам при смене стадии.
 *
 * Вызывается из bitrixWebhook.js при получении события OnCrmDealUpdate.
 */

'use strict';

const { buildStatusMessage, getStageInfo } = require('../utils/stageMapper');
const { TELEGRAM_CHATID_FIELD, getDealById, addTimelineComment } = require('./bitrix');
const logger = require('./logger');

let _bot = null;

/**
 * Инициализировать сервис экземпляром Telegraf.
 * @param {import('telegraf').Telegraf} botInstance
 */
function init(botInstance) {
  _bot = botInstance;
  logger.info('[Notify] Push notification service initialized.');
}

/**
 * Отправить уведомление об изменении стадии сделки.
 * @param {string|number} dealId
 * @param {string|null} oldStageId
 * @param {string} newStageId
 */
async function notifyStageChange(dealId, oldStageId, newStageId) {
  if (!_bot) {
    logger.warn('[Notify] Bot not initialized, cannot send push notification.');
    return;
  }
  if (oldStageId === newStageId) return;

  let deal;
  try {
    deal = await getDealById(dealId);
  } catch (err) {
    logger.error(`[Notify] Failed to fetch deal #${dealId}: ${err.message}`);
    return;
  }

  const chatId = deal[TELEGRAM_CHATID_FIELD];
  if (!chatId) {
    logger.debug(`[Notify] Deal #${dealId} has no Telegram chat_id, skipping push.`);
    return;
  }

  const { label } = getStageInfo(newStageId);
  const statusText = buildStatusMessage(deal);

  const messageText =
    `🔔 *Статус вашего заказа изменён*\n\n` +
    statusText +
    `\n\n_Если у вас есть вопросы — нажмите /help_`;

  try {
    await _bot.telegram.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: buildStatusKeyboard(newStageId),
    });

    logger.info(`[Notify] Push sent to chat ${chatId} for deal #${dealId}: ${label}`);

    await addTimelineComment(
      dealId,
      `🤖 Бот отправил push-уведомление клиенту (chat_id: ${chatId})\nНовый статус: ${label}`
    ).catch((e) => logger.warn(`[Notify] Timeline comment failed: ${e.message}`));

    // При завершении/отгрузке — запустить NPS-опрос через 2 часа
    if (newStageId === 'WON' || isShippedStage(newStageId)) {
      await scheduleNpsSurvey(chatId, dealId);
    }
  } catch (err) {
    logger.error(`[Notify] Failed to send push to chat ${chatId}: ${err.message}`);
  }
}

/**
 * Запланировать NPS-опрос через 2 часа.
 * В production замените setTimeout на очередь задач (Bull/BullMQ).
 * @param {string|number} chatId
 * @param {string|number} dealId
 */
async function scheduleNpsSurvey(chatId, dealId) {
  const DELAY_MS = 2 * 60 * 60 * 1000;
  logger.info(`[Notify] NPS survey scheduled for chat ${chatId} in 2h`);

  setTimeout(async () => {
    try {
      if (!_bot) return;
      await _bot.telegram.sendMessage(
        chatId,
        `⭐ *Оцените ваш заказ*\n\n` +
          `Ваш заказ выполнен! Нам важно ваше мнение.\n` +
          `Пожалуйста, оцените качество работы по шкале от 1 до 10.`,
        {
          parse_mode: 'Markdown',
          reply_markup: buildNpsKeyboard(dealId),
        }
      );
      logger.info(`[Notify] NPS survey sent to chat ${chatId}`);
    } catch (err) {
      logger.error(`[Notify] Failed to send NPS survey to ${chatId}: ${err.message}`);
    }
  }, DELAY_MS);
}

/**
 * Отправить произвольное сообщение.
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [extra]
 */
async function sendMessage(chatId, text, extra = {}) {
  if (!_bot) {
    logger.warn('[Notify] Bot not initialized.');
    return;
  }
  try {
    await _bot.telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    logger.error(`[Notify] sendMessage to ${chatId} failed: ${err.message}`);
    throw err;
  }
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function isShippedStage(stageId) {
  return stageId === process.env.B24_STAGE_SHIPPED || stageId === 'WON';
}

/**
 * Inline-клавиатура под уведомлением о статусе.
 * @param {string} stageId
 * @returns {object}
 */
function buildStatusKeyboard(stageId) {
  const buttons = [[{ text: '📊 Проверить статус', callback_data: 'check_status' }]];

  const printStages = [
    process.env.B24_STAGE_PRINT1,
    process.env.B24_STAGE_PRINT2,
    process.env.B24_STAGE_QC,
  ].filter(Boolean);

  if (printStages.includes(stageId)) {
    buttons[0].push({ text: '📷 Фото пробной печати', callback_data: 'get_proof_photo' });
  }

  buttons.push([{ text: '❓ FAQ', callback_data: 'faq_main' }]);
  return { inline_keyboard: buttons };
}

/**
 * Inline-клавиатура NPS (оценки 1–10).
 * @param {string|number} dealId
 * @returns {object}
 */
function buildNpsKeyboard(dealId) {
  const row1 = [1, 2, 3, 4, 5].map((n) => ({
    text: String(n),
    callback_data: `nps_score_${dealId}_${n}`,
  }));
  const row2 = [6, 7, 8, 9, 10].map((n) => ({
    text: String(n),
    callback_data: `nps_score_${dealId}_${n}`,
  }));
  return { inline_keyboard: [row1, row2] };
}

module.exports = {
  init,
  notifyStageChange,
  scheduleNpsSurvey,
  sendMessage,
  buildNpsKeyboard,
  buildStatusKeyboard,
};