// src/services/lmstudio.js
'use strict';

const { OpenAI } = require('openai');
const config     = require('../../config/config');
const logger     = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

const openai = new OpenAI({
  apiKey:  config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: config.openai.timeout,
});

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — AI-классификатор входящих обращений для типографии FLEX-N-ROLL PRO.

## О компании
FLEX-N-ROLL PRO — профессиональная типография, специализирующаяся на:
- **Самоклеящиеся этикетки**: бумага, PE (полиэтилен), PET (полиэстер), BOPP (биаксиально-ориентированный полипропилен), PP (полипропилен)
- **Термоусадочные sleeve-этикетки** (shrink sleeves): PVC, PET, OPS
- **AR-этикетки Live Label**: этикетки с дополненной реальностью
- **Термохромные этикетки**: этикетки с термочувствительной краской (индикаторы температуры)
- **Linerless-этикетки**: безподложечные этикетки для автоматической маркировки
- **DataMatrix / Честный ЗНАК**: маркировка товаров согласно законодательству РФ, нанесение DataMatrix-кодов

## Твоя задача
Проанализировать входящее сообщение от клиента и вернуть JSON-объект классификации.

## Поля классификации

### intent (строка, обязательное)
Тип намерения клиента:
- "quote_request"     — запрос коммерческого предложения / расчёт стоимости
- "order_placement"   — готов разместить заказ
- "reorder"           — повторный заказ (упоминает предыдущий заказ)
- "design_question"   — вопрос по макету, файлам, цветовой модели, препрессу
- "technical_issue"   — проблема с качеством, рекламация, брак
- "delivery_inquiry"  — вопрос о доставке или сроках
- "general_inquiry"   — общий вопрос, информация о компании
- "spam"              — нерелевантное сообщение

### product_type (строка, обязательное)
Категория продукта:
- "self_adhesive_paper" — самоклеящиеся этикетки (бумага)
- "self_adhesive_pe"    — самоклеящиеся этикетки (PE / полиэтилен)
- "self_adhesive_pet"   — самоклеящиеся этикетки (PET / полиэстер)
- "self_adhesive_bopp"  — самоклеящиеся этикетки (BOPP)
- "self_adhesive_pp"    — самоклеящиеся этикетки (PP / полипропилен)
- "sleeve"              — термоусадочные sleeve-этикетки
- "ar_label"            — AR-этикетки Live Label (дополненная реальность)
- "thermochrome"        — термохромные этикетки (индикатор температуры)
- "linerless"           — linerless-этикетки (безподложечные)
- "datamatrix"          — DataMatrix / Честный ЗНАК (маркировка)
- "unknown"             — продукт не определён

### urgency (строка, обязательное)
- "critical"  — нужно сегодня или завтра
- "high"      — нужно в течение 2–3 дней
- "medium"    — в течение недели
- "low"       — без жёсткого срока

### route_to (строка, обязательное)
Пул менеджеров для обработки:
- "sales"    — продажи (quote_request, order_placement, reorder, delivery_inquiry, general_inquiry)
- "tech"     — технический отдел (design_question)
- "quality"  — контроль качества (technical_issue, рекламация, брак)
- "marking"  — маркировка и этикетки DataMatrix / Честный ЗНАК

### priority (число 1–5, обязательное)
1 = HOT (критично, срочно), 5 = COLD (низкий приоритет):
- 1: срочный заказ, рекламация, готов оплатить прямо сейчас
- 2: высокая вероятность сделки, дедлайн ≤ 3 дней
- 3: стандартный запрос на КП, средние сроки
- 4: информационный запрос, нет чёткого дедлайна
- 5: спам, холодный лид, нерелевантный запрос

### auto_reply (строка, обязательное)
Готовый текст автоответа клиенту на том же языке, что и входящее сообщение.
Стиль: профессиональный, дружелюбный, без шаблонных клише. 1–3 предложения.
Укажи, что заявка принята и менеджер свяжется в течение времени согласно SLA.

### extracted_data (объект, обязательное)
Структурированные данные, извлечённые из сообщения:
{
  "quantity":       <число или null>,           // тираж / количество
  "dimensions":     <строка "ШxВ мм" или null>, // размеры этикетки
  "material":       <строка или null>,          // материал/носитель
  "deadline":       <строка или null>,          // срок в свободной форме
  "budget":         <число или null>,           // бюджет в рублях
  "contact_name":   <строка или null>,          // имя клиента
  "contact_phone":  <строка или null>,          // телефон
  "contact_email":  <строка или null>,          // email
  "has_files":      <boolean>,                  // есть ли вложенные файлы
  "company":        <строка или null>,          // название компании
  "notes":          <строка или null>           // прочие важные детали
}

