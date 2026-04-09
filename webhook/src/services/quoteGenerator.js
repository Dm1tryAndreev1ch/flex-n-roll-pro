// src/services/quoteGenerator.js
'use strict';

const PDFDocument = require('pdfkit');
const { callBitrix } = require('./bitrix');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Company info for the quote header
const COMPANY = {
  name:    'FLEX-N-ROLL PRO',
  tagline: 'Типография этикеток и упаковки',
  phone:   process.env.COMPANY_PHONE || '+375 (XX) XXX-XX-XX',
  email:   process.env.COMPANY_EMAIL || 'info@flexnroll.by',
  website: process.env.COMPANY_WEBSITE || 'flexnroll.by',
};

/**
 * Generate a PDF quote (commercial proposal) from order data.
 *
 * @param {object} params
 * @param {string}       params.clientName
 * @param {string|null}  params.clientCompany
 * @param {string|null}  params.clientEmail
 * @param {string}       params.productType   - Human-readable product name
 * @param {string|null}  params.material
 * @param {string|null}  params.dimensions
 * @param {number}       params.quantity
 * @param {number|null}  params.price         - Total price
 * @param {number|null}  params.pricePerUnit
 * @param {string|null}  params.deadline
 * @param {string}       params.quoteNumber   - Quote reference number
 * @returns {Promise<Buffer>} PDF as buffer
 */
async function generateQuotePDF({
  clientName,
  clientCompany,
  clientEmail,
  productType,
  material,
  dimensions,
  quantity,
  price,
  pricePerUnit,
  deadline,
  quoteNumber,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Коммерческое предложение ${quoteNumber}`,
          Author: COMPANY.name,
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ── Header ──
      doc.fontSize(22).font('Helvetica-Bold').text(COMPANY.name, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(COMPANY.tagline, { align: 'center' });
      doc.moveDown(0.5);

      // Contact line
      doc.fontSize(8).fillColor('#666666')
        .text(`${COMPANY.phone} | ${COMPANY.email} | ${COMPANY.website}`, { align: 'center' });
      doc.moveDown(1);

      // Horizontal rule
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(1);

      // ── Quote title ──
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold')
        .text(`COMMERCIAL PROPOSAL / ${quoteNumber}`, { align: 'center' });

      const today = new Date().toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      doc.fontSize(10).font('Helvetica').text(`Date / Дата: ${today}`, { align: 'center' });
      doc.moveDown(1.5);

      // ── Client info ──
      doc.fontSize(12).font('Helvetica-Bold').text('Client / Клиент:');
      doc.fontSize(11).font('Helvetica');
      if (clientName) doc.text(`  Name / Имя: ${clientName}`);
      if (clientCompany) doc.text(`  Company / Компания: ${clientCompany}`);
      if (clientEmail) doc.text(`  Email: ${clientEmail}`);
      doc.moveDown(1);

      // ── Product details ──
      doc.fontSize(12).font('Helvetica-Bold').text('Product / Продукция:');
      doc.moveDown(0.5);

      // Table-like layout
      const tableData = [
        ['Product Type / Тип:', productType || 'Label / Этикетка'],
        ['Material / Материал:', material || 'Standard / Стандартный'],
        ['Dimensions / Размеры:', dimensions || 'Standard / Стандартные'],
        ['Quantity / Тираж:', `${quantity || '-'} pcs / шт.`],
      ];

      if (deadline) {
        tableData.push(['Deadline / Срок:', deadline]);
      }

      doc.fontSize(11).font('Helvetica');
      for (const [label, value] of tableData) {
        doc.text(`  ${label}  ${value}`);
      }
      doc.moveDown(1);

      // ── Pricing ──
      if (price) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.5);

        doc.fontSize(12).font('Helvetica-Bold').text('Pricing / Стоимость:');
        doc.moveDown(0.5);

        doc.fontSize(11).font('Helvetica');
        if (pricePerUnit) {
          doc.text(`  Price per unit / Цена за шт.: ${pricePerUnit.toFixed(2)} BYN`);
        }
        doc.fontSize(14).font('Helvetica-Bold')
          .text(`  TOTAL / ИТОГО: ${price.toFixed(2)} BYN`, { align: 'left' });
        doc.moveDown(1);
      }

      // ── Terms ──
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica-Bold').text('Terms / Условия:');
      doc.fontSize(9).font('Helvetica').fillColor('#444444');
      doc.text('• Proposal valid for 14 days / Предложение действительно 14 дней');
      doc.text('• Payment: 100% prepayment / Оплата: 100% предоплата');
      doc.text('• Production time: 5-7 business days / Срок производства: 5-7 рабочих дней');
      doc.text('• Delivery: negotiable / Доставка: по договорённости');
      doc.moveDown(2);

      // ── Footer ──
      doc.fillColor('#999999').fontSize(8)
        .text(`${COMPANY.name} — ${COMPANY.tagline}`, 50, 750, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a quote PDF and attach it to a Bitrix24 entity.
 *
 * @param {object} quoteData - Data for the quote
 * @param {'lead'|'deal'} entityType
 * @param {number|string} entityId
 * @returns {Promise<boolean>} Whether the quote was successfully generated and attached
 */
async function generateAndAttachQuote(quoteData, entityType, entityId) {
  try {
    const quoteNumber = `FNR-${entityType.toUpperCase()}-${entityId}-${Date.now().toString(36).toUpperCase()}`;
    const pdfBuffer = await generateQuotePDF({ ...quoteData, quoteNumber });

    logger.info('[quoteGenerator] PDF generated', {
      entityType, entityId, quoteNumber,
      size: pdfBuffer.length,
    });

    // Upload PDF to Bitrix24 disk and attach to entity timeline
    // Using base64 encoding for file upload
    const base64Content = pdfBuffer.toString('base64');
    const fileName = `KP_${quoteNumber}.pdf`;

    // Add as timeline comment with file
    const { addTimelineComment } = require('./bitrix');
    await addTimelineComment(entityType, entityId,
      `<b>📄 Коммерческое предложение ${quoteNumber}</b><br>` +
      `Продукт: ${quoteData.productType || 'Этикетка'}<br>` +
      `Тираж: ${quoteData.quantity} шт.<br>` +
      (quoteData.price ? `Стоимость: ${quoteData.price.toFixed(2)} BYN<br>` : '') +
      `Файл: ${fileName}`
    );

    // Try to attach file via storage
    try {
      // Get or create a folder for quotes
      const folderId = await getOrCreateQuoteFolder();
      if (folderId) {
        await callBitrix('disk.folder.uploadfile', {
          id: folderId,
          data: { NAME: fileName },
          fileContent: [fileName, base64Content],
        });
        logger.info('[quoteGenerator] PDF uploaded to Bitrix24 disk', { fileName });
      }
    } catch (err) {
      logger.warn('[quoteGenerator] Failed to upload PDF to disk (non-fatal)', { error: err.message });
    }

    return true;
  } catch (err) {
    logger.error('[quoteGenerator] Failed to generate quote', { error: err.message });
    return false;
  }
}

/**
 * Get or create a folder for storing quotes on Bitrix24 disk.
 */
async function getOrCreateQuoteFolder() {
  try {
    // Try to find existing folder
    const storage = await callBitrix('disk.storage.getlist', {
      filter: { ENTITY_TYPE: 'common' },
    });

    if (!storage || storage.length === 0) return null;

    const storageId = storage[0].ID;

    // Check if "Quotes" folder exists
    const children = await callBitrix('disk.storage.getchildren', {
      id: storageId,
      filter: { NAME: 'AI_Quotes' },
    });

    if (children && children.length > 0) {
      return children[0].ID;
    }

    // Create it
    const folder = await callBitrix('disk.storage.addfolder', {
      id: storageId,
      data: { NAME: 'AI_Quotes' },
    });

    return folder?.ID || null;
  } catch (err) {
    logger.warn('[quoteGenerator] Cannot manage disk folder', { error: err.message });
    return null;
  }
}

module.exports = { generateQuotePDF, generateAndAttachQuote };
