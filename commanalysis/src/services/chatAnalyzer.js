'use strict';

/**
 * chatAnalyzer.js — Анализ переписки менеджера с клиентом
 *
 * Метрики:
 *  - Скорость первого ответа менеджера (минуты)
 *  - Среднее время ответа
 *  - Полнота ответов (все ли вопросы клиента закрыты)
 *  - Проверка орфографии / грамматики
 *  - Тональность (GPT)
 *  - Итоговый балл чата
 */

const dayjs    = require('dayjs');
const { OpenAI } = require('openai');
const config   = require('../../config');
const logger   = require('../utils/logger');
const scorer   = require('../utils/scorer');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Утилита: безопасный парсинг JSON из GPT ───────────────────────────────
function safeParseJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error(`GPT вернул невалидный JSON: ${e.message}`); }
}

// ── GPT вызов ──────────────────────────────────────────────────────────────
async function callGpt(systemPrompt, userMessage) {
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
}

// ─────────────────────────────────────────────────────────────────────────
//  СИСТЕМНЫЙ ПРОМТ ДЛЯ АНАЛИЗА ПЕРЕПИСКИ
// ─────────────────────────────────────────────────────────────────────────
const CHAT_ANALYSIS_PROMPT = `
Ты — эксперт по качеству продаж полиграфической компании FLEX-N-ROLL PRO.
Тебе дана переписка менеджера с клиентом (чат, мессенджер или CRM-переписка).

Проанализируй переписку и верни ТОЛЬКО валидный JSON-объект:
{
  "completeness_score": <число 0-100, насколько полно менеджер ответил на вопросы клиента>,
  "tone_score": <число 0-100, качество тональности и вежливости>,
  "spelling_score": <число 0-100, отсутствие ошибок>,
  "unanswered_questions": [<список вопросов клиента, оставшихся без ответа>],
  "spelling_errors": [{"text": "<фраза с ошибкой>", "correction": "<исправление>"}],
  "tone": "professional"|"friendly"|"neutral"|"rude"|"over_formal",
  "client_sentiment": "positive"|"neutral"|"negative"|"interested",
  "churn_risk": "low"|"medium"|"high",
  "recommendations": [<список конкретных рекомендаций по улучшению переписки>],
  "summary": "<краткое резюме переписки 2-3 предложения>"
}

Критерии полноты (completeness_score):
- 100: все вопросы клиента получили развёрнутый ответ
- 70-99: большинство ответов есть, но не все детальны
- 40-69: часть вопросов проигнорирована
- 0-39: менеджер отвечал односложно или игнорировал вопросы
`.trim();

// ─────────────────────────────────────────────────────────────────────────
//  ВЫЧИСЛЕНИЕ МЕТРИК ВРЕМЕНИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Определить роль первого сообщения и время первого ответа менеджера.
 * @param {Array<{role: string, text: string, timestamp: string}>} messages
 * @returns {{ firstResponseMinutes: number|null, avgResponseMinutes: number|null, managerId: string|null }}
 */
function computeTimingMetrics(messages) {
  if (!messages || messages.length < 2) {
    return { firstResponseMinutes: null, avgResponseMinutes: null, managerId: null };
  }

  // Найти первое сообщение от клиента
  const clientMsgs  = messages.filter(m => m.role === 'client');
  const managerMsgs = messages.filter(m => m.role === 'manager');

  if (!clientMsgs.length || !managerMsgs.length) {
    return { firstResponseMinutes: null, avgResponseMinutes: null, managerId: null };
  }

  // Первый ответ менеджера после первого сообщения клиента
  const firstClientTs  = dayjs(clientMsgs[0].timestamp);
  const firstManagerTs = managerMsgs
    .map(m => dayjs(m.timestamp))
    .filter(t => t.isAfter(firstClientTs))
    .sort((a, b) => a - b)[0];

  const firstResponseMinutes = firstManagerTs
    ? firstManagerTs.diff(firstClientTs, 'minute')
    : null;

  // Среднее время ответа менеджера на каждое клиентское сообщение
  const responseTimes = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'client') {
      const clientTs = dayjs(messages[i].timestamp);
      // Найти ближайший ответ менеджера после этого клиентского
      const nextManagerMsg = messages
        .slice(i + 1)
        .find(m => m.role === 'manager' && dayjs(m.timestamp).isAfter(clientTs));
      if (nextManagerMsg) {
        responseTimes.push(dayjs(nextManagerMsg.timestamp).diff(clientTs, 'minute'));
      }
    }
  }

  const avgResponseMinutes = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;

  const managerId = managerMsgs[0]?.userId || null;

  return { firstResponseMinutes, avgResponseMinutes, managerId };
}

