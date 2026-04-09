// src/services/duplicates.js
'use strict';

const { findDuplicates, addTimelineComment, updateLead } = require('./bitrix');
const logger = require('../utils/logger');

/**
 * Check if a lead is a duplicate and link it to existing contacts.
 *
 * @param {object} params
 * @param {number|string} params.leadId
 * @param {string|null}   params.phone
 * @param {string|null}   params.email
 * @returns {Promise<{ isDuplicate: boolean, contactId: number|null, existingLeads: number[] }>}
 */
async function checkAndLinkDuplicate({ leadId, phone, email }) {
  const phones = phone ? [phone] : [];
  const emails = email ? [email] : [];

  if (phones.length === 0 && emails.length === 0) {
    return { isDuplicate: false, contactId: null, existingLeads: [] };
  }

  logger.info('[duplicates] Checking for duplicates', { leadId, phone, email });

  const duplicates = await findDuplicates({ phones, emails });

  const contactIds = duplicates.CONTACT || [];
  const leadIds    = (duplicates.LEAD || []).filter(id => String(id) !== String(leadId));

  const isDuplicate = contactIds.length > 0 || leadIds.length > 0;

  if (!isDuplicate) {
    logger.info('[duplicates] No duplicates found', { leadId });
    return { isDuplicate: false, contactId: null, existingLeads: [] };
  }

  const contactId = contactIds[0] || null;

  logger.info('[duplicates] Duplicate found!', {
    leadId,
    contactId,
    existingLeads: leadIds,
  });

  // Link lead to existing contact
  if (contactId) {
    try {
      await updateLead(leadId, { CONTACT_ID: contactId });
      logger.info('[duplicates] Linked lead to existing contact', { leadId, contactId });
    } catch (err) {
      logger.warn('[duplicates] Failed to link contact', { error: err.message });
    }
  }

  // Add timeline comment about duplicate
  const dupeInfo = [];
  if (contactId) dupeInfo.push(`Контакт ID: ${contactId}`);
  if (leadIds.length > 0) dupeInfo.push(`Существующие лиды: ${leadIds.join(', ')}`);

  await addTimelineComment('lead', leadId,
    `<b>⚠️ Обнаружен дубликат!</b><br>${dupeInfo.join('<br>')}<br>` +
    `Проверьте историю взаимодействий перед обработкой.`
  ).catch(() => {});

  return { isDuplicate, contactId, existingLeads: leadIds };
}

module.exports = { checkAndLinkDuplicate };
