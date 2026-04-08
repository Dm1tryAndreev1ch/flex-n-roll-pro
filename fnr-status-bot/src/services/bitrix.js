const axios = require('axios');
const config = require('../../config/config');
const { logger } = require('../middleware/logger');

// Axios-инстанс для Битрикс24
const bitrixClient = axios.create({
  baseURL: config.bitrix24.webhookUrl,
  timeout: config.bitrix24.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Поиск сделки в Битрикс24 по номеру заказа и контактным данным
 * @param {string} orderNumber — номер заказа (например, ФНР-2024-1234)
 * @param {string} contact — email или телефон клиента
 * @returns {object} — данные о сделке или { found: false }
 */
async function findDeal(orderNumber, contact) {
  try {
    logger.info(`Поиск сделки: заказ=${orderNumber}, контакт=${maskContact(contact)}`);

    // 1. Ищем сделку по TITLE (номер заказа)
    const dealsResponse = await bitrixClient.post('crm.deal.list', {
      filter: {
        '%TITLE': orderNumber,
      },
      select: [
        'ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID',
        'ASSIGNED_BY_ID', 'DATE_CREATE', 'DATE_MODIFY',
        'COMMENTS', 'CONTACT_ID',
      ],
    });

    const deals = dealsResponse.data?.result || [];

    if (deals.length === 0) {
      logger.info(`Сделка не найдена по номеру: ${orderNumber}`);
      return { found: false, reason: 'not_found' };
    }

    // 2. Верификация по контактным данным (email или телефон)
    const verifiedDeal = await verifyDealContact(deals, contact);

    if (!verifiedDeal) {
      logger.warn(`Верификация не пройдена: заказ=${orderNumber}`);
      return { found: false, reason: 'verification_failed' };
    }

    // 3. Получаем имя менеджера
    const managerName = await getManagerName(verifiedDeal.ASSIGNED_BY_ID);

    // 4. Получаем название стадии
    const stageName = await getStageName(verifiedDeal.STAGE_ID);

    return {
      found: true,
      dealId: verifiedDeal.ID,
      title: verifiedDeal.TITLE,
      status: verifiedDeal.STAGE_ID,
      stageName,
      amount: formatAmount(verifiedDeal.OPPORTUNITY, verifiedDeal.CURRENCY_ID),
      manager: managerName,
      createdAt: formatDate(verifiedDeal.DATE_CREATE),
      updatedAt: formatDate(verifiedDeal.DATE_MODIFY),
      comment: verifiedDeal.COMMENTS || null,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      logger.error(`Битрикс24 недоступен: ${error.message}`);
      throw new BitrixUnavailableError('Битрикс24 временно недоступен');
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      logger.error(`Ошибка авторизации Битрикс24: ${error.response.status}`);
      throw new BitrixUnavailableError('Ошибка авторизации в CRM');
    }

    logger.error(`Ошибка при поиске сделки: ${error.message}`, { stack: error.stack });
    throw new BitrixUnavailableError('Ошибка при обращении к CRM');
  }
}

/**
 * Верификация сделки по контактным данным
 */
async function verifyDealContact(deals, contact) {
  const normalizedContact = contact.trim().toLowerCase();
  const isEmail = normalizedContact.includes('@');
  const isPhone = /^[\d\+\(\)\-\s]{7,}$/.test(normalizedContact);

  for (const deal of deals) {
    const contactId = deal.CONTACT_ID;

    if (!contactId) {
      // Если у сделки нет привязанного контакта — пробуем получить через связь
      const contactIds = await getDealContactIds(deal.ID);
      for (const cId of contactIds) {
        const match = await checkContactMatch(cId, normalizedContact, isEmail, isPhone);
        if (match) return deal;
      }
      continue;
    }

    const match = await checkContactMatch(contactId, normalizedContact, isEmail, isPhone);
    if (match) return deal;
  }

  return null;
}

/**
 * Получение ID контактов, привязанных к сделке
 */
async function getDealContactIds(dealId) {
  try {
    const response = await bitrixClient.post('crm.deal.contact.items.get', {
      id: dealId,
    });
    const contacts = response.data?.result || [];
    return contacts.map((c) => c.CONTACT_ID);
  } catch (error) {
    logger.warn(`Не удалось получить контакты сделки ${dealId}: ${error.message}`);
    return [];
  }
}

/**
 * Проверка совпадения контактных данных
 */
async function checkContactMatch(contactId, normalizedContact, isEmail, isPhone) {
  try {
    const response = await bitrixClient.post('crm.contact.get', {
      id: contactId,
    });
    const contactData = response.data?.result;

    if (!contactData) return false;

    // Проверяем email
    if (isEmail && contactData.EMAIL) {
      const emails = Array.isArray(contactData.EMAIL)
        ? contactData.EMAIL
        : [contactData.EMAIL];

      for (const emailObj of emails) {
        const email = (emailObj.VALUE || emailObj).toLowerCase().trim();
        if (email === normalizedContact) return true;
      }
    }

    // Проверяем телефон
    if (isPhone && contactData.PHONE) {
      const phones = Array.isArray(contactData.PHONE)
        ? contactData.PHONE
        : [contactData.PHONE];

      const normalizedPhone = normalizedContact.replace(/[\s\(\)\-]/g, '');

      for (const phoneObj of phones) {
        const phone = (phoneObj.VALUE || phoneObj).replace(/[\s\(\)\-]/g, '');
        if (phone === normalizedPhone || phone.endsWith(normalizedPhone) || normalizedPhone.endsWith(phone)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.warn(`Ошибка проверки контакта ${contactId}: ${error.message}`);
    return false;
  }
}

/**
 * Получение имени менеджера по ID
 */
async function getManagerName(userId) {
  if (!userId) return 'Не назначен';

  try {
    const response = await bitrixClient.post('user.get', {
      ID: userId,
    });
    const user = response.data?.result?.[0];
    if (user) {
      return `${user.NAME || ''} ${user.LAST_NAME || ''}`.trim() || 'Менеджер';
    }
    return 'Менеджер';
  } catch (error) {
    logger.warn(`Не удалось получить менеджера ${userId}: ${error.message}`);
    return 'Менеджер';
  }
}

/**
 * Получение человекочитаемого названия стадии
 */
async function getStageName(stageId) {
  if (!stageId) return 'Неизвестен';

  try {
    // stageId format: "C3:NEW" → categoryId = 3
    const match = stageId.match(/^C(\d+):/);
    const categoryId = match ? parseInt(match[1], 10) : 0;
    const response = await bitrixClient.post('crm.dealcategory.stage.list', {
      id: categoryId,
      filter: { STATUS_ID: stageId },
    });
    const stage = response.data?.result?.[0];
    return stage?.NAME || stageId;
  } catch (error) {
    logger.warn(`Не удалось получить имя стадии ${stageId}: ${error.message}`);
    return stageId;
  }
}

/**
 * Форматирование суммы
 */
function formatAmount(amount, currency) {
  if (!amount) return 'Не указана';
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  const formatted = num.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽';
  return `${formatted} ${currencySymbol}`;
}

/**
 * Форматирование даты
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Не указана';

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
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

/**
 * Маскирование контакта для логов
 */
function maskContact(contact) {
  if (!contact) return '***';
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }
  return contact.substring(0, 4) + '***' + contact.slice(-2);
}

/**
 * Кастомная ошибка — Битрикс24 недоступен
 */
class BitrixUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BitrixUnavailableError';
  }
}

module.exports = {
  findDeal,
  BitrixUnavailableError,
};
