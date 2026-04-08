// metrics.js — Prometheus-совместимый middleware для Express-сервисов FNR
// Использование: const { metricsMiddleware, metricsEndpoint } = require('./metrics');
//               app.use(metricsMiddleware);
//               app.get('/metrics', metricsEndpoint);
'use strict';

const client = require('prom-client');

// Создаём реестр и регистрируем дефолтные метрики (memory, CPU, GC, eventloop)
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'fnr_' });

// ─── Кастомные метрики ────────────────────────────────────────────────────────

// HTTP запросы — счётчик
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP latency — гистограмма
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// AI классификации (для webhook-сервиса)
const aiClassificationsTotal = new client.Counter({
  name: 'ai_classifications_total',
  help: 'Total AI classifications performed',
  labelNames: ['intent', 'product_type', 'priority'],
  registers: [register],
});

const aiClassificationErrorsTotal = new client.Counter({
  name: 'ai_classification_errors_total',
  help: 'Total AI classification errors',
  registers: [register],
});

const aiClassificationDuration = new client.Histogram({
  name: 'ai_classification_duration_seconds',
  help: 'AI classification duration in seconds',
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

// Маркировка (для marking-сервиса)
const markingCodesGenerated = new client.Counter({
  name: 'marking_codes_generated_total',
  help: 'Total marking codes generated',
  registers: [register],
});

const markingOrdersProcessed = new client.Counter({
  name: 'marking_orders_processed_total',
  help: 'Total marking orders processed',
  registers: [register],
});

// CommAnalysis (для commanalysis-сервиса)
const commanalysisCallsAnalyzed = new client.Counter({
  name: 'commanalysis_calls_analyzed_total',
  help: 'Total calls analyzed',
  registers: [register],
});

const commanalysisChatsAnalyzed = new client.Counter({
  name: 'commanalysis_chats_analyzed_total',
  help: 'Total chats analyzed',
  registers: [register],
});

// ─── Middleware ────────────────────────────────────────────────────────────────

function metricsMiddleware(req, res, next) {
  // Пропускаем сам /metrics, чтобы не создавать петлю
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

// ─── /metrics endpoint ────────────────────────────────────────────────────────

async function metricsEndpoint(_req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

module.exports = {
  register,
  metricsMiddleware,
  metricsEndpoint,
  // Экспортируем счётчики для использования в бизнес-логике
  httpRequestsTotal,
  httpRequestDuration,
  aiClassificationsTotal,
  aiClassificationErrorsTotal,
  aiClassificationDuration,
  markingCodesGenerated,
  markingOrdersProcessed,
  commanalysisCallsAnalyzed,
  commanalysisChatsAnalyzed,
};
