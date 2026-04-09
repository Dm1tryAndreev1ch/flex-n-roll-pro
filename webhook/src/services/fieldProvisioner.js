// src/services/fieldProvisioner.js
'use strict';

const { callBitrix } = require('./bitrix');
const logger = require('../utils/logger');

// ─── Custom field definitions ─────────────────────────────────────────────────
// These will be created in BOTH leads and deals.
// Bitrix24 auto-prefixes with UF_CRM_ for leads and UF_CRM_ for deals.
const CUSTOM_FIELDS = [
  {
    FIELD_NAME: 'REQUEST_TYPE',
    USER_TYPE_ID: 'enumeration',
    EDIT_FORM_LABEL: { ru: 'Тип обращения', en: 'Request Type' },
    LIST_COLUMN_LABEL: { ru: 'Тип обращения', en: 'Request Type' },
    LIST: [
      { VALUE: 'Запрос КП',         XML_ID: 'quote_request' },
      { VALUE: 'Новый заказ',        XML_ID: 'order_placement' },
      { VALUE: 'Повторный заказ',    XML_ID: 'reorder' },
      { VALUE: 'Вопрос по макету',   XML_ID: 'design_question' },
      { VALUE: 'Рекламация',        XML_ID: 'technical_issue' },
      { VALUE: 'Доставка',          XML_ID: 'delivery_inquiry' },
      { VALUE: 'Общий запрос',      XML_ID: 'general_inquiry' },
      { VALUE: 'Спам',              XML_ID: 'spam' },
    ],
  },
  {
    FIELD_NAME: 'PRODUCT_TYPE',
    USER_TYPE_ID: 'enumeration',
    EDIT_FORM_LABEL: { ru: 'Тип продукции', en: 'Product Type' },
    LIST_COLUMN_LABEL: { ru: 'Тип продукции', en: 'Product Type' },
    LIST: [
      { VALUE: 'Самоклейка (бумага)', XML_ID: 'self_adhesive_paper' },
      { VALUE: 'Самоклейка (PE)',     XML_ID: 'self_adhesive_pe' },
      { VALUE: 'Самоклейка (PET)',    XML_ID: 'self_adhesive_pet' },
      { VALUE: 'Самоклейка (BOPP)',   XML_ID: 'self_adhesive_bopp' },
      { VALUE: 'Самоклейка (PP)',     XML_ID: 'self_adhesive_pp' },
      { VALUE: 'Sleeve-этикетка',     XML_ID: 'sleeve' },
      { VALUE: 'AR Live Label',       XML_ID: 'ar_label' },
      { VALUE: 'Термохром',           XML_ID: 'thermochrome' },
      { VALUE: 'Linerless',           XML_ID: 'linerless' },
      { VALUE: 'DataMatrix / ЧЗ',    XML_ID: 'datamatrix' },
      { VALUE: 'Не определён',       XML_ID: 'unknown' },
    ],
  },
  {
    FIELD_NAME: 'URGENCY',
    USER_TYPE_ID: 'enumeration',
    EDIT_FORM_LABEL: { ru: 'Срочность', en: 'Urgency' },
    LIST_COLUMN_LABEL: { ru: 'Срочность', en: 'Urgency' },
    LIST: [
      { VALUE: 'Критическая',  XML_ID: 'critical' },
      { VALUE: 'Высокая',      XML_ID: 'high' },
      { VALUE: 'Средняя',      XML_ID: 'medium' },
      { VALUE: 'Низкая',       XML_ID: 'low' },
    ],
  },
  {
    FIELD_NAME: 'AI_PRIORITY',
    USER_TYPE_ID: 'string',
    EDIT_FORM_LABEL: { ru: 'AI Приоритет', en: 'AI Priority' },
    LIST_COLUMN_LABEL: { ru: 'AI Приоритет', en: 'AI Priority' },
  },
  {
    FIELD_NAME: 'MATERIAL',
    USER_TYPE_ID: 'string',
    EDIT_FORM_LABEL: { ru: 'Материал', en: 'Material' },
    LIST_COLUMN_LABEL: { ru: 'Материал', en: 'Material' },
  },
  {
    FIELD_NAME: 'DIMENSIONS',
    USER_TYPE_ID: 'string',
    EDIT_FORM_LABEL: { ru: 'Размеры', en: 'Dimensions' },
    LIST_COLUMN_LABEL: { ru: 'Размеры', en: 'Dimensions' },
  },
  {
    FIELD_NAME: 'QUANTITY',
    USER_TYPE_ID: 'double',
    EDIT_FORM_LABEL: { ru: 'Тираж', en: 'Quantity' },
    LIST_COLUMN_LABEL: { ru: 'Тираж', en: 'Quantity' },
  },
  {
    FIELD_NAME: 'CLIENT_DEADLINE',
    USER_TYPE_ID: 'string',
    EDIT_FORM_LABEL: { ru: 'Срок клиента', en: 'Client Deadline' },
    LIST_COLUMN_LABEL: { ru: 'Срок клиента', en: 'Client Deadline' },
  },
];

// Cache: entityType → { FIELD_NAME → fieldId }
// Populated after provisioning; used by webhook.js to map enum XML_IDs → numeric IDs
let _enumCache = { lead: {}, deal: {} };

/**
 * Provision all custom fields for a given CRM entity type.
 * @param {'lead'|'deal'} entityType
 */
async function provisionForEntity(entityType) {
  const listMethod = `crm.${entityType}.userfield.list`;
  const addMethod  = `crm.${entityType}.userfield.add`;

  let existingFields = [];
  try {
    existingFields = await callBitrix(listMethod) || [];
  } catch (err) {
    logger.error(`[fieldProvisioner] Failed to list ${entityType} userfields`, { error: err.message });
    return;
  }

  const existingNames = new Set(existingFields.map(f => f.FIELD_NAME));

  for (const field of CUSTOM_FIELDS) {
    const fullName = `UF_CRM_${field.FIELD_NAME}`;

    if (existingNames.has(fullName)) {
      logger.debug(`[fieldProvisioner] ${entityType}.${fullName} already exists, skipping`);

      // Cache enum list values if enumeration
      if (field.USER_TYPE_ID === 'enumeration') {
        const existing = existingFields.find(f => f.FIELD_NAME === fullName);
        if (existing && existing.LIST) {
          _enumCache[entityType][field.FIELD_NAME] = {};
          for (const item of existing.LIST) {
            _enumCache[entityType][field.FIELD_NAME][item.XML_ID] = item.ID;
          }
        }
      }
      continue;
    }

    try {
      const payload = {
        FIELD_NAME:        field.FIELD_NAME,
        USER_TYPE_ID:      field.USER_TYPE_ID,
        EDIT_FORM_LABEL:   field.EDIT_FORM_LABEL,
        LIST_COLUMN_LABEL: field.LIST_COLUMN_LABEL,
        SHOW_IN_LIST:      'Y',
        IS_SEARCHABLE:     'Y',
      };
      if (field.LIST) {
        payload.LIST = field.LIST;
      }

      const result = await callBitrix(addMethod, { fields: payload });
      logger.info(`[fieldProvisioner] Created ${entityType} field ${fullName}`, { id: result });

      // After creation, re-fetch to get enum IDs
      if (field.USER_TYPE_ID === 'enumeration' && result) {
        try {
          const created = await callBitrix(listMethod, {
            filter: { FIELD_NAME: fullName },
          });
          if (created && created[0] && created[0].LIST) {
            _enumCache[entityType][field.FIELD_NAME] = {};
            for (const item of created[0].LIST) {
              _enumCache[entityType][field.FIELD_NAME][item.XML_ID] = item.ID;
            }
          }
        } catch (_) { /* enum cache miss is non-fatal */ }
      }
    } catch (err) {
      logger.error(`[fieldProvisioner] Failed to create ${entityType} field ${fullName}`, { error: err.message });
    }
  }
}

/**
 * Provision custom fields for both leads and deals.
 * Call once at server startup.
 */
async function provisionAllFields() {
  logger.info('[fieldProvisioner] Provisioning custom UF fields in Bitrix24…');
  await provisionForEntity('lead');
  await provisionForEntity('deal');
  logger.info('[fieldProvisioner] Field provisioning complete');
}

/**
 * Resolve an enum XML_ID to its numeric Bitrix ID for a given entity + field.
 * Returns the xmlId as-is if no enum mapping found (graceful fallback).
 */
function resolveEnumId(entityType, fieldName, xmlId) {
  const mapping = _enumCache[entityType]?.[fieldName];
  if (mapping && mapping[xmlId] !== undefined) {
    return mapping[xmlId];
  }
  return xmlId; // fallback: Bitrix may accept XML_ID in some contexts
}

module.exports = {
  provisionAllFields,
  resolveEnumId,
};
