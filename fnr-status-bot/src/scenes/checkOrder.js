const { Scenes } = require('telegraf');
const { findDeal, BitrixUnavailableError } = require('../services/bitrix');
const {
  formatOrderCard,
  formatOrderNotFound,
  formatVerificationFailed,
  formatServiceUnavailable,
} = require('../services/formatter');
const { orderActionsKeyboard, cancelKeyboard } = require('../utils/keyboards');
const { logger } = require('../middleware/logger');

// Регулярное выражение для валидации номера заказа
const ORDER_NUMBER_REGEX = /^[А-Яа-яA-Za-z0-9\-]{4,20}$/;

// Регулярное выражение для email
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Регулярное выражение для телефона
const PHONE_REGEX = /^[\d\+\(\)\-\s]{7,20}$/;

/**
 * WizardScene проверки заказа (3 шага)
 */
const checkOrderScene = new Scenes.WizardScene(
  'check-order',

  // ═══ Шаг 1: Запрос номера заказа ═══
  async (ctx) => {
    logger.info(`Пользователь ${ctx.from.id} начал проверку заказа`);

    await ctx.reply(
      '🔍 *Проверка статуса заказа*\n\n' +
      'Введите номер вашего заказа\n' +
      '\\(например: *ФНР\\-2024\\-1234*\\)',
      {
        parse_mode: 'MarkdownV2',
        ...cancelKeyboard(),
      }
    );

    return ctx.wizard.next();
  },

  // ═══ Шаг 2: Валидация номера, запрос контактных данных ═══
  async (ctx) => {
    // Обработка нажатия кнопки отмены
    if (ctx.callbackQuery?.data === 'cancel') {
      await ctx.answerCbQuery('Отменено');
      await ctx.reply('❌ Проверка отменена. Вы в главном меню.');
      return ctx.scene.leave();
    }

    const orderNumber = ctx.message?.text?.trim();

    if (!orderNumber) {
      await ctx.reply('⚠️ Пожалуйста, введите номер заказа текстом.');
      return; // остаёмся на этом шаге
    }

    if (!ORDER_NUMBER_REGEX.test(orderNumber)) {
      await ctx.reply(
        '⚠️ Неверный формат номера заказа\\.\n\n' +
        'Номер должен содержать от 4 до 20 символов \\(буквы, цифры, дефисы\\)\\.\n' +
        'Пример: *ФНР\\-2024\\-1234*\n\n' +
        'Попробуйте ещё раз:',
        { parse_mode: 'MarkdownV2' }
      );
      return; // остаёмся на этом шаге
    }

    // Сохраняем номер заказа в состоянии сессии
    ctx.wizard.state.orderNumber = orderNumber;

    logger.info(`Номер заказа принят: ${orderNumber}`, { userId: ctx.from.id });

    await ctx.reply(
      '👤 *Верификация*\n\n' +
      'Для подтверждения введите *email* или *телефон*,\n' +
      'указанный при оформлении заказа:',
      {
        parse_mode: 'MarkdownV2',
        ...cancelKeyboard(),
      }
    );

    return ctx.wizard.next();
  },

  // ═══ Шаг 3: Поиск в Битрикс24 и вывод статуса ═══
  async (ctx) => {
    // Обработка нажатия кнопки отмены
    if (ctx.callbackQuery?.data === 'cancel') {
      await ctx.answerCbQuery('Отменено');
      await ctx.reply('❌ Проверка отменена. Вы в главном меню.');
      return ctx.scene.leave();
    }

    const contact = ctx.message?.text?.trim();

    if (!contact) {
      await ctx.reply('⚠️ Пожалуйста, введите email или телефон текстом.');
      return; // остаёмся на этом шаге
    }

    // Валидация контакта
    if (!EMAIL_REGEX.test(contact) && !PHONE_REGEX.test(contact)) {
      await ctx.reply(
        '⚠️ Введите корректный *email* или *номер телефона*\\.\n\n' +
        'Примеры:\n' +
        '• email: client@example\\.com\n' +
        '• телефон: \\+7 \\(999\\) 123\\-45\\-67',
        { parse_mode: 'MarkdownV2' }
      );
      return; // остаёмся на этом шаге
    }

    const { orderNumber } = ctx.wizard.state;

    // Показываем индикатор загрузки
    const loadingMsg = await ctx.reply('⏳ Ищем ваш заказ, подождите...');

    try {
      const deal = await findDeal(orderNumber, contact);

      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMsg.message_id).catch(() => {});

      if (!deal.found) {
        if (deal.reason === 'verification_failed') {
          await ctx.reply(
            formatVerificationFailed(orderNumber),
            {
              parse_mode: 'MarkdownV2',
              ...orderActionsKeyboard(),
            }
          );
        } else {
          await ctx.reply(
            formatOrderNotFound(orderNumber),
            {
              parse_mode: 'MarkdownV2',
              ...orderActionsKeyboard(),
            }
          );
        }
      } else {
        // Успешно нашли заказ — выводим карточку
        logger.info(`Заказ найден: ${orderNumber}, стадия: ${deal.status}`, {
          userId: ctx.from.id,
          dealId: deal.dealId,
        });

        await ctx.reply(
          formatOrderCard(deal),
          {
            parse_mode: 'MarkdownV2',
            ...orderActionsKeyboard(),
          }
        );
      }
    } catch (error) {
      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMsg.message_id).catch(() => {});

      if (error instanceof BitrixUnavailableError) {
        await ctx.reply(
          formatServiceUnavailable(),
          {
            parse_mode: 'MarkdownV2',
            ...orderActionsKeyboard(),
          }
        );
      } else {
        logger.error(`Непредвиденная ошибка: ${error.message}`, {
          userId: ctx.from.id,
          orderNumber,
          stack: error.stack,
        });

        await ctx.reply(
          '⚠️ Произошла непредвиденная ошибка\\. Пожалуйста, попробуйте позже\\.',
          {
            parse_mode: 'MarkdownV2',
            ...orderActionsKeyboard(),
          }
        );
      }
    }

    return ctx.scene.leave();
  }
);

// Обработка кнопки отмены на любом шаге
checkOrderScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery('Отменено');
  await ctx.reply('❌ Проверка отменена. Вы в главном меню.');
  return ctx.scene.leave();
});

module.exports = checkOrderScene;
