// src/utils/metrics.js — Prometheus-метрики для webhook-сервиса
'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'fnr_' });

// ─── HTTP метрики ─────────────────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// ─── AI классификация ─────────────────────────────────────────────────────────

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

// ─── Middleware ────────────────────────────────────────────────────────────────

function metricsMiddleware(req, res, next) {
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
  aiClassificationsTotal,
  aiClassificationErrorsTotal,
  aiClassificationDuration,
};
