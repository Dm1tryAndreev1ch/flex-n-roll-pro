// server.js
// Бэкенд-прокси Node.js/Express для интеграции с Битрикс24 CRM.
// Скрывает токены и URL Б24 от браузера.
// Запуск: node server.js

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Конфигурация Битрикс24 ──────────────────────────────────────────────────
// Задайте в .env:
//   BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/token/
const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL;
const BITRIX24_DOMAIN = process.env.BITRIX24_DOMAIN;
const BITRIX24_ACCESS_TOKEN = process.env.BITRIX24_ACCESS_TOKEN;

/**
 * Вызов метода Б24 API.
 * Поддерживает webhook и OAuth.
 */
async function callBitrix24(method, params) {
  let url;
  let requestParams = { ...params };

  if (BITRIX_WEBHOOK_URL) {
    url = `${BITRIX_WEBHOOK_URL.replace(/\/$/, '')}/${method}`;
  } else if (BITRIX24_DOMAIN && BITRIX24_ACCESS_TOKEN) {
    url = `https://${BITRIX24_DOMAIN}/rest/${method}`;
    requestParams.auth = BITRIX24_ACCESS_TOKEN;
  } else {
    throw new Error('Б24 не настроен: задайте BITRIX_WEBHOOK_URL в .env');
  }

  const response = await axios.post(url, requestParams, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  if (response.data.error) {
    throw new Error(`Б24 API ошибка: ${response.data.error} — ${response.data.error_description || ''}`);
  }

  return response.data.result;
}

// ─── Словари для заголовков лида ────────────────────────────────────────────
const LABEL_TYPE_LABELS = {
  self_adhesive: 'Самоклеящаяся', sleeve: 'Sleeve (гильза)',
  ar: 'AR-этикетка', thermochrome: 'Термохром', linerless: 'Linerless',
};

const MATERIAL_LABELS = {
  semi_gloss: 'Бумага Semi Gloss', pe: 'PE (полиэтилен)', pet: 'PET',
  bopp: 'BOPP', pp_white: 'PP White', pp_silver: 'PP Silver',
  pp_clear: 'PP Clear', aluminum: 'Алюминий',
};

const FINISHING_LABELS = {
  foil_stamping: 'Тиснение фольгой', matte_lam: 'Ламинация мат',
  gloss_lam: 'Ламинация глянец', uv_varnish: 'УФ-лак (полный)',
  spot_varnish: 'Выборочный лак', none: 'Без отделки',
};

function formatUSD(value) { return `$${value.toFixed(2)}`; }

/**
 * Строит поля лида для crm.lead.add
 */
function buildLeadFields(formData, calculatorData, result) {
  const { name, company, email, phone } = formData;
  const { labelType, material, width, height, cutShape, colors, finishing, circulation, hasDesign } = calculatorData;

  const materialStr = MATERIAL_LABELS[material] || material;
  const circulationStr = circulation ? `${Number(circulation).toLocaleString('ru-RU')} шт.` : '';

  const title = `Этикетки ${materialStr} ${width}×${height} мм — ${circulationStr} | ${company || name}`;

  const comments = [
    '=== ПАРАМЕТРЫ ЗАКАЗА ===',
    `Тип этикетки: ${LABEL_TYPE_LABELS[labelType] || labelType}`,
    `Материал: ${materialStr}`,
    `Размер: ${width} × ${height} мм`,
    `Форма высечки: ${cutShape}`,
    `Количество цветов: ${colors}`,
    `Отделка: ${finishing.map((f) => FINISHING_LABELS[f] || f).join(', ')}`,
    `Тираж: ${circulationStr}`,
    `Наличие макета: ${hasDesign ? 'Есть готовый' : 'Нужна разработка (+$150)'}`,
    '',
    '=== РАСЧЁТ СТОИМОСТИ ===',
    `Базовая стоимость: ${formatUSD(result.baseCost)}`,
    result.colorSurcharge > 0 ? `Надбавка за цвета: ${formatUSD(result.colorSurcharge)}` : null,
    `Финишинг: ${formatUSD(result.finishingCost)}`,
    `Подготовка (препресс): ${formatUSD(result.setupCost)}`,
    result.designCost > 0 ? `Разработка макета: ${formatUSD(result.designCost)}` : null,
    result.discountRate > 0 ? `Скидка ${result.discountRate}%: -${formatUSD(result.discountAmount)}` : null,
    `ИТОГО: ${formatUSD(result.totalCost)}`,
    `Цена за 1000 шт.: ${formatUSD(result.pricePerThousand)}`,
    `Срок производства: ${result.productionDays}`,
  ].filter(Boolean).join('\n');

  return {
    TITLE: title,
    NAME: name.split(' ')[0] || name,
    LAST_NAME: name.split(' ').slice(1).join(' ') || '',
    COMPANY_TITLE: company || '',
    EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
    STATUS_ID: 'NEW',
    SOURCE_ID: 'WEB',
    COMMENTS: comments,
    CURRENCY_ID: 'USD',
    OPPORTUNITY: result.totalCost,
  };
}

// ─── POST /api/bitrix/lead ───────────────────────────────────────────────────
app.post('/api/bitrix/lead', async (req, res) => {
  try {
    const { formData, calculatorData, result } = req.body;

    if (!formData || !calculatorData || !result) {
      return res.status(400).json({ success: false, error: 'Отсутствуют обязательные поля' });
    }

    if (!formData.name || !formData.email || !formData.phone) {
      return res.status(400).json({ success: false, error: 'Обязательные поля: name, email, phone' });
    }

    const fields = buildLeadFields(formData, calculatorData, result);

    console.log(`[Б24] Создание лида: ${fields.TITLE}`);

    const leadId = await callBitrix24('crm.lead.add', { fields });

    console.log(`[Б24] Лид создан, ID: ${leadId}`);

    return res.json({ success: true, leadId: Number(leadId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[Б24] Ошибка:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// ─── GET /api/health ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bitrix24: BITRIX_WEBHOOK_URL ? 'webhook configured'
      : BITRIX24_DOMAIN ? 'oauth configured'
      : 'NOT CONFIGURED',
  });
});

// ─── Запуск ──────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 flex-n-roll Б24 прокси-сервер запущен на порту ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  if (!BITRIX_WEBHOOK_URL && !(BITRIX24_DOMAIN && BITRIX24_ACCESS_TOKEN)) {
    console.warn('\n⚠️  ВНИМАНИЕ: Задайте BITRIX_WEBHOOK_URL в .env\n');
  }
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n${signal} получен — завершение работы`);
  server.close(() => {
    console.log('Сервер остановлен.');
    process.exit(0);
  });
  setTimeout(() => {
    console.warn('Принудительное завершение по таймауту');
    process.exit(1);
  }, 15_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;