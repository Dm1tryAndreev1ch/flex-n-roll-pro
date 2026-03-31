// src/services/lmstudio.js
'use strict';

const { OpenAI } = require('openai');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { withRetry, isTransientError } = require('../utils/retry');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: config.openai.timeout,
});

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — AI-классификатор входящих обращений для типографии FLEX-N-ROLL PRO.

## О компании
FLEX-N-ROLL PRO — профессиональная типография, специализирующаяся на:
- **Широкоформатная печать**: баннеры, плакаты, стенды, ролл-апы (roll-up), X-стенды
- **Интерьерная печать**: декоративные панели, обои, наклейки для интерьера
- **Сувенирная продукция**: кружки, футболки, ежедневники, ручки, брелоки
- **Полиграфия**: визитки, листовки, буклеты, каталоги, папки, блокноты
- **Маркировка и этикетки**: самоклеящиеся этикетки, стикеры, QR-наклейки
- **Срочная печать**: экспресс-заказы с дедлайном до 24 часов
- **Ламинирование**: глянцевое, матовое, антибликовое
- **Постпечатная обработка**: резка, биговка, перфорация, пружина

## Твоя задача
Проанализировать входящее сообщение от клиента и вернуть JSON-объект классификации.

## Поля классификации

### intent (строка, обязательное)
Тип намерения клиента:
- "quote_request"     — запрос коммерческого предложения / расчёт стоимости
- "order_placement"   — готов разместить заказ
- "reorder"          — повторный заказ (упоминает предыдущий заказ)
- "design_question"  — вопрос по макету, файлам, цветовой модели
- "technical_issue"  — проблема с качеством, рекламация
- "delivery_inquiry" — вопрос о доставке или сроках
- "general_inquiry"  — общий вопрос, информация о компании
- "spam"             — нерелевантное сообщение

### product_type (строка, обязательное)
Категория продукта:
- "wide_format"      — широкоформатная печать (баннеры, ролл-апы, стенды)
- "interior"         — интерьерная печать (панели, обои, наклейки)
- "souvenirs"        — сувенирная продукция
- "polygraphy"       — полиграфия (визитки, буклеты, каталоги)
- "labeling"         — маркировка и этикетки
- "express"          — срочный заказ (дедлайн ≤ 24 ч)
- "post_print"       — постпечатная обработка
- "unknown"          — продукт не определён

### urgency (строка, обязательное)
- "critical"  — нужно сегодня или завтра
- "high"      — нужно в течение 2–3 дней
- "medium"    — в течение недели
- "low"       — без жёсткого срока

### route_to (строка, обязательное)
Пул менеджеров для обработки:
- "sales"    — продажи (quote_request, order_placement, reorder)
- "tech"     — технический отдел (design_question, technical_issue)
- "quality"  — контроль качества (рекламации, брак)
- "marking"  — маркировка и этикетки (labeling)

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
  "dimensions":     <строка или null>,          // размеры, например "1000×2000 мм"
  "material":       <строка или null>,          // материал/носитель
  "deadline":       <строка или null>,          // срок в свободной форме
  "budget":         <число или null>,           // бюджет в рублях
  "contact_name":   <строка или null>,          // имя клиента
  "contact_phone":  <строка или null>,          // телефон
  "contact_email":  <строка или null>,          // email
  "has_files":      <boolean>,                  // есть ли вложенные файлы
  "file_names":     <массив строк или []>,      // имена файлов
  "company":        <строка или null>,          // название компании
  "notes":          <строка или null>           // прочие важные детали
}

## Формат ответа
Верни ТОЛЬКО валидный JSON без markdown-блоков, без пояснений.
Пример структуры:
{
  "intent": "quote_request",
  "product_type": "wide_format",
  "urgency": "high",
  "route_to": "sales",
  "priority": 2,
  "auto_reply": "Спасибо за обращение! Ваша заявка принята, менеджер свяжется с вами в течение 4 часов.",
  "extracted_data": {
    "quantity": 50,
    "dimensions": "800×2000 мм",
    "material": "баннерная ткань 440 г/м²",
    "deadline": "к пятнице",
    "budget": null,
    "contact_name": "Алексей",
    "contact_phone": null,
    "contact_email": null,
    "has_files": false,
    "file_names": [],
    "company": "ООО Ромашка",
    "notes": "Срочно, мероприятие в субботу"
  }
}`;

/**
 * Classify an incoming client message using GPT-4.
 *
 * @param {object} params
 * @param {string} params.message        - Main message text.
 * @param {string} [params.contactName]  - Client's name (if known).
 * @param {string} [params.contactPhone] - Client's phone.
 * @param {string} [params.contactEmail] - Client's email.
 * @param {string[]} [params.fileNames]  - Names of attached files.
 * @returns {Promise<ClassificationResult>}
 */
async function classifyMessage({ message, contactName, contactPhone, contactEmail, fileNames = [] }) {
  const userContent = buildUserContent({ message, contactName, contactPhone, contactEmail, fileNames });

  logger.info('[openai] Classifying message', {
    messageLength: message.length,
    hasFiles: fileNames.length > 0,
  });

  const rawResponse = await withRetry(
    async (attempt) => {
      logger.debug(`[lmstudio] LLM API call attempt ${attempt}`);
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
      });
      return completion.choices[0].message.content;
    },
    {
      label: 'openai.classify',
      shouldRetry: (err) => {
        // Retry on network errors and 429 rate-limit; not on 4xx auth errors
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
    logger.error('[openai] Failed to parse GPT-4 response as JSON', {
      raw: rawResponse?.substring(0, 500),
    });
    throw new Error(`GPT-4 returned non-JSON response: ${parseErr.message}`);
  }

  // Validate required fields
  const required = ['intent', 'product_type', 'urgency', 'route_to', 'priority', 'auto_reply', 'extracted_data'];
  const missing = required.filter((f) => !(f in parsed));
  if (missing.length) {
    logger.error('[openai] GPT-4 response missing required fields', { missing, parsed });
    throw new Error(`GPT-4 response missing fields: ${missing.join(', ')}`);
  }

  // Clamp priority to 1–5
  parsed.priority = Math.min(5, Math.max(1, parseInt(parsed.priority, 10)));

  logger.info('[openai] Classification complete', {
    intent: parsed.intent,
    product_type: parsed.product_type,
    priority: parsed.priority,
    route_to: parsed.route_to,
  });

  return parsed;
}

/**
 * Build the user message content to send to GPT-4.
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