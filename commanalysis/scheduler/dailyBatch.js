'use strict';

/**
 * dailyBatch.js — Ежедневная ночная обработка записей звонков
 *
 * Запуск:
 *   node scheduler/dailyBatch.js          — однократный запуск (прошлый день)
 *   node scheduler/dailyBatch.js --cron   — режим cron (каждую ночь в 02:00)
 *   node scheduler/dailyBatch.js --date 2024-03-15  — конкретная дата
 *
 * Что делает:
 *  1. Получает список звонков с записями за предыдущий день из Б24
 *  2. Для каждого звонка: Whisper → callAnalyzer → reporter → Б24 комментарий
 *  3. Формирует сводный отчёт и отправляет руководителю
 */

const cron   = require('node-cron');
const dayjs  = require('dayjs');
const config = require('../config');
const logger = require('../src/utils/logger');

const whisperService = require('../src/services/whisper');
const callAnalyzer   = require('../src/services/callAnalyzer');
const bitrix         = require('../src/services/bitrix');
const reporter       = require('../src/utils/reporter');

// ── Параметры запуска ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CRON_MODE = args.includes('--cron');
const DATE_IDX  = args.indexOf('--date');
const TARGET_DATE = DATE_IDX >= 0 ? args[DATE_IDX + 1] : null;

// ─────────────────────────────────────────────────────────────────────────
//  ОБРАБОТКА ОДНОГО ЗВОНКА
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CallBatchResult
 * @property {string}  callId
 * @property {string}  dealId
 * @property {'ok'|'skip'|'error'} status
 * @property {number}  [score]
 * @property {string}  [error]
 */

/**
 * Обработать один звонок в batch-режиме.
 * @param {{ CALL_ID, RECORD_URL, CALL_START_DATE, PORTAL_USER_ID, CRM_ENTITY_ID }} callInfo
 * @param {{ language?: string }} opts
 * @returns {Promise<CallBatchResult>}
 */
async function processCall(callInfo, opts = {}) {
  const { CALL_ID: callId, CRM_ENTITY_ID: dealId, RECORD_URL: recordUrl } = callInfo;
  const lang = opts.language || config.audio.defaultLang;

  logger.info(`[batch] Обрабатываем callId=${callId} dealId=${dealId}`);

  try {
    if (!recordUrl) {
      logger.warn(`[batch] callId=${callId} — нет записи, пропускаем`);
      return { callId, dealId, status: 'skip', error: 'Нет URL записи' };
    }

    // 1. Транскрибация
    logger.info(`[batch] Транскрибация callId=${callId}...`);
    const transcript = await whisperService.transcribeFromBitrix(recordUrl, {
      language: lang,
      dealId,
    });

    if (!transcript.text || transcript.text.trim().length < 20) {
      logger.warn(`[batch] callId=${callId} — транскрипт пустой, пропускаем`);
      return { callId, dealId, status: 'skip', error: 'Пустой транскрипт' };
    }

    // 2. GPT-анализ
    logger.info(`[batch] Анализ callId=${callId}...`);
    const analysis = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo,
    });

    // 3. Получить имя менеджера и клиента
    const [managerInfo, contactInfo] = await Promise.allSettled([
      bitrix.getUserById(callInfo.PORTAL_USER_ID),
      bitrix.getContactByDealId(dealId),
    ]);

    const managerName = managerInfo.value?.NAME
      || managerInfo.value?.LAST_NAME
      || `ID:${callInfo.PORTAL_USER_ID}`;
    const clientName  = contactInfo.value?.NAME
      || contactInfo.value?.LAST_NAME
      || `Сделка #${dealId}`;

    // 4. Построить HTML-карточку
    const card = reporter.buildCard({
      dealId,
      date:    callInfo.CALL_START_DATE || new Date().toISOString(),
      manager: managerName,
      client:  clientName,
      type:    'call',
      analysis,
    });

    // 5. Сохранить карточку как комментарий к сделке
    await bitrix.addTimelineComment(dealId, card.html);

    // 6. Обновить поля сделки
    await bitrix.updateDealFields(dealId, {
      UF_CALL_SCORE: analysis.overall_score,
      UF_SENTIMENT:  analysis.sentiment?.overall_tone || '',
      UF_CHURN_RISK: analysis.sentiment?.churn_risk   || '',
    });

    logger.info(`[batch] callId=${callId} готово. score=${analysis.overall_score}`);
    return {
      callId,
      dealId,
      status:    'ok',
      score:     analysis.overall_score,
      manager:   managerName,
      client:    clientName,
      sentiment: analysis.sentiment?.overall_tone,
      churnRisk: analysis.sentiment?.churn_risk,
    };

  } catch (err) {
    logger.error(`[batch] callId=${callId} ОШИБКА: ${err.message}`);
    return { callId, dealId, status: 'error', error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  СВОДНЫЙ HTML-ОТЧЁТ ДЛЯ РУКОВОДИТЕЛЯ
// ─────────────────────────────────────────────────────────────────────────

function buildSummaryReport({ results, dateStr, totalCalls, okCount, errorCount, skipCount }) {
  const avgScore = okCount > 0
    ? Math.round(results.filter(r => r.status === 'ok').reduce((s, r) => s + (r.score || 0), 0) / okCount)
    : 0;

  const scoreColor = avgScore >= 70 ? '#155724' : avgScore >= 50 ? '#856404' : '#721c24';
  const scoreBg    = avgScore >= 70 ? '#d4edda' : avgScore >= 50 ? '#fff3cd' : '#f8d7da';

  // Таблица результатов
  const rows = results.map(r => {
    const statusColor = r.status === 'ok' ? '#155724' : r.status === 'skip' ? '#383d41' : '#721c24';
    const statusBg    = r.status === 'ok' ? '#d4edda' : r.status === 'skip' ? '#e2e3e5' : '#f8d7da';
    const statusText  = r.status === 'ok' ? '✅ Обработан' : r.status === 'skip' ? '⏭ Пропущен' : '❌ Ошибка';
    const scoreCell   = r.score != null ? `${r.score}/100` : r.error || '—';

    return `
<tr>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.dealId || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.manager || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#495057;">${r.client || '—'}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;text-align:center;">
    <span style="font-size:11px;color:${statusColor};background:${statusBg};padding:2px 8px;border-radius:12px;">${statusText}</span>
  </td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;text-align:center;font-size:12px;font-weight:600;font-family:Arial,sans-serif;color:${statusColor};">${scoreCell}</td>
  <td style="padding:7px 10px;border-bottom:1px solid #f1f3f5;font-size:12px;font-family:Arial,sans-serif;color:#6c757d;">${r.churnRisk === 'high' ? '🔴 Высокий' : r.churnRisk === 'medium' ? '🟡 Средний' : r.churnRisk === 'low' ? '🟢 Низкий' : '—'}</td>
</tr>`.trim();
  }).join('\n');

  return `
<div style="font-family:Arial,sans-serif;max-width:760px;border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;">
  
  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;">
    <tr>
      <td style="padding:18px 22px;">
        <div style="font-size:11px;color:#93b4d4;letter-spacing:1px;text-transform:uppercase;">FLEX-N-ROLL PRO</div>
        <div style="font-size:20px;color:#fff;font-weight:700;margin-top:4px;">Сводный отчёт по звонкам</div>
        <div style="font-size:13px;color:#93b4d4;margin-top:4px;">За ${dateStr}</div>
      </td>
    </tr>
  </table>

  <!-- KPI ROW -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-bottom:1px solid #dee2e6;">
    <tr>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Всего звонков</div>
        <div style="font-size:28px;font-weight:800;color:#1e3a5f;">${totalCalls}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Обработано</div>
        <div style="font-size:28px;font-weight:800;color:#155724;">${okCount}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Средний балл</div>
        <div style="font-size:28px;font-weight:800;color:${scoreColor};background:${scoreBg};border-radius:50%;width:56px;height:56px;line-height:56px;margin:0 auto;">${avgScore}</div>
      </td>
      <td style="padding:16px;text-align:center;border-right:1px solid #dee2e6;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Риск оттока (high)</div>
        <div style="font-size:28px;font-weight:800;color:#721c24;">${results.filter(r => r.churnRisk === 'high').length}</div>
      </td>
      <td style="padding:16px;text-align:center;">
        <div style="font-size:10px;color:#6c757d;text-transform:uppercase;font-weight:600;">Ошибки</div>
        <div style="font-size:28px;font-weight:800;color:#6c757d;">${errorCount}</div>
      </td>
    </tr>
  </table>

  <!-- TABLE -->
  <div style="padding:16px 20px;">
    <div style="font-size:13px;font-weight:700;color:#343a40;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">
      Детали по каждому звонку
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dee2e6;border-radius:6px;overflow:hidden;">
      <tr style="background:#f8f9fa;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Сделка</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Менеджер</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Клиент</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Статус</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Балл</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;border-bottom:1px solid #dee2e6;">Риск оттока</th>
      </tr>
      ${rows}
    </table>
  </div>

  <!-- FOOTER -->
  <div style="padding:10px 20px;background:#f8f9fa;border-top:1px solid #dee2e6;text-align:right;">
    <span style="font-size:10px;color:#adb5bd;">
      FLEX-N-ROLL AI CommAnalysis · batch ${new Date().toISOString()}
    </span>
  </div>
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНАЯ ФУНКЦИЯ BATCH-ОБРАБОТКИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Запустить batch-обработку за конкретную дату.
 * @param {string} [targetDate]  — 'YYYY-MM-DD', по умолчанию вчера
 */
async function runDailyBatch(targetDate) {
  const date    = targetDate ? dayjs(targetDate) : dayjs().subtract(1, 'day');
  const dateStr = date.format('DD.MM.YYYY');
  const dateFrom = date.startOf('day').toISOString();
  const dateTo   = date.endOf('day').toISOString();

  // Previous month calculation (correct year rollover in January)
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const reportMonth = month > 1 ? month - 1 : 12;
  const reportYear = month === 1 ? year - 1 : year;

  logger.info(`[batch] ==========================================`);
  logger.info(`[batch] Запуск batch-обработки за ${dateStr}`);
  logger.info(`[batch] ==========================================`);

  let calls = [];
  try {
    calls = await bitrix.getCallsForDay(dateFrom, dateTo);
  } catch (err) {
    logger.error(`[batch] Ошибка получения звонков из Б24: ${err.message}`);
    return;
  }

  logger.info(`[batch] Найдено ${calls.length} звонков с записями за ${dateStr}`);

  if (calls.length === 0) {
    logger.info('[batch] Нет звонков для обработки, выходим');
    return;
  }

  // Обработать каждый звонок последовательно (избегаем rate limit OpenAI)
  const results = [];
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    logger.info(`[batch] ${i + 1}/${calls.length} callId=${call.CALL_ID}`);

    const result = await processCall(call);
    results.push(result);

    // Пауза между запросами (rate limit: ~3 RPM на GPT-4)
    if (i < calls.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ── Статистика ──────────────────────────────────────────────────────────
  const okCount    = results.filter(r => r.status === 'ok').length;
  const skipCount  = results.filter(r => r.status === 'skip').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const avgScore   = okCount > 0
    ? Math.round(results.filter(r => r.status === 'ok').reduce((s, r) => s + (r.score || 0), 0) / okCount)
    : 0;
  const highRiskCount = results.filter(r => r.churnRisk === 'high').length;

  logger.info(`[batch] Результаты: OK=${okCount} SKIP=${skipCount} ERR=${errorCount} AVG_SCORE=${avgScore}`);

  // ── Сводный отчёт руководителю ──────────────────────────────────────────
  const summaryHtml = buildSummaryReport({
    results,
    dateStr,
    totalCalls:  calls.length,
    okCount,
    errorCount,
    skipCount,
  });

  // Текстовое уведомление + HTML-отчёт
  const notifText =
    `📊 Отчёт AI-анализа звонков за ${dateStr}\n` +
    `Всего: ${calls.length} | Обработано: ${okCount} | Средний балл: ${avgScore}/100\n` +
    `🔴 Высокий риск оттока: ${highRiskCount} клиентов\n` +
    `Подробный отчёт добавлен в комментарии к каждой сделке.`;

  try {
    // Уведомление в Б24
    await bitrix.sendNotification(config.reports.managerUserId, notifText);

    // HTML-отчёт как задача руководителю
    const tomorrow = dayjs().add(1, 'day').endOf('day').toISOString();
    await bitrix.createTask(
      config.reports.managerUserId,
      `AI-отчёт по звонкам за ${dateStr}: ${okCount} обработано, средний балл ${avgScore}`,
      summaryHtml,
      tomorrow
    );

    logger.info(`[batch] Сводный отчёт отправлен руководителю (userId=${config.reports.managerUserId})`);
  } catch (err) {
    logger.error(`[batch] Не удалось отправить отчёт: ${err.message}`);
  }

  logger.info(`[batch] ==========================================`);
  logger.info(`[batch] Batch завершён за ${dateStr}`);
  logger.info(`[batch] ==========================================`);

  return { okCount, skipCount, errorCount, avgScore, highRiskCount };
}

// ─────────────────────────────────────────────────────────────────────────
//  CRON / ЗАПУСК
// ─────────────────────────────────────────────────────────────────────────

if (CRON_MODE) {
  // Ежедневно в 02:00 по серверному времени (Минск: UTC+3)
  logger.info('[batch] Запущен в режиме cron. Расписание: 02:00 каждую ночь');
  cron.schedule('0 2 * * *', () => {
    logger.info('[batch] Cron-триггер: запускаем ночную обработку');
    runDailyBatch().catch(err => {
      logger.error(`[batch] Cron ошибка: ${err.message}`);
    });
  }, {
    scheduled: true,
    timezone: 'Europe/Minsk',
  });
} else {
  // Однократный запуск
  const targetDate = TARGET_DATE || null;
  runDailyBatch(targetDate)
    .then(stats => {
      if (stats) {
        logger.info(`[batch] Готово. OK=${stats.okCount} ERR=${stats.errorCount} AVG=${stats.avgScore}`);
      }
      process.exit(0);
    })
    .catch(err => {
      logger.error(`[batch] Критическая ошибка: ${err.message}`);
      process.exit(1);
    });
}