## Формат ответа
Верни ТОЛЬКО валидный JSON без markdown-блоков, без пояснений.
Пример структуры:
{
  "intent": "quote_request",
  "product_type": "self_adhesive_bopp",
  "urgency": "high",
  "route_to": "sales",
  "priority": 2,
  "auto_reply": "Спасибо за обращение! Ваша заявка на BOPP-этикетки принята, менеджер свяжется с вами в течение 4 часов.",
  "extracted_data": {
    "quantity": 50000,
    "dimensions": "60x40 мм",
    "material": "BOPP белый глянцевый",
    "deadline": "к пятнице",
    "budget": null,
    "contact_name": "Алексей",
    "contact_phone": null,
    "contact_email": null,
    "has_files": false,
    "company": "ООО Ромашка",
    "notes": "Нужна высечка нестандартной формы"
  }
}`;

// ─── Valid enum values ────────────────────────────────────────────────────────
const VALID_INTENTS = new Set([
  'quote_request', 'order_placement', 'reorder', 'design_question',
  'technical_issue', 'delivery_inquiry', 'general_inquiry', 'spam',
]);

const VALID_PRODUCT_TYPES = new Set([
  'self_adhesive_paper', 'self_adhesive_pe', 'self_adhesive_pet',
  'self_adhesive_bopp', 'self_adhesive_pp', 'sleeve', 'ar_label',
  'thermochrome', 'linerless', 'datamatrix', 'unknown',
]);

const VALID_URGENCIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_ROUTES    = new Set(['sales', 'tech', 'quality', 'marking']);

/**
 * Classify an incoming client message using LM Studio AI.
 *
 * @param {object}   params
 * @param {string}   params.message        - Main message text.
 * @param {string}   [params.contactName]  - Client's name (if known).
 * @param {string}   [params.contactPhone] - Client's phone.
 * @param {string}   [params.contactEmail] - Client's email.
 * @param {string[]} [params.fileNames]    - Names of attached files.
 * @returns {Promise<object>} Classification result.
 */
async function classifyMessage({ message, contactName, contactPhone, contactEmail, fileNames = [] }) {
  const userContent = buildUserContent({ message, contactName, contactPhone, contactEmail, fileNames });

  logger.info('[lmstudio] Classifying message', {
    messageLength: message.length,
    hasFiles:      fileNames.length > 0,
  });

  const rawResponse = await withRetry(
    async (attempt) => {
      logger.debug(`[lmstudio] LLM API call attempt ${attempt}`);
      const completion = await openai.chat.completions.create({
        model:           config.openai.model,
        max_tokens:      config.openai.maxTokens,
        temperature:     config.openai.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
      });
      return completion.choices[0].message.content;
    },
    {
      label: 'lmstudio.classify',
      shouldRetry: (err) => {
        if (err.status === 429) return true;
        if (err.status >= 400 && err.status < 500) return false;
        return isTransientError(err);
      },
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (parseErr) {
    logger.error('[lmstudio] Failed to parse LLM response as JSON', {
      raw: rawResponse?.substring(0, 500),
    });
    throw new Error(`LLM returned non-JSON response: ${parseErr.message}`);
  }

  // Validate required fields
  const requiredFields = ['intent', 'product_type', 'urgency', 'route_to', 'priority', 'auto_reply', 'extracted_data'];
  const missing = requiredFields.filter((f) => !(f in parsed));
  if (missing.length) {
    logger.error('[lmstudio] LLM response missing required fields', { missing, parsed });
    throw new Error(`LLM response missing fields: ${missing.join(', ')}`);
  }

  // Sanitise enum values — never trust LLM output blindly
  if (!VALID_INTENTS.has(parsed.intent))             parsed.intent       = 'general_inquiry';
  if (!VALID_PRODUCT_TYPES.has(parsed.product_type)) parsed.product_type = 'unknown';
  if (!VALID_URGENCIES.has(parsed.urgency))          parsed.urgency      = 'medium';
  if (!VALID_ROUTES.has(parsed.route_to))            parsed.route_to     = 'sales';

  // Clamp priority to 1–5
  parsed.priority = Math.min(5, Math.max(1, parseInt(parsed.priority, 10) || 3));

  // Ensure extracted_data defaults
  const ed = parsed.extracted_data || {};
  parsed.extracted_data = {
    quantity:      ed.quantity      ?? null,
    dimensions:    ed.dimensions    ?? null,
    material:      ed.material      ?? null,
    deadline:      ed.deadline      ?? null,
    budget:        ed.budget        ?? null,
    contact_name:  ed.contact_name  ?? null,
    contact_phone: ed.contact_phone ?? null,
    contact_email: ed.contact_email ?? null,
    has_files:     Boolean(ed.has_files),
    company:       ed.company       ?? null,
    notes:         ed.notes         ?? null,
  };

  logger.info('[lmstudio] Classification complete', {
    intent:       parsed.intent,
    product_type: parsed.product_type,
    priority:     parsed.priority,
    route_to:     parsed.route_to,
  });

  return parsed;
}

/**
 * Build the user message content to send to the LLM.
 */
function buildUserContent({ message, contactName, contactPhone, contactEmail, fileNames }) {
  const lines = ['## Входящее сообщение', message];

  if (contactName || contactPhone || contactEmail) {
    lines.push('\n## Контактные данные клиента');
    if (contactName)  lines.push(`Имя: ${contactName}`);
    if (contactPhone) lines.push(`Телефон: ${contactPhone}`);
    if (contactEmail) lines.push(`Email: ${contactEmail}`);
  }

  if (fileNames.length > 0) {
    lines.push('\n## Прикреплённые файлы');
    fileNames.forEach((f) => lines.push(`- ${f}`));
  }

  return lines.join('\n');
}

module.exports = { classifyMessage, SYSTEM_PROMPT };