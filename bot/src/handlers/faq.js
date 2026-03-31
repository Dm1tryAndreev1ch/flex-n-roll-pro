/**
 * handlers/faq.js
 * FAQ раздел с inline-кнопками.
 */

'use strict';

const { Markup } = require('telegraf');

const FAQ_ITEMS = {
  min_quantity: {
    title: '📦 Минимальный тираж',
    text:
      `📦 *Минимальный тираж*\n\n` +
      `Минимальный тираж для большинства видов продукции — *1 000 штук*.\n\n` +
      `*Исключения:*\n` +
      `• Пакеты с логотипом: от 500 шт.\n` +
      `• Этикетки: от 1 000 шт.\n` +
      `• Ролл-апы и баннеры: от 1 шт.\n` +
      `• Наклейки фигурные: от 500 шт.\n\n` +
      `При тираже свыше 10 000 шт. действует *скидка от 15%*.`,
  },

  production_time: {
    title: '⏱️ Сроки производства',
    text:
      `⏱️ *Сроки производства*\n\n` +
      `Стандартные сроки — *5–14 рабочих дней* с момента согласования макета и оплаты.\n\n` +
      `*По видам продукции:*\n` +
      `• Визитки, листовки: 3–5 р.дн.\n` +
      `• Этикетки, стикеры: 5–7 р.дн.\n` +
      `• Пакеты, упаковка: 7–14 р.дн.\n` +
      `• Брендированная одежда: 10–14 р.дн.\n\n` +
      `*Срочное производство* (+50% к стоимости): 1–3 р.дн. при наличии мощностей.`,
  },

  materials: {
    title: '🔬 Материалы',
    text:
      `🔬 *Материалы*\n\n` +
      `*Бумага и картон:*\n` +
      `• Мелованная матовая / глянцевая (80–400 г/м²)\n` +
      `• Офсетная (60–160 г/м²)\n` +
      `• Крафт-бумага, дизайнерские виды\n\n` +
      `*Плёнки и самоклейка:*\n` +
      `• BOPP глянец/мат/soft touch\n` +
      `• Полипропиленовые и ПЭТ-плёнки\n` +
      `• Прозрачный и белый vinyl\n\n` +
      `*Ткани:*\n` +
      `• Хлопок 100%, Cotton/PE\n` +
      `• Полиэстер, флаговая ткань\n` +
      `• Брезент, сетка для наружной рекламы\n\n` +
      `По запросу — работа с давальческим сырьём.`,
  },

  delivery: {
    title: '🚚 Доставка',
    text:
      `🚚 *Доставка*\n\n` +
      `*Самовывоз:* бесплатно. Пн–Пт 9:00–18:00.\n\n` +
      `*По городу:* курьером от 500 ₽, день в день или следующий р.день.\n\n` +
      `*По России:* СДЭК, Деловые Линии, ПЭК, Почта России.\n` +
      `Стоимость по тарифам перевозчика.\n\n` +
      `*В СНГ:* по запросу (СДЭК / EMS).\n\n` +
      `Тяжёлые заказы (>30 кг) — транспортные компании, уточните у менеджера.`,
  },

  contacts: {
    title: '📞 Контакты менеджера',
    text:
      `📞 *Контакты*\n\n` +
      `*Менеджер по заказам:*\n` +
      `Telegram: @flex_manager\n` +
      `WhatsApp: +7 (XXX) XXX-XX-XX\n` +
      `E-mail: orders@flex-n-roll.pro\n\n` +
      `*Режим работы:*\n` +
      `Пн–Пт: 9:00–18:00 (МСК)\n` +
      `Сб: 10:00–14:00 (МСК)\n` +
      `Вс: выходной\n\n` +
      `📧 Сотрудничество: partner@flex-n-roll.pro`,
  },
};

function faqMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Минимальный тираж', 'faq_min_quantity')],
    [Markup.button.callback('⏱️ Сроки производства', 'faq_production_time')],
    [Markup.button.callback('🔬 Материалы', 'faq_materials')],
    [Markup.button.callback('🚚 Доставка', 'faq_delivery')],
    [Markup.button.callback('📞 Контакты менеджера', 'faq_contacts')],
    [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
  ]);
}

function faqBackKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Назад в FAQ', 'faq_main')],
    [Markup.button.callback('🏠 Главное меню', 'action_main_menu')],
  ]);
}

async function handleFaqCommand(ctx) {
  await ctx.replyWithMarkdown(
    `❓ *Часто задаваемые вопросы*\n\nВыберите интересующий раздел:`,
    faqMainKeyboard()
  );
}

async function handleFaqMainCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `❓ *Часто задаваемые вопросы*\n\nВыберите интересующий раздел:`,
    faqMainKeyboard()
  );
}

/**
 * Фабрика обработчиков FAQ-разделов.
 * @param {string} section — ключ из FAQ_ITEMS
 */
function faqSectionHandler(section) {
  return async (ctx) => {
    await ctx.answerCbQuery();
    const item = FAQ_ITEMS[section];
    if (!item) {
      await ctx.reply('Раздел не найден.');
      return;
    }
    await ctx.replyWithMarkdown(item.text, faqBackKeyboard());
  };
}

module.exports = {
  handleFaqCommand,
  handleFaqMainCallback,
  faqSectionHandler,
  faqMainKeyboard,
  FAQ_ITEMS,
};