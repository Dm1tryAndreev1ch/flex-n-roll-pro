'use strict';

/**
 * scorer.js — Подсчёт итоговых баллов коммуникации
 *
 * Веса для итогового балла звонка:
 *  - Скрипт продаж:  60%
 *  - Sentiment / тональность: 25%
 *  - Штраф за высокий риск оттока: -15
 */

// ── Вспомогательные ────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, Math.round(v)));

/**
 * Перевести тональность в числовой балл.
 * @param {'positive'|'neutral'|'negative'} tone
 * @returns {number} 0-100
 */
function toneToScore(tone) {
  switch (tone) {
    case 'positive': return 90;
    case 'neutral':  return 65;
    case 'negative': return 25;
    default:         return 50;
  }
}

/**
 * Перевести риск оттока в штраф.
 * @param {'low'|'medium'|'high'} risk
 * @returns {number} штраф (0, -8, -15)
 */
function churnPenalty(risk) {
  switch (risk) {
    case 'high':   return 15;
    case 'medium': return 8;
    default:       return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  ИТОГОВЫЙ БАЛЛ ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Рассчитать итоговый балл звонка.
 *
 * @param {{ script_score: number, sentiment: object, extractedData: object }} params
 * @returns {number} 0-100
 */
function computeOverallScore({ script_score, sentiment, extractedData }) {
  // Базовые компоненты
  const scriptWeight    = 0.60;
  const sentimentWeight = 0.25;
  const dataWeight      = 0.15;

  // Балл скрипта
  const scriptComp = (script_score || 0) * scriptWeight;

  // Балл тональности
  const overallToneScore = toneToScore(sentiment?.overall_tone || 'neutral');
  const clientToneScore  = sentiment?.client_tone === 'interest' ? 90
    : sentiment?.client_tone === 'neutral'    ? 65
    : sentiment?.client_tone === 'skepticism' ? 45
    : 20; // irritation

  const sentimentComp = ((overallToneScore + clientToneScore) / 2) * sentimentWeight;

  // Балл полноты извлечённых данных (наличие ключевых полей)
  let dataScore = 0;
  if (extractedData) {
    if (extractedData.product?.type)            dataScore += 25;
    if (extractedData.product?.quantity > 0)    dataScore += 20;
    if (extractedData.agreements?.next_step)    dataScore += 25;
    if (extractedData.contacts?.name)           dataScore += 15;
    if (extractedData.deadline)                 dataScore += 15;
  }
  const dataComp = dataScore * dataWeight;

  // Штраф за риск оттока
  const penalty = churnPenalty(sentiment?.churn_risk || 'low');

  const raw = scriptComp + sentimentComp + dataComp - penalty;
  return clamp(raw, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────
//  ИТОГОВЫЙ БАЛЛ ЧАТА
// ─────────────────────────────────────────────────────────────────────────

/**
 * Рассчитать итоговый балл переписки.
 *
 * @param {{ completeness_score, tone_score, spelling_score, response_time_score }} params
 * @returns {number} 0-100
 */
function computeChatScore({ completeness_score, tone_score, spelling_score, response_time_score }) {
  const weights = {
    completeness:    0.35,
    tone:            0.25,
    spelling:        0.15,
    response_time:   0.25,
  };

  const raw =
    (completeness_score  || 0) * weights.completeness  +
    (tone_score          || 0) * weights.tone          +
    (spelling_score      || 0) * weights.spelling      +
    (response_time_score || 0) * weights.response_time;

  return clamp(raw, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────
//  ЦВЕТОВОЙ ИНДИКАТОР
// ─────────────────────────────────────────────────────────────────────────

/**
 * Вернуть CSS-цвет и текстовую метку для балла.
 * @param {number} score  0-100
 * @returns {{ color: string, bg: string, label: string, emoji: string }}
 */
function scoreToIndicator(score) {
  if (score >= 85) return { color: '#1a7a4a', bg: '#d4edda', label: 'Отлично',       emoji: '🟢' };
  if (score >= 70) return { color: '#1a6a2e', bg: '#b8ddc8', label: 'Хорошо',        emoji: '🟢' };
  if (score >= 50) return { color: '#856404', bg: '#fff3cd', label: 'Удовлетворит.', emoji: '🟡' };
  if (score >= 30) return { color: '#721c24', bg: '#f8d7da', label: 'Слабо',         emoji: '🟠' };
  return               { color: '#491217', bg: '#f5c6cb', label: 'Критично',       emoji: '🔴' };
}

/**
 * Вернуть CSS-цвет для тональности.
 * @param {'positive'|'neutral'|'negative'} tone
 */
function toneToColor(tone) {
  switch (tone) {
    case 'positive': return { color: '#155724', bg: '#d4edda', text: 'Позитивный' };
    case 'negative': return { color: '#721c24', bg: '#f8d7da', text: 'Негативный' };
    default:         return { color: '#383d41', bg: '#e2e3e5', text: 'Нейтральный' };
  }
}

/**
 * Вернуть CSS-цвет для риска оттока.
 * @param {'low'|'medium'|'high'} risk
 */
function riskToColor(risk) {
  switch (risk) {
    case 'high':   return { color: '#721c24', bg: '#f8d7da', text: 'Высокий'   };
    case 'medium': return { color: '#856404', bg: '#fff3cd', text: 'Средний'   };
    default:       return { color: '#155724', bg: '#d4edda', text: 'Низкий'    };
  }
}

module.exports = {
  computeOverallScore,
  computeChatScore,
  scoreToIndicator,
  toneToColor,
  riskToColor,
  toneToScore,
};