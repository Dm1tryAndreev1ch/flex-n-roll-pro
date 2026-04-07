const config = require('../../config/config');

/**
 * Маппинг стадий Битрикс24 → понятный текст + эмодзи
 */
const STAGE_MAP = {
  'NEW':         { emoji: '📋', text: 'Принят, ожидает обработки' },
  'PREPARATION': { emoji: '⚙️', text: 'Идёт подготовка макета' },
  'PRINTING':    { emoji: '🖨️', text: 'В производстве (печать)' },
  'FINISHING':   { emoji: '✂️', text: 'Постпечатная обработка' },
  'READY':       { emoji: '✅', text: 'Готов, ожидает отгрузки' },
  'DELIVERY':    { emoji: '🚚', text: 'Передан в доставку' },
  'WON':         { emoji: '✔️', text: 'Выполнен и закрыт' },
  'LOSE':        { emoji: '❌', text: 'Отменён' },
};

/**
 * Получение эмодзи и текста стадии
 */
function getStageInfo(stageId) {
  // Пробуем точное совпадение
  if (STAGE_MAP[stageId]) {
    return STAGE_MAP[stageId];
  }

  // Пробуем частичное совпадение (стадии могут иметь префиксы, например C1:NEW)
  const upperStage = (stageId || '').toUpperCase();
  for (const [key, value] of Object.entries(STAGE_MAP)) {
    if (upperStage.includes(key)) {
      return value;
    }
  }

  return { emoji: '🔄', text: 'В обработке' };
}

/**
 * Форматирование карточки заказа
 * @param {object} deal — данные сделки из bitrix.findDeal()
 * @returns {string} — отформатированное сообщение
 */
function formatOrderCard(deal) {
  const stage = getStageInfo(deal.status);

  let card = `📦 *Заказ №${escapeMarkdown(deal.title)}*\n\n`;
  card += `*Статус:* ${stage.emoji} ${escapeMarkdown(stage.text)}\n`;
  card += `*Сумма:* ${escapeMarkdown(deal.amount)}\n`;
  card += `*Менеджер:* ${escapeMarkdown(deal.manager)}\n`;
  card += `*Создан:* ${escapeMarkdown(deal.createdAt)}\n`;
  card += `*Обновлён:* ${escapeMarkdown(deal.updatedAt)}\n`;

  if (deal.comment) {
    card += `\n💬 *Комментарий:* ${escapeMarkdown(stripHtml(deal.comment))}\n`;
  }

  card += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  card += `По вопросам: ${escapeMarkdown(config.manager.contact)} или ${escapeMarkdown(config.manager.phone)}`;

  return card;
}

/**
 * Сообщение: заказ не найден
 */
function formatOrderNotFound(orderNumber) {
  return (
    `😔 К сожалению, заказ *«${escapeMarkdown(orderNumber)}»* не найден\\.\n\n` +
    `Возможные причины:\n` +
    `• Номер заказа введён с ошибкой\n` +
    `• Контактные данные не совпадают с указанными при оформлении\n` +
    `• Заказ ещё не зарегистрирован в системе\n\n` +
    `Попробуйте ещё раз или свяжитесь с менеджером:\n` +
    `${escapeMarkdown(config.manager.contact)} \\| ${escapeMarkdown(config.manager.phone)}`
  );
}

/**
 * Сообщение: верификация не пройдена
 */
function formatVerificationFailed(orderNumber) {
  return (
    `🔒 Контактные данные не совпадают с указанными в заказе *«${escapeMarkdown(orderNumber)}»*\\.\n\n` +
    `Убедитесь, что вы указали тот же email или телефон, который использовали при оформлении заказа\\.\n\n` +
    `Если проблема сохраняется — обратитесь к менеджеру:\n` +
    `${escapeMarkdown(config.manager.contact)} \\| ${escapeMarkdown(config.manager.phone)}`
  );
}

/**
 * Сообщение: CRM недоступна
 */
function formatServiceUnavailable() {
  return (
    `⚠️ *Технические работы*\n\n` +
    `В данный момент система проверки заказов временно недоступна\\.\n` +
    `Пожалуйста, попробуйте позже или свяжитесь с менеджером напрямую:\n\n` +
    `${escapeMarkdown(config.manager.contact)} \\| ${escapeMarkdown(config.manager.phone)}`
  );
}

/**
 * Экранирование спецсимволов MarkdownV2
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Удаление HTML-тегов из комментариев CRM
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

module.exports = {
  formatOrderCard,
  formatOrderNotFound,
  formatVerificationFailed,
  formatServiceUnavailable,
  escapeMarkdown,
  getStageInfo,
};