/**
 * Оценка скорости ответа (0-100).
 * @param {number|null} minutes
 */
function scoreResponseTime(minutes) {
  if (minutes === null) return 50; // нет данных
  if (minutes <= 5)    return 100;
  if (minutes <= 15)   return 85;
  if (minutes <= 30)   return 70;
  if (minutes <= 60)   return 50;
  if (minutes <= 120)  return 30;
  return 10;
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД
// ─────────────────────────────────────────────────────────────────────────

/**
 * Анализ переписки.
 *
 * @param {{ dealId: string, messages: Array<{role: string, text: string, timestamp?: string, userId?: string}> }} params
 *
 * @typedef {Object} ChatAnalysisResult
 * @property {string}       dealId
 * @property {number}       overall_score
 * @property {number}       completeness_score
 * @property {number}       tone_score
 * @property {number}       spelling_score
 * @property {number}       response_time_score
 * @property {number|null}  first_response_minutes
 * @property {number|null}  avg_response_minutes
 * @property {string|null}  managerId
 * @property {string[]}     unanswered_questions
 * @property {Object[]}     spelling_errors
 * @property {string}       tone
 * @property {string}       client_sentiment
 * @property {string}       churn_risk
 * @property {string[]}     recommendations
 * @property {string}       summary
 * @property {string}       analyzed_at
 */
async function analyzeChat({ dealId, messages }) {
  logger.info(`[chatAnalyzer] Анализ dealId=${dealId}, ${messages.length} сообщений`);

  if (!messages || messages.length === 0) {
    throw new Error('[chatAnalyzer] Нет сообщений для анализа');
  }

  // Вычислить временные метрики (не требует GPT)
  const timing = computeTimingMetrics(messages);
  const responseTimeScore = scoreResponseTime(timing.firstResponseMinutes);

  // Подготовить текст переписки для GPT
  const chatText = messages.map((m, i) => {
    const role = m.role === 'manager' ? 'Менеджер' : 'Клиент';
    const ts   = m.timestamp ? `[${dayjs(m.timestamp).format('DD.MM HH:mm')}] ` : '';
    return `${ts}${role}: ${m.text}`;
  }).join('\n');

  // GPT анализ
  let gptResult;
  try {
    const raw = await callGpt(CHAT_ANALYSIS_PROMPT, `Переписка:\n\n${chatText}`);
    gptResult = safeParseJson(raw);
  } catch (err) {
    logger.error(`[chatAnalyzer] GPT ошибка: ${err.message}`);
    // Fallback — нулевые оценки
    gptResult = {
      completeness_score:  0,
      tone_score:          0,
      spelling_score:      0,
      unanswered_questions: [],
      spelling_errors:     [],
      tone:                'neutral',
      client_sentiment:    'neutral',
      churn_risk:          'low',
      recommendations:     ['Не удалось выполнить GPT-анализ: ' + err.message],
      summary:             '',
    };
  }

  // Итоговый балл чата
  const overall_score = scorer.computeChatScore({
    completeness_score:  gptResult.completeness_score  || 0,
    tone_score:          gptResult.tone_score          || 0,
    spelling_score:      gptResult.spelling_score      || 0,
    response_time_score: responseTimeScore,
  });

  const result = {
    dealId,
    overall_score,
    completeness_score:    gptResult.completeness_score  || 0,
    tone_score:            gptResult.tone_score          || 0,
    spelling_score:        gptResult.spelling_score      || 0,
    response_time_score:   responseTimeScore,
    first_response_minutes: timing.firstResponseMinutes,
    avg_response_minutes:  timing.avgResponseMinutes,
    managerId:             timing.managerId,
    unanswered_questions:  gptResult.unanswered_questions || [],
    spelling_errors:       gptResult.spelling_errors      || [],
    tone:                  gptResult.tone                 || 'neutral',
    client_sentiment:      gptResult.client_sentiment     || 'neutral',
    churn_risk:            gptResult.churn_risk           || 'low',
    recommendations:       gptResult.recommendations     || [],
    summary:               gptResult.summary             || '',
    message_count:         messages.length,
    analyzed_at:           new Date().toISOString(),
  };

  logger.info(`[chatAnalyzer] Готово dealId=${dealId} overall=${overall_score}`);
  return result;
}

module.exports = {
  analyzeChat,
  computeTimingMetrics,
  scoreResponseTime,
};