'use strict';

/**
 * reporter.js — Генерация отчётов по маркировке
 *
 * 1. HTML-отчёт для клиента: список нанесённых кодов с QR
 * 2. XML-отчёт для налоговых органов (по структуре ФНС)
 * 3. Ежемесячная сводка: количество кодов по категориям
 */

const fs = require('fs');
const path = require('path');
const { generateQrDataUrl } = require('./datamatrix');
const config = require('../../config');
const logger = require('./logger');

const reportsDir = path.join(config.storage.dataDir, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1. HTML-отчёт для клиента
// ---------------------------------------------------------------------------

/**
 * Генерирует HTML-файл отчёта для клиента с QR-кодами нанесённых кодов DM.
 *
 * @param {object} params
 * @param {string}   params.dealId
 * @param {string}   params.dealTitle
 * @param {string}   params.productCategory
 * @param {string}   params.gtin
 * @param {string[]} params.codes          — нанесённые коды DataMatrix
 * @param {string}   [params.orderId]      — номер заявки ГИС МТ
 * @returns {Promise<string>} путь к HTML-файлу
 */
async function generateClientReport({ dealId, dealTitle, productCategory, gtin, codes, orderId }) {
  logger.info(`[reporter] Генерация HTML-отчёта для сделки ${dealId}, кодов: ${codes.length}`);

  const rows = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const qrDataUrl = await generateQrDataUrl(code, { width: 120 }).catch(() => '');
    const serial = i + 1;
    rows.push(`
      <tr>
        <td>${serial}</td>
        <td class="code-cell"><code>${escapeHtml(code)}</code></td>
        <td>${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR #${serial}" width="80">` : '—'}</td>
        <td><span class="badge applied">Нанесён</span></td>
      </tr>`);
  }

  const date = new Date().toLocaleDateString('ru-RU', { dateStyle: 'long' });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Отчёт маркировки — ${escapeHtml(dealTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; color: #1a1a2e; }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff; padding: 32px 48px;
    }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { opacity: .7; font-size: 13px; }
    .logo { font-size: 11px; text-transform: uppercase; letter-spacing: .15em;
            opacity: .5; margin-bottom: 12px; }
    .container { max-width: 1200px; margin: 32px auto; padding: 0 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                 gap: 16px; margin-bottom: 32px; }
    .meta-card { background: #fff; border-radius: 8px; padding: 16px 20px;
                 box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .meta-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
                        color: #888; margin-bottom: 4px; }
    .meta-card .value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .section { background: #fff; border-radius: 8px; padding: 24px;
               box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 24px; }
    .section h2 { font-size: 16px; margin-bottom: 16px; border-bottom: 2px solid #e8eaf0;
                  padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f2f8; text-align: left; padding: 10px 12px;
         font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #555; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f2f8; vertical-align: middle; }
    .code-cell { font-size: 11px; max-width: 320px; word-break: break-all; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
             font-size: 11px; font-weight: 600; }
    .badge.applied { background: #e8f5e9; color: #2e7d32; }
    .footer { text-align: center; font-size: 12px; color: #aaa;
              padding: 32px 0; margin-top: 16px; }
    @media print { body { background: #fff; } .header { background: #1a1a2e !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FLEX-N-ROLL PRO — Система маркировки</div>
    <h1>${escapeHtml(dealTitle)}</h1>
    <p>Отчёт о нанесении кодов «Честный ЗНАК» · Сформирован: ${date}</p>
  </div>
  <div class="container">
    <div class="meta-grid">
      <div class="meta-card">
        <div class="label">Сделка B24</div>
        <div class="value">#${escapeHtml(String(dealId))}</div>
      </div>
      <div class="meta-card">
        <div class="label">Товарная группа</div>
        <div class="value">${escapeHtml(productCategory)}</div>
      </div>
      <div class="meta-card">
        <div class="label">GTIN</div>
        <div class="value" style="font-size:14px">${escapeHtml(gtin)}</div>
      </div>
      <div class="meta-card">
        <div class="label">Заявка ГИС МТ</div>
        <div class="value" style="font-size:14px">${escapeHtml(orderId || '—')}</div>
      </div>
      <div class="meta-card">
        <div class="label">Всего кодов</div>
        <div class="value">${codes.length}</div>
      </div>
      <div class="meta-card">
        <div class="label">Статус</div>
        <div class="value" style="color:#2e7d32">Нанесено</div>
      </div>
    </div>

    <div class="section">
      <h2>Коды DataMatrix — нанесённые на продукцию</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Код DataMatrix</th>
            <th>QR-код</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div class="footer">
    FLEX-N-ROLL PRO · Типография · Партнёр Честного ЗНАКа · ${date}
  </div>
</body>
</html>`;

  const outPath = path.join(reportsDir, `client_${dealId}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  logger.info(`[reporter] HTML-отчёт сохранён: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// 2. XML-отчёт для налоговых органов (структура ФНС)
// ---------------------------------------------------------------------------

/**
 * Генерирует XML-файл отчёта по стандарту, принятому для ФНС / ГИС МТ.
 *
 * @param {object} params
 * @param {string}   params.dealId
 * @param {string}   params.dealTitle
 * @param {string}   params.gtin
 * @param {string}   params.productCategory
 * @param {string[]} params.codes
 * @param {string}   [params.inn]       — ИНН участника оборота
 * @param {string}   [params.orderId]
 * @returns {string} путь к XML-файлу
 */
function generateFnsXmlReport({ dealId, dealTitle, gtin, productCategory, codes, inn, orderId }) {
  logger.info(`[reporter] Генерация XML-отчёта для сделки ${dealId}`);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const codeItems = codes
    .map((c, i) =>
      `    <Код>\n` +
      `      <Номер>${i + 1}</Номер>\n` +
      `      <ЗначениеДМ><![CDATA[${c}]]></ЗначениеДМ>\n` +
      `      <Статус>НАНЕСЁН</Статус>\n` +
      `    </Код>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Отчёт о нанесении кодов маркировки. Типография FLEX-N-ROLL PRO -->
<!-- Участник оборота товаров — партнёр системы «Честный ЗНАК» -->
<ОтчётМаркировки
  xmlns:xs="http://www.w3.org/2001/XMLSchema-instance"
  ВерсияФормата="1.0"
  ДатаФормирования="${dateStr}"
  ВремяФормирования="${timeStr}">

  <УчастникОборота>
    <ИНН>${escapeXml(inn || config.mdlp.participantInn)}</ИНН>
    <НаименованиеОрганизации>FLEX-N-ROLL PRO</НаименованиеОрганизации>
    <РольУчастника>ТИПОГРАФИЯ</РольУчастника>
  </УчастникОборота>

  <СведенияОТоваре>
    <GTIN>${escapeXml(gtin)}</GTIN>
    <ТоварнаяГруппа>${escapeXml(productCategory)}</ТоварнаяГруппа>
    <НомерЗаявкиГИСМТ>${escapeXml(orderId || '')}</НомерЗаявкиГИСМТ>
    <ИдентификаторСделкиБ24>${escapeXml(String(dealId))}</ИдентификаторСделкиБ24>
    <НаименованиеЗаказа>${escapeXml(dealTitle)}</НаименованиеЗаказа>
  </СведенияОТоваре>

  <СведенияОНанесении>
    <ДатаНанесения>${dateStr}</ДатаНанесения>
    <КоличествоКодов>${codes.length}</КоличествоКодов>
    <КодыМаркировки>
${codeItems}
    </КодыМаркировки>
  </СведенияОНанесении>

</ОтчётМаркировки>`;

  const outPath = path.join(reportsDir, `fns_${dealId}.xml`);
  fs.writeFileSync(outPath, xml, 'utf8');
  logger.info(`[reporter] XML-отчёт ФНС сохранён: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// 3. Ежемесячная сводка
// ---------------------------------------------------------------------------

/**
 * Генерирует ежемесячную сводку по всем сделкам из codes_db.json.
 * Группирует по товарным категориям.
 *
 * @param {number} year
 * @param {number} month  — 1-12
 * @returns {Promise<string>} путь к HTML-файлу сводки
 */
async function generateMonthlySummary(year, month) {
  logger.info(`[reporter] Генерация сводки за ${year}-${String(month).padStart(2, '0')}`);

  // Читаем все записи из БД
  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(config.storage.codesDbPath, 'utf8'));
  } catch {
    db = {};
  }

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  // Фильтруем по месяцу (по createdAt)
  const entries = Object.values(db).filter((e) => {
    if (!e.createdAt) return false;
    return e.createdAt.startsWith(monthStr);
  });

  // Группируем по productGroup
  const byGroup = {};
  for (const e of entries) {
    const g = e.productGroup || 'unknown';
    if (!byGroup[g]) byGroup[g] = { count: 0, deals: 0, verified: 0, shipped: 0 };
    byGroup[g].deals += 1;
    byGroup[g].count += e.codesCount || (e.codes?.length ?? 0);
    if (['VERIFIED', 'SHIPPED'].includes(e.status)) byGroup[g].verified += 1;
    if (e.status === 'SHIPPED') byGroup[g].shipped += 1;
  }

  const totalCodes = entries.reduce((s, e) => s + (e.codesCount || e.codes?.length || 0), 0);

  const rows = Object.entries(byGroup).map(([group, stats]) =>
    `<tr>
      <td>${escapeHtml(group)}</td>
      <td>${stats.deals}</td>
      <td>${stats.count.toLocaleString('ru-RU')}</td>
      <td>${stats.verified}</td>
      <td>${stats.shipped}</td>
    </tr>`
  ).join('\n');

  const monthLabel = new Date(year, month - 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Сводка маркировки — ${monthLabel}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;color:#1a1a2e;margin:0}
    .header{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:32px 48px}
    .header h1{font-size:22px;margin-bottom:4px}
    .header p{opacity:.6;font-size:13px}
    .container{max-width:900px;margin:32px auto;padding:0 24px}
    .kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
    .kpi-card{background:#fff;border-radius:8px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .kpi-card .l{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px}
    .kpi-card .v{font-size:26px;font-weight:700}
    .section{background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .section h2{font-size:15px;margin-bottom:16px;border-bottom:2px solid #e8eaf0;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f0f2f8;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;color:#555}
    td{padding:10px 12px;border-bottom:1px solid #f0f2f8}
    .footer{text-align:center;font-size:12px;color:#aaa;padding:32px 0}
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.15em;opacity:.5;margin-bottom:8px">FLEX-N-ROLL PRO</div>
    <h1>Сводка маркировки — ${monthLabel}</h1>
    <p>Ежемесячный отчёт по нанесению кодов «Честный ЗНАК»</p>
  </div>
  <div class="container">
    <div class="kpi">
      <div class="kpi-card"><div class="l">Всего сделок</div><div class="v">${entries.length}</div></div>
      <div class="kpi-card"><div class="l">Всего кодов</div><div class="v">${totalCodes.toLocaleString('ru-RU')}</div></div>
      <div class="kpi-card"><div class="l">Категорий</div><div class="v">${Object.keys(byGroup).length}</div></div>
    </div>
    <div class="section">
      <h2>По товарным группам</h2>
      <table>
        <thead>
          <tr><th>Группа</th><th>Сделки</th><th>Коды</th><th>Верифицировано</th><th>Отгружено</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Данные за период отсутствуют</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <div class="footer">Сформирован ${new Date().toLocaleDateString('ru-RU', {dateStyle:'long'})} · FLEX-N-ROLL PRO</div>
</body>
</html>`;

  const outPath = path.join(reportsDir, `monthly_${monthStr}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  logger.info(`[reporter] Сводка сохранена: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------
module.exports = {
  generateClientReport,
  generateFnsXmlReport,
  generateMonthlySummary,
};