/**
 * stageMapper.js
 * Маппинг стадий сделки Битрикс24 → текстовый статус для клиента.
 *
 * Битрикс24 использует два формата ID стадий:
 *   1. Системные: NEW, PREPARATION, QUALIFICATION, WON, LOST
 *   2. Пользовательские (в воронке): C{PIPELINE_ID}:STAGE_{N}
 *
 * Для получения актуальных ID используйте:
 *   crm.dealcategory.stages?id={PIPELINE_ID}
 */

'use strict';

/**
 * Статический маппинг системных стадий.
 */
const SYSTEM_STAGE_MAP = {
  // ─── Системные стадии ─────────────────────────────────────
  NEW: {
    label: '📋 Новый заказ получен',
    emoji: '📋',
    description: 'Ваш заказ зарегистрирован в системе.',
  },
  PREPARATION: {
    label: '⚙️ Техническая подготовка',
    emoji: '⚙️',
    description: 'Технологи готовят макет к производству.',
  },
  QUALIFICATION: {
    label: '🔍 Квалификация',
    emoji: '🔍',
    description: 'Менеджер уточняет детали заказа.',
  },
  WON: {
    label: '✅ Заказ выполнен',
    emoji: '✅',
    description: 'Заказ успешно выполнен. Спасибо, что выбрали нас!',
  },
  LOST: {
    label: '❌ Заказ отменён',
    emoji: '❌',
    description: 'Заказ был отменён. По вопросам обращайтесь к менеджеру.',
  },
};

/**
 * Описания для стадий, загружаемых из env (B24_STAGE_*).
 */
const ENV_STAGE_DEFINITIONS = {
  B24_STAGE_CONTRACT: {
    label: '📦 В очереди на производство',
    emoji: '📦',
    description: 'Договор подписан, оплата получена. Заказ поставлен в производственную очередь.',
  },
  B24_STAGE_TECH: {
    label: '⚙️ Техническая подготовка',
    emoji: '⚙️',
    description: 'Технологи прорабатывают макет и технические условия.',
  },
  B24_STAGE_PRINT1: {
    label: '🖨️ В печати',
    emoji: '🖨️',
    description: 'Заказ запущен в печать. Этап 1 производства.',
  },
  B24_STAGE_PRINT2: {
    label: '✂️ Финишная обработка',
    emoji: '✂️',
    description: 'Печать завершена. Выполняется финишная обработка (резка, ламинация, сборка).',
  },
  B24_STAGE_QC: {
    label: '🔬 Контроль качества ОТК',
    emoji: '🔬',
    description: 'Отдел технического контроля проверяет готовую продукцию.',
  },
  B24_STAGE_READY: {
    label: '📫 Готов к отгрузке',
    emoji: '📫',
    description: 'Заказ упакован и ожидает отправки.',
  },
  B24_STAGE_SHIPPED: {
    label: '🚚 Отгружен',
    emoji: '🚚',
    description: 'Заказ передан в доставку.',
  },
  B24_STAGE_REPEAT: {
    label: '🏁 Завершён',
    emoji: '🏁',
    description: 'Заказ выполнен и доставлен клиенту.',
  },
};

/**
 * Строит итоговую карту stage_id → info из статики + env.
 * @returns {Map<string, {label, emoji, description}>}
 */
function buildStageMap() {
  const map = new Map(Object.entries(SYSTEM_STAGE_MAP));
  for (const [envKey, stageInfo] of Object.entries(ENV_STAGE_DEFINITIONS)) {
    const stageId = process.env[envKey];
    if (stageId && stageId.trim()) {
      map.set(stageId.trim(), stageInfo);
    }
  }
  return map;
}

// Singleton
let _stageMap = null;

function getStageMap() {
  if (!_stageMap) _stageMap = buildStageMap();
  return _stageMap;
}

/**
 * Получить информацию о стадии по ID.
 * @param {string} stageId
 * @returns {{label: string, emoji: string, description: string}}
 */
function getStageInfo(stageId) {
  const map = getStageMap();
  return (
    map.get(stageId) || {
      label: `📊 Статус: ${stageId}`,
      emoji: '📊',
      description: 'Заказ обрабатывается. Уточните статус у менеджера.',
    }
  );
}

function getStageLabel(stageId) {
  return getStageInfo(stageId).label;
}

function getStageDescription(stageId) {
  return getStageInfo(stageId).description;
}

/**
 * Сформировать полное сообщение о статусе заказа для Telegram.
 * @param {object} deal — объект сделки из Битрикс24
 * @returns {string}
 */
function buildStatusMessage(deal) {
  const stageId = deal.STAGE_ID;
  const { label, description } = getStageInfo(stageId);
  const orderNumber =
    deal[process.env.B24_ORDER_NUMBER_FIELD || 'UF_CRM_ORDER_NUMBER'] || deal.ID;
  const title = deal.TITLE || `Заказ #${orderNumber}`;

  return (
    `*${title}*\n` +
    `\n` +
    `*Статус:* ${label}\n` +
    `${description}\n` +
    `\n` +
    `_Обновлено: ${formatDate(deal.DATE_MODIFY)}_`
  );
}

/**
 * Форматировать дату из Битрикс24.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

module.exports = {
  getStageMap,
  getStageInfo,
  getStageLabel,
  getStageDescription,
  buildStatusMessage,
  formatDate,
};