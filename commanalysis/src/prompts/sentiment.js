'use strict';

// Промт: sentiment-анализ звонка
// ═══════════════════════════════════════════════════════════════════════════
// (в отдельный файл)

const SENTIMENT_PROMPT = `
Ты — эксперт по анализу тональности коммуникаций в продажах.
Тебе дан транскрипт звонка менеджера с клиентом типографии FLEX-N-ROLL PRO.

Определи тональность звонка и риски.

Верни ТОЛЬКО валидный JSON-объект:
{
  "overall_tone": "positive"|"neutral"|"negative",
  "client_tone":  "interest"|"skepticism"|"irritation"|"neutral",
  "manager_tone": "confident"|"uncertain"|"aggressive"|"friendly"|"neutral",
  "churn_risk":   "low"|"medium"|"high",
  "negative_moments": [
    {
      "timestamp": "<примерное время или описание момента>",
      "quote":     "<точная цитата из транскрипта>",
      "speaker":   "client"|"manager",
      "reason":    "<почему это негативный момент>"
    }
  ],
  "positive_moments": [
    {
      "quote":  "<точная цитата>",
      "reason": "<почему это позитивный момент>"
    }
  ],
  "summary": "<краткое резюме тональности звонка 2-3 предложения>",
  "churn_risk_reasons": [<причины оценки риска оттока>]
}

Критерии churn_risk:
- "low":    клиент заинтересован, нет явного негатива, есть договорённость
- "medium": есть сомнения или нерешённые возражения, но диалог продолжается
- "high":   явное раздражение, отказ, неудовлетворённость, нет следующего шага
`.trim();

module.exports = { SENTIMENT_PROMPT };