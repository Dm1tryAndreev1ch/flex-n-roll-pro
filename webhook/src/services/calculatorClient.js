// src/services/calculatorClient.js
'use strict';

const axios  = require('axios');
const logger = require('../utils/logger');

// Calculator API runs as a sibling Docker service
const CALCULATOR_URL = process.env.CALCULATOR_API_URL || 'http://fnr-calculator:3000';
const TIMEOUT_MS     = 10000;

/**
 * Estimate the price for a label order using the calculator API.
 *
 * @param {object} params
 * @param {number}       params.quantity   - Number of labels
 * @param {string|null}  params.material   - Material type (e.g. 'paper', 'PE', 'PET')
 * @param {string|null}  params.dimensions - Dimensions string (e.g. '100x50')
 * @param {string|null}  params.productType - Product type from AI classification
 * @returns {Promise<{ price: number|null, pricePerUnit: number|null, details: object }|null>}
 */
async function estimatePrice({ quantity, material, dimensions, productType }) {
  if (!quantity || quantity <= 0) {
    return null;
  }

  // Parse dimensions if available (format: "100x50", "100х50", "100*50")
  let width = null;
  let height = null;
  if (dimensions) {
    const match = dimensions.match(/(\d+(?:\.\d+)?)\s*[xхXХ*×]\s*(\d+(?:\.\d+)?)/);
    if (match) {
      width  = parseFloat(match[1]);
      height = parseFloat(match[2]);
    }
  }

  // Map AI product_type to calculator material codes
  const materialMap = {
    self_adhesive_paper: 'paper',
    self_adhesive_pe:    'PE',
    self_adhesive_pet:   'PET',
    self_adhesive_bopp:  'BOPP',
    self_adhesive_pp:    'PP',
    sleeve:              'sleeve',
    linerless:           'linerless',
  };

  const calcMaterial = material || materialMap[productType] || 'paper';

  const payload = {
    quantity,
    material: calcMaterial,
    width:    width || 100,   // Default 100mm
    height:   height || 50,   // Default 50mm
  };

  try {
    logger.info('[calculator] Requesting price estimate', payload);

    const response = await axios.post(`${CALCULATOR_URL}/api/calculate`, payload, {
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;

    if (data && (data.price || data.totalPrice || data.total)) {
      const price = data.price || data.totalPrice || data.total;
      const pricePerUnit = data.pricePerUnit || data.unitPrice || (price / quantity);

      logger.info('[calculator] Price estimate received', { price, pricePerUnit });

      return {
        price:        Math.round(price * 100) / 100,
        pricePerUnit: Math.round(pricePerUnit * 100) / 100,
        details:      data,
      };
    }

    logger.warn('[calculator] No price in response', { data });
    return null;
  } catch (err) {
    // Calculator service might not be running — this is non-fatal
    logger.warn('[calculator] Price estimation failed (service may be unavailable)', {
      error: err.message,
      code:  err.code,
    });
    return null;
  }
}

module.exports = { estimatePrice };
