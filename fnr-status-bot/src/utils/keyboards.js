const { Markup } = require('telegraf');

/**
 * Главное меню — ReplyKeyboard
 */
function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📦 Проверить заказ'],
    ['👨‍💼 Связаться с менеджером', '❓ Помощь'],
  ]).resize();
}

/**
 * Действия после получения статуса заказа — InlineKeyboard
 */
function orderActionsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Проверить ещё', 'check_another')],
    [Markup.button.callback('👨‍💼 Связаться с менеджером', 'contact_manager')],
  ]);
}

/**
 * Кнопка отмены — InlineKeyboard
 */
function cancelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отмена', 'cancel')],
  ]);
}

module.exports = {
  mainMenuKeyboard,
  orderActionsKeyboard,
  cancelKeyboard,
};
