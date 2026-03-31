/**
 * handlers/nps.js
 * NPS-опрос: оценка 1–10, открытый вопрос при оценке < 7,
 * сохранение в полях сделки Битрикс24.
 */

'use strict';

const { Markup } = require('telegraf');
const bitrix = require('../services/bitrix');
const { buildNpsKeyboard } = require('../services/notify');
const logger = require('../services/logger');

const NPS_LOW_SCORE_THRESHOLD = 7;

/**
 * Обработчик команды /nps.
 */
async function handleNpsCommand(ctx) {
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Для прохождения опроса сначала введите номер вашего заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  let deal;
  try {
    deal = await bitrix.getDealById(dealId);
  } catch (err) {
    await ctx.reply('⚠️ Не удалось загрузить данные заказа. Попробуйте позже.');
    return;
  }

  const existingScore = deal[bitrix.NPS_SCORE_FIELD];
  if (existingScore) {
    await ctx.replyWithMarkdown(
      `✅ Вы уже оценили этот заказ на *${existingScore}* из 10.\nСпасибо за ваш отзыв!`
    );
    return;
  }

  await sendNpsSurvey(ctx, dealId);
}

/**
 * Отправить сообщение NPS-опроса.
 * @param {import('telegraf').Context} ctx
 * @param {string|number} dealId
 */
async function sendNpsSurvey(ctx, dealId) {
  await ctx.replyWithMarkdown(
    `⭐ *Оцените наш сервис*\n\n` +
      `Насколько вы готовы порекомендовать типографию *FLEX-N-ROLL PRO* своим коллегам?\n\n` +
      `*1* — точно не порекомендую\n` +
      `*10* — обязательно порекомендую\n\n` +
      `Выберите оценку:`,
    buildNpsKeyboard(dealId)
  );
}

/**
 * Callback nps_score_{dealId}_{score}.
 */
async function handleNpsScoreCallback(ctx) {
  await ctx.answerCbQuery('Спасибо за оценку!');

  const data = ctx.callbackQuery?.data || '';
  const match = data.match(/^nps_score_(\d+)_(\d+)$/);
  if (!match) return;

  const dealId = match[1];
  const score = parseInt(match[2], 10);

  try {
    await bitrix.saveNps(dealId, score);
    logger.info(`[NPS] Score ${score} saved for deal #${dealId} from chat ${ctx.from.id}`);
  } catch (err) {
    logger.error(`[NPS] Failed to save score for deal #${dealId}: ${err.message}`);
    await ctx.replyWithMarkdown(`⚠️ Не удалось сохранить оценку. Попробуйте позже.`);
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.npsScore = score;
  ctx.session.npsDealId = dealId;
  ctx.session.awaitingNpsComment = score < NPS_LOW_SCORE_THRESHOLD;

  if (score < NPS_LOW_SCORE_THRESHOLD) {
    await ctx.replyWithMarkdown(
      `😔 Жаль, что вы поставили *${score}* из 10.\n\n` +
        `Расскажите, пожалуйста, что именно вас не устроило? Ваш отзыв поможет нам стать лучше.\n\n` +
        `_(Напишите комментарий текстом или нажмите «Пропустить»)_`,
      Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Пропустить', `nps_skip_comment_${dealId}`)],
      ])
    );
  } else if (score >= 9) {
    await ctx.replyWithMarkdown(
      `🎉 Спасибо за высокую оценку — *${score}* из 10!\n\n` +
        `Будем рады, если вы порекомендуете нас коллегам!`,
      Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
    );
  } else {
    await ctx.replyWithMarkdown(
      `👍 Спасибо за оценку *${score}* из 10!\n\n` +
        `Если хотите поделиться пожеланиями — напишите нам.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💬 Написать менеджеру', 'faq_contacts')],
        [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
      ])
    );
  }
}

/**
 * Callback nps_skip_comment_{dealId}.
 */
async function handleNpsSkipCommentCallback(ctx) {
  await ctx.answerCbQuery();
  if (ctx.session) ctx.session.awaitingNpsComment = false;
  await ctx.replyWithMarkdown(
    `Хорошо! Ваша оценка сохранена.\nЕсли захотите дополнить — обращайтесь к менеджеру.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Middleware: перехватывает текстовый комментарий после низкой оценки.
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function npsCommentMiddleware(ctx, next) {
  if (!ctx.session?.awaitingNpsComment) return next();

  const comment = ctx.message?.text?.trim();
  if (!comment) return next();

  const dealId = ctx.session.npsDealId;
  const score = ctx.session.npsScore;
  ctx.session.awaitingNpsComment = false;

  if (!dealId) return next();

  try {
    await bitrix.saveNps(dealId, score, comment);
    logger.info(`[NPS] Comment saved for deal #${dealId}`);
  } catch (err) {
    logger.error(`[NPS] Failed to save comment for deal #${dealId}: ${err.message}`);
    await ctx.reply('⚠️ Не удалось сохранить комментарий. Попробуйте позже.');
    return;
  }

  await ctx.replyWithMarkdown(
    `✅ *Спасибо за ваш отзыв!*\n\n` +
      `Мы обязательно учтём ваши пожелания и постараемся улучшить качество работы.`,
    Markup.inlineKeyboard([[Markup.button.callback('🏠 Главное меню', 'action_main_menu')]])
  );
}

/**
 * Callback action_nps из главного меню.
 */
async function handleNpsCallback(ctx) {
  await ctx.answerCbQuery();
  const dealId = ctx.session?.dealId;

  if (!dealId) {
    await ctx.replyWithMarkdown(
      `ℹ️ Сначала введите номер заказа.`,
      Markup.inlineKeyboard([[Markup.button.callback('📦 Ввести номер', 'action_check_order')]])
    );
    return;
  }

  await sendNpsSurvey(ctx, dealId);
}

module.exports = {
  handleNpsCommand,
  handleNpsCallback,
  handleNpsScoreCallback,
  handleNpsSkipCommentCallback,
  npsCommentMiddleware,
  sendNpsSurvey,
};