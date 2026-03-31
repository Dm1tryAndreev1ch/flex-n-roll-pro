'use strict';

/**
 * datamatrix.js — Утилиты для работы с кодами DataMatrix
 *
 * Реализует:
 *  - Парсинг GS1 DataMatrix (FNC1 Application Identifiers)
 *  - Валидацию структуры кода ЧЗ (01+21 или 01+21+91+92)
 *  - Генерацию QR-кода для HTML-отчётов (через библиотеку qrcode)
 *  - Верификацию контрольной суммы (GS1 Check Digit для GTIN-14)
 */

const qrcode = require('qrcode');

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

// Разделитель групп в GS1 DataMatrix (Group Separator, ASCII 29)
const GS = String.fromCharCode(29);

// Application Identifiers, используемые ЧЗ
const AI = {
  GTIN: '01',        // (01) GTIN-14
  SERIAL: '21',      // (21) Серийный номер
  CRYPTO_KEY: '91',  // (91) Ключ проверки (ЧЗ)
  CRYPTO_SIGN: '92', // (92) Крипто-хвост (ЧЗ)
};

// ---------------------------------------------------------------------------
// Парсинг DataMatrix кода ЧЗ
// ---------------------------------------------------------------------------

/**
 * Разбирает строку DataMatrix на компоненты.
 *
 * Поддерживаемые форматы ЧЗ:
 *  - 010...021...<GS>91...<GS>92...
 *  - 010...021...         (без крипто)
 *
 * @param {string} raw  — сырая строка кода (как отпечатана / отсканирована)
 * @returns {{
 *   gtin: string,
 *   serial: string,
 *   cryptoKey: string|null,
 *   cryptoSig: string|null,
 *   raw: string,
 *   valid: boolean,
 *   error: string|null,
 * }}
 */
function parseDataMatrix(raw) {
  const result = {
    gtin: '',
    serial: '',
    cryptoKey: null,
    cryptoSig: null,
    raw,
    valid: false,
    error: null,
  };

  if (!raw || typeof raw !== 'string') {
    result.error = 'Пустой или некорректный код';
    return result;
  }

  // Нормализуем: заменяем видимый разделитель \x1D на GS
  const code = raw.replace(/\x1d/g, GS).replace(/\\x1d/g, GS);

  // Должен начинаться с AI 01
  if (!code.startsWith('01')) {
    result.error = 'Код не начинается с AI (01)';
    return result;
  }

  // GTIN: фиксированная длина 14 символов после AI 01
  result.gtin = code.substring(2, 16);

  if (result.gtin.length !== 14) {
    result.error = 'GTIN должен содержать 14 символов';
    return result;
  }

  // Серийный номер: после AI 21, до GS или конца строки
  const serialStart = code.indexOf('21', 16);
  if (serialStart === -1) {
    result.error = 'AI (21) серийного номера не найден';
    return result;
  }

  const afterSerial = code.indexOf(GS, serialStart + 2);
  result.serial = afterSerial === -1
    ? code.substring(serialStart + 2)
    : code.substring(serialStart + 2, afterSerial);

  // Крипто-ключ AI 91 (опционально)
  const key91 = code.indexOf('\x1d91', 0);
  const alt91 = code.indexOf(GS + '91', 0);
  const pos91 = key91 !== -1 ? key91 : alt91;

  if (pos91 !== -1) {
    const startKey = pos91 + (GS + '91').length;
    const endKey = code.indexOf(GS, startKey);
    result.cryptoKey = endKey === -1 ? code.substring(startKey) : code.substring(startKey, endKey);
  }

  // Крипто-подпись AI 92 (опционально)
  const pos92 = code.indexOf(GS + '92', 0);
  if (pos92 !== -1) {
    const startSig = pos92 + (GS + '92').length;
    result.cryptoSig = code.substring(startSig); // всегда последний
  }

  // Базовая валидация контрольной цифры GTIN
  const gtinCheck = validateGtinCheckDigit(result.gtin);
  if (!gtinCheck) {
    result.error = `Неверная контрольная цифра GTIN: ${result.gtin}`;
    return result;
  }

  result.valid = true;
  return result;
}

// ---------------------------------------------------------------------------
// Контрольная цифра GTIN-14 (алгоритм GS1)
// ---------------------------------------------------------------------------

/**
 * Проверяет контрольную цифру GTIN-14 по алгоритму GS1.
 * @param {string} gtin  — строка из 14 цифр
 * @returns {boolean}
 */
function validateGtinCheckDigit(gtin) {
  if (!/^\d{14}$/.test(gtin)) return false;

  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop(); // последняя цифра

  const sum = digits.reduce((acc, d, i) => {
    return acc + d * ((i % 2 === 0) ? 3 : 1);
  }, 0);

  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

/**
 * Вычисляет контрольную цифру для первых 13 цифр GTIN.
 * @param {string} gtin13  — 13 цифр
 * @returns {string}  — 14-значный GTIN с правильной контрольной цифрой
 */
function computeGtinCheckDigit(gtin13) {
  if (!/^\d{13}$/.test(gtin13)) {
    throw new Error('GTIN без контрольной цифры должен содержать 13 цифр');
  }
  const digits = gtin13.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * ((i % 2 === 0) ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return gtin13 + check;
}

// ---------------------------------------------------------------------------
// Верификация набора кодов
// ---------------------------------------------------------------------------

/**
 * Проверяет массив кодов и возвращает отчёт.
 *
 * @param {string[]} codes
 * @returns {{
 *   total: number,
 *   valid: number,
 *   invalid: number,
 *   errors: {code: string, error: string}[],
 *   parsed: object[],
 * }}
 */
function verifyCodes(codes) {
  const parsed = codes.map((c) => parseDataMatrix(c));
  const errors = parsed
    .filter((p) => !p.valid)
    .map((p) => ({ code: p.raw, error: p.error }));

  return {
    total: codes.length,
    valid: parsed.filter((p) => p.valid).length,
    invalid: errors.length,
    errors,
    parsed,
  };
}

// ---------------------------------------------------------------------------
// Генерация QR-кода (Data URL) для HTML-отчётов
// ---------------------------------------------------------------------------

/**
 * Генерирует base64 PNG QR-код для переданной строки.
 * Удобен для встраивания в HTML: <img src="{result}">
 *
 * @param {string} text
 * @param {object} [opts]          — опции qrcode
 * @param {number} [opts.width=150]
 * @returns {Promise<string>}       — data URL (image/png, base64)
 */
async function generateQrDataUrl(text, opts = {}) {
  const options = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: opts.width || 150,
    margin: 1,
  };
  return qrcode.toDataURL(text, options);
}

/**
 * Генерирует SVG QR-код (строка).
 * @param {string} text
 * @returns {Promise<string>}
 */
async function generateQrSvg(text) {
  return qrcode.toString(text, { type: 'svg', errorCorrectionLevel: 'M' });
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  parseDataMatrix,
  validateGtinCheckDigit,
  computeGtinCheckDigit,
  verifyCodes,
  generateQrDataUrl,
  generateQrSvg,
};