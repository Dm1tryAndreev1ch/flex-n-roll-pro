'use strict';

/**
 * reporter.js — Генерация HTML-карточки оценки коммуникации
 *
 * Карточка содержит:
 *  - Шапка: дата, менеджер, клиент, тип коммуникации
 *  - Общий балл с цветовым индикатором
 *  - Детальные оценки по каждому критерию
 *  - Цитаты из разговора
 *  - Рекомендации по улучшению
 *
 * Готовая карточка сохраняется как комментарий к сделке через
 * crm.timeline.comment.add
 */

const dayjs  = require('dayjs');
const scorer = require('./scorer');

// ── Утилиты HTML ───────────────────────────────────────────────────────────
const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// ── Пункты скрипта: человеческие названия ─────────────────────────────────
const SCRIPT_ITEMS = {
  greeting:            'Приветствие и представление',
  needs_discovery:     'Выявление потребности (3+ вопросов)',
  product_pitch:       'Презентация продукта / УТП',
  objection_handling:  'Работа с возражениями',
  closing:             'Закрытие (следующий шаг)',
  contact_collection:  'Сбор контактных данных',
  farewell:            'Прощание',
};

const SCRIPT_WEIGHTS = {
  greeting:           10,
  needs_discovery:    20,
  product_pitch:      20,
  objection_handling: 15,
  closing:            20,
  contact_collection: 10,
  farewell:            5,
};

// ─────────────────────────────────────────────────────────────────────────
//  СТРОИТЕЛИ СЕКЦИЙ HTML
// ─────────────────────────────────────────────────────────────────────────

function buildHeaderSection({ date, manager, client, type, dealId }) {
  const typeLabel = type === 'call' ? '📞 Звонок' : '💬 Переписка';
  const dateStr   = dayjs(date).format('DD.MM.YYYY HH:mm');

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;border-radius:8px 8px 0 0;margin-bottom:0;">
  <tr>
    <td style="padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
              FLEX-N-ROLL PRO — Анализ коммуникации
            </div>
            <div style="font-size:18px;color:#ffffff;font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">
              ${esc(typeLabel)} — Сделка #${esc(dealId)}
            </div>
          </td>
          <td align="right" valign="top">
            <div style="font-size:12px;color:#93b4d4;font-family:Arial,sans-serif;">${esc(dateStr)}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:12px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:24px;">
                  <span style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;">МЕНЕДЖЕР</span><br>
                  <span style="font-size:14px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">${esc(manager)}</span>
                </td>
                <td>
                  <span style="font-size:11px;color:#93b4d4;font-family:Arial,sans-serif;">КЛИЕНТ</span><br>
                  <span style="font-size:14px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">${esc(client)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function buildScoreBadge(score) {
  const ind = scorer.scoreToIndicator(score);
  const pct = score;

  // Прогресс-бар
  const barColor = score >= 70 ? '#28a745' : score >= 50 ? '#ffc107' : '#dc3545';

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-bottom:1px solid #dee2e6;">
  <tr>
    <td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="120" align="center" valign="middle">
            <div style="width:90px;height:90px;border-radius:50%;background:${ind.bg};border:4px solid ${ind.color};display:inline-flex;align-items:center;justify-content:center;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:${ind.color};font-family:Arial,sans-serif;line-height:1;">${pct}</div>
            </div>
            <div style="font-size:12px;color:${ind.color};font-family:Arial,sans-serif;font-weight:700;text-align:center;margin-top:4px;">${ind.label}</div>
          </td>
          <td style="padding-left:20px;vertical-align:middle;">
            <div style="font-size:13px;color:#495057;font-family:Arial,sans-serif;margin-bottom:8px;font-weight:600;">ОБЩИЙ БАЛЛ КОММУНИКАЦИИ</div>
            <div style="background:#e9ecef;border-radius:4px;height:12px;overflow:hidden;width:100%;">
              <div style="background:${barColor};height:12px;width:${pct}%;border-radius:4px;"></div>
            </div>
            <div style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;margin-top:6px;">${pct} из 100 баллов</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function buildScriptSection(script) {
  if (!script) return '';

  const allItems = Object.keys(SCRIPT_ITEMS);
  const rows = allItems.map(key => {
    const passed  = script.passed_items?.includes(key);
    const detail  = script.details?.[key] || {};
    const weight  = SCRIPT_WEIGHTS[key];
    const icon    = passed ? '✅' : '❌';
    const bgColor = passed ? '#f0fff4' : '#fff5f5';
    const bdColor = passed ? '#c3e6cb' : '#f5c6cb';

    let extra = '';
    if (detail.quote) {
      extra += `<div style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;font-style:italic;margin-top:3px;padding-left:8px;border-left:2px solid #dee2e6;">«${esc(detail.quote)}»</div>`;
    }
    if (detail.comment) {
      extra += `<div style="font-size:11px;color:#495057;font-family:Arial,sans-serif;margin-top:3px;">${esc(detail.comment)}</div>`;
    }

    return `
<tr>
  <td style="padding:8px 12px;background:${bgColor};border-left:3px solid ${bdColor};border-bottom:1px solid #f1f3f5;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="font-size:14px;margin-right:6px;">${icon}</span>
          <span style="font-size:13px;font-weight:600;color:#343a40;font-family:Arial,sans-serif;">${esc(SCRIPT_ITEMS[key])}</span>
          ${extra}
        </td>
        <td align="right" valign="top" nowrap>
          <span style="font-size:11px;color:#6c757d;font-family:Arial,sans-serif;">${weight} баллов</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`.trim();
  });

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    Проверка скрипта продаж — ${script.script_score || 0}/100
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #dee2e6;">
    ${rows.join('\n')}
  </table>
</div>`.trim();
}

function buildSentimentSection(sentiment) {
  if (!sentiment) return '';

  const toneInd  = scorer.toneToColor(sentiment.overall_tone);
  const riskInd  = scorer.riskToColor(sentiment.churn_risk);

  const negMoments = (sentiment.negative_moments || []).slice(0, 3).map(m => `
<tr>
  <td style="padding:6px 10px;border-bottom:1px solid #f1f3f5;">
    <div style="font-size:11px;color:#721c24;font-family:Arial,sans-serif;font-style:italic;">«${esc(m.quote)}»</div>
    <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;margin-top:2px;">${esc(m.reason)}</div>
  </td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    Тональность и риски
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:${toneInd.bg};border:1px solid ${toneInd.color}33;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:${toneInd.color};font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Тон звонка</div>
          <div style="font-size:16px;color:${toneInd.color};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${esc(toneInd.text)}</div>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:${riskInd.bg};border:1px solid ${riskInd.color}33;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:${riskInd.color};font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Риск оттока</div>
          <div style="font-size:16px;color:${riskInd.color};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${esc(riskInd.text)}</div>
        </div>
      </td>
    </tr>
  </table>

  ${sentiment.summary ? `<div style="font-size:12px;color:#495057;font-family:Arial,sans-serif;font-style:italic;background:#f8f9fa;border-left:3px solid #6c757d;padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;">${esc(sentiment.summary)}</div>` : ''}

  ${negMoments ? `
  <div style="font-size:12px;font-weight:600;color:#721c24;font-family:Arial,sans-serif;margin-bottom:6px;">⚠ Негативные моменты</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f5c6cb;border-radius:6px;overflow:hidden;margin-bottom:12px;">
    ${negMoments}
  </table>` : ''}
</div>`.trim();
}

function buildRecommendationsSection(recommendations) {
  if (!recommendations?.length) return '';

  const items = recommendations.map((r, i) => `
<tr>
  <td style="padding:7px 12px;border-bottom:1px solid #e9ecef;">
    <span style="font-size:13px;color:#0c5460;font-family:Arial,sans-serif;">
      <strong>${i + 1}.</strong> ${esc(r)}
    </span>
  </td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    💡 Рекомендации по улучшению
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#d1ecf1;border:1px solid #bee5eb;border-radius:6px;overflow:hidden;">
    ${items}
  </table>
</div>`.trim();
}

function buildExtractedDataSection(extracted) {
  if (!extracted) return '';

  const product = extracted.product || {};
  const agreements = extracted.agreements || {};
  const contacts   = extracted.contacts   || {};

  const rows = [];

  if (product.type)        rows.push(['Тип продукта',   product.type]);
  if (product.material)    rows.push(['Материал',        product.material]);
  if (product.size)        rows.push(['Размер',          product.size]);
  if (product.quantity)    rows.push(['Тираж',           product.quantity + ' шт.']);
  if (extracted.deadline)  rows.push(['Дедлайн',         extracted.deadline]);
  if (extracted.budget)    rows.push(['Бюджет',          extracted.budget]);
  if (agreements.next_step)rows.push(['Следующий шаг',   agreements.next_step]);
  if (agreements.followup_date) rows.push(['Дата followup', agreements.followup_date]);
  if (contacts.name)       rows.push(['Контакт',         contacts.name]);
  if (contacts.phone)      rows.push(['Телефон',         contacts.phone]);

  if (!rows.length) return '';

  const cells = rows.map(([k, v]) => `
<tr>
  <td style="padding:6px 12px;background:#f8f9fa;font-size:11px;font-weight:600;color:#6c757d;font-family:Arial,sans-serif;width:35%;border-bottom:1px solid #e9ecef;">${esc(k)}</td>
  <td style="padding:6px 12px;font-size:12px;color:#343a40;font-family:Arial,sans-serif;border-bottom:1px solid #e9ecef;">${esc(v)}</td>
</tr>`).join('');

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    📋 Извлечённые данные
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dee2e6;border-radius:6px;overflow:hidden;">
    ${cells}
  </table>
</div>`.trim();
}

function buildChatMetricsSection(analysis) {
  if (!analysis.first_response_minutes && !analysis.avg_response_minutes) return '';

  const frm = analysis.first_response_minutes;
  const arm = analysis.avg_response_minutes;

  const frmColor = frm === null ? '#6c757d'
    : frm <= 5 ? '#155724' : frm <= 30 ? '#856404' : '#721c24';

  return `
<div style="padding:16px 20px 0;">
  <div style="font-size:13px;font-weight:700;color:#343a40;font-family:Arial,sans-serif;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
    ⏱ Скорость ответов
  </div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Первый ответ</div>
          <div style="font-size:20px;color:${frmColor};font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${frm !== null ? frm + ' мин' : '—'}</div>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:#6c757d;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;">Среднее время ответа</div>
          <div style="font-size:20px;color:#343a40;font-family:Arial,sans-serif;font-weight:700;margin-top:4px;">${arm !== null ? arm + ' мин' : '—'}</div>
        </div>
      </td>
    </tr>
  </table>
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ МЕТОД: buildCard
// ─────────────────────────────────────────────────────────────────────────

/**
 * Построить HTML-карточку коммуникации.
 *
 * @param {{
 *   dealId: string,
 *   date: string,
 *   manager: string,
 *   client: string,
 *   type: 'call'|'chat',
 *   analysis: object
 * }} params
 * @returns {{ html: string, score: number }}
 */
function buildCard({ dealId, date, manager, client, type, analysis }) {
  const score = analysis.overall_score || 0;

  // Собираем все рекомендации в одно место
  const allRecs = [
    ...(analysis.script?.recommendations || []),
    ...(analysis.recommendations         || []),
  ].filter(Boolean);

  const sections = [
    buildHeaderSection({ date, manager, client, type, dealId }),
    buildScoreBadge(score),
    type === 'call'
      ? buildScriptSection(analysis.script)
      : buildChatMetricsSection(analysis),
    buildSentimentSection(type === 'call' ? analysis.sentiment : {
      overall_tone: analysis.client_sentiment === 'positive' ? 'positive'
        : analysis.client_sentiment === 'negative' ? 'negative' : 'neutral',
      churn_risk:   analysis.churn_risk || 'low',
      summary:      analysis.summary   || '',
      negative_moments: [],
    }),
    type === 'call' ? buildExtractedDataSection(analysis.extracted) : '',
    buildRecommendationsSection(allRecs),
  ];

  const body = sections.filter(Boolean).join('\n');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  ${body}
  <div style="padding:12px 20px;background:#f8f9fa;border-top:1px solid #dee2e6;text-align:right;">
    <span style="font-size:10px;color:#adb5bd;font-family:Arial,sans-serif;">
      Сгенерировано FLEX-N-ROLL AI CommAnalysis · ${dayjs().format('DD.MM.YYYY HH:mm')}
    </span>
  </div>
</div>`.trim();

  return { html, score };
}

module.exports = { buildCard };