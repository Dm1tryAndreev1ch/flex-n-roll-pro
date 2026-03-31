'use strict';

/**
 * callAnalyzer.js — GPT-4 анализ транскрипта звонка
 *
 * Выполняет:
 *  1. Проверку скрипта продаж по 7 критериям
 *  2. Sentiment-анализ
 *  3. Извлечение ключевых данных (передаётся в dataExtract)
 */

const { OpenAI } = require('openai');
const config     = require('../../config');
const logger     = require('../utils/logger');
const scorer     = require('../utils/scorer');
const { SCRIPT_CHECK_PROMPT }  = require('../prompts/scriptCheck');
const { SENTIMENT_PROMPT }     = require('../prompts/sentiment');
const { DATA_EXTRACT_PROMPT }  = require('../prompts/dataExtract');
const bitrix = require('./bitrix');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Утилита для безопасного JSON-парсинга GPT-ответа ──────────────────────
function safeParseJson(text) {
  // GPT иногда оборачивает JSON в ```json ... ```
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    logger.warn(`[callAnalyzer] JSON parse error: ${e.message}\nRaw: ${text.substring(0, 300)}`);
    throw new Error(`GPT вернул невалидный JSON: ${e.message}`);
  }
}

// ── GPT вызов с retry ─────────────────────────────────────────────────────
async function callGpt(systemPrompt, userMessage, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: config.openai.gptModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      return completion.choices[0].message.content;
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn(`[callAnalyzer] GPT попытка ${attempt + 1} провалилась: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  ПРОВЕРКА СКРИПТА ПРОДАЖ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Проверить транскрипт по 7 пунктам скрипта продаж.
 * @param {string} transcript  — полный текст транскрипта
 * @returns {Promise<ScriptCheckResult>}
 *
 * @typedef {Object} ScriptCheckResult
 * @property {number}   script_score      — 0-100
 * @property {string[]} passed_items      — пройденные пункты
 * @property {string[]} failed_items      — непройденные пункты
 * @property {string[]} recommendations  — конкретные рекомендации
 * @property {Object}   details          — детали по каждому пункту
 */
async function checkSalesScript(transcript) {
  logger.info('[callAnalyzer] Проверка скрипта продаж...');

  const raw = await callGpt(
    SCRIPT_CHECK_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  // Валидация структуры
  if (typeof result.script_score !== 'number') {
    result.script_score = 0;
  }
  result.script_score = Math.min(100, Math.max(0, Math.round(result.script_score)));
  result.passed_items    = result.passed_items    || [];
  result.failed_items    = result.failed_items    || [];
  result.recommendations = result.recommendations || [];
  result.details         = result.details         || {};

  logger.info(`[callAnalyzer] Скрипт: ${result.script_score}/100, ` +
    `пройдено ${result.passed_items.length}/7 пунктов`);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  SENTIMENT-АНАЛИЗ
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SentimentResult
 * @property {string}   overall_tone     — 'positive'|'neutral'|'negative'
 * @property {string}   client_tone      — 'interest'|'skepticism'|'irritation'
 * @property {string}   manager_tone     — 'confident'|'uncertain'|'aggressive'|'friendly'
 * @property {string}   churn_risk       — 'low'|'medium'|'high'
 * @property {Object[]} negative_moments — [{timestamp, quote, reason}]
 * @property {string}   summary          — краткое резюме тональности
 */
async function analyzeSentiment(transcript) {
  logger.info('[callAnalyzer] Sentiment-анализ...');

  const raw = await callGpt(
    SENTIMENT_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  // Нормализация
  const TONE_VALS  = ['positive', 'neutral', 'negative'];
  const CLIENT_VALS = ['interest', 'skepticism', 'irritation', 'neutral'];
  const RISK_VALS  = ['low', 'medium', 'high'];

  if (!TONE_VALS.includes(result.overall_tone))   result.overall_tone  = 'neutral';
  if (!CLIENT_VALS.includes(result.client_tone))  result.client_tone   = 'neutral';
  if (!RISK_VALS.includes(result.churn_risk))     result.churn_risk    = 'low';
  result.negative_moments = result.negative_moments || [];
  result.summary = result.summary || '';

  logger.info(`[callAnalyzer] Sentiment: ${result.overall_tone}, риск оттока: ${result.churn_risk}`);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  ИЗВЛЕЧЕНИЕ ДАННЫХ
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExtractedData
 * @property {Object}   product        — { material, size, quantity, type }
 * @property {string}   deadline       — deadline строкой ('до 15 апреля', '')
 * @property {string[]} objections     — список возражений клиента
 * @property {Object}   agreements     — { followup_date, next_step, notes }
 * @property {Object}   contacts       — { name, phone, email }
 * @property {string[]} unanswered     — вопросы клиента без ответа
 */
async function extractKeyData(transcript) {
  logger.info('[callAnalyzer] Извлечение данных...');

  const raw = await callGpt(
    DATA_EXTRACT_PROMPT,
    `Транскрипт звонка:\n\n${transcript}`
  );

  const result = safeParseJson(raw);

  result.product     = result.product     || {};
  result.deadline    = result.deadline    || '';
  result.objections  = result.objections  || [];
  result.agreements  = result.agreements  || {};
  result.contacts    = result.contacts    || {};
  result.unanswered  = result.unanswered  || [];

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД: ПОЛНЫЙ АНАЛИЗ ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Полный анализ транскрипта звонка.
 *
 * @param {{ transcript: {text: string}, dealId: string, callInfo: object }} params
 * @returns {Promise<FullCallAnalysis>}
 */
async function analyzeCall({ transcript, dealId, callInfo = {} }) {
  const text = typeof transcript === 'string' ? transcript : transcript.text;

  if (!text || text.trim().length < 50) {
    throw new Error('[callAnalyzer] Транскрипт слишком короткий или пустой');
  }

  logger.info(`[callAnalyzer] Запуск полного анализа dealId=${dealId}, ${text.length} симв.`);

  // Запустить все три анализа параллельно
  const [scriptResult, sentimentResult, extractedData] = await Promise.all([
    checkSalesScript(text),
    analyzeSentiment(text),
    extractKeyData(text),
  ]);

  // Итоговый балл: взвешенная сумма
  const overall_score = scorer.computeOverallScore({
    script_score:    scriptResult.script_score,
    sentiment:       sentimentResult,
    extractedData,
  });

  // Автозаполнение полей сделки в Б24
  if (dealId && extractedData) {
    const fieldsToUpdate = {};

    if (extractedData.product?.type)      fieldsToUpdate.UF_PRODUCT_TYPE   = extractedData.product.type;
    if (extractedData.product?.material)  fieldsToUpdate.UF_PRODUCT_MATERIAL = extractedData.product.material;
    if (extractedData.product?.quantity)  fieldsToUpdate.UF_PRINT_QUANTITY  = String(extractedData.product.quantity);
    if (extractedData.deadline)           fieldsToUpdate.UF_CLIENT_DEADLINE  = extractedData.deadline;
    if (extractedData.agreements?.next_step) fieldsToUpdate.UF_NEXT_STEP    = extractedData.agreements.next_step;
    if (extractedData.objections?.length) fieldsToUpdate.UF_OBJECTIONS      = extractedData.objections.join('; ');

    if (Object.keys(fieldsToUpdate).length > 0) {
      await bitrix.updateDealFields(dealId, fieldsToUpdate)
        .catch(e => logger.warn(`[callAnalyzer] Не удалось обновить поля Б24: ${e.message}`));
    }
  }

  const result = {
    dealId,
    overall_score,
    script:        scriptResult,
    sentiment:     sentimentResult,
    extracted:     extractedData,
    analyzed_at:   new Date().toISOString(),
    transcript_len: text.length,
  };

  logger.info(`[callAnalyzer] Анализ завершён dealId=${dealId} overall=${overall_score}`);
  return result;
}

module.exports = {
  analyzeCall,
  checkSalesScript,
  analyzeSentiment,
  extractKeyData,
};