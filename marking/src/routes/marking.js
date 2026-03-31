'use strict';

/**
 * marking.js — REST API маркировки
 *
 * POST /api/marking/request        — запросить коды для сделки
 * GET  /api/marking/status/:dealId — статус процесса маркировки
 * POST /api/marking/verify         — подтвердить нанесение кодов
 * GET  /api/marking/report/:dealId — скачать HTML-отчёт для клиента
 * GET  /api/marking/xml/:dealId    — скачать XML-отчёт ФНС
 * GET  /api/marking/monthly        — ежемесячная сводка
 * POST /api/marking/shipment       — зарегистрировать отгрузку
 * GET  /api/marking/verify-codes   — верификация структуры кодов (dry-run)
 */

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

const logger = require('../utils/logger');
const codeManager = require('../services/codeManager');
const reporter = require('../utils/reporter');
const datamatrix = require('../utils/datamatrix');
const config = require('../../config');

// ---------------------------------------------------------------------------
// Вспомогательный middleware валидации
// ---------------------------------------------------------------------------
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

// ---------------------------------------------------------------------------
// POST /api/marking/request
// Запрашивает коды DataMatrix у ГИС МТ для сделки Б24.
// ---------------------------------------------------------------------------
router.post(
  '/request',
  [
    body('dealId').notEmpty().withMessage('dealId обязателен'),
    body('productCategory')
      .notEmpty()
      .isIn(['молочная', 'фармацевтика', 'табак', 'обувь'])
      .withMessage('productCategory: молочная | фармацевтика | табак | обувь'),
    body('codesCount')
      .isInt({ min: 1, max: 1000000 })
      .withMessage('codesCount: целое число 1–1000000'),
    body('gtin').optional().isLength({ min: 14, max: 14 }).withMessage('gtin: 14 символов'),
  ],
  validate,
  async (req, res, next) => {
    const { dealId, productCategory, codesCount, gtin } = req.body;

    logger.info(`[marking] /request dealId=${dealId} category=${productCategory} qty=${codesCount}`);

    try {
      // Запрос кодов (асинхронный процесс с polling)
      const { orderId, codes } = await codeManager.requestCodesForDeal({
        dealId: String(dealId),
        productCategory,
        codesCount: Number(codesCount),
        gtin,
      });

      // Генерация CSV-файла для производства
      const csvPath = await codeManager.generateProductionFile(String(dealId));

      // Уведомление оператора
      const { taskId } = await codeManager.notifyOperator(String(dealId), csvPath);

      return res.json({
        success: true,
        dealId,
        orderId,
        codesCount: codes.length,
        csvPath,
        taskId,
        message: 'Коды получены, CSV-файл сформирован, оператор уведомлён',
      });
    } catch (err) {
      logger.error(`[marking] /request ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/status/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/status/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const entry = codeManager.getEntry(dealId);

    if (!entry) {
      return res.status(404).json({ success: false, message: `Сделка ${dealId} не найдена` });
    }

    // Не возвращаем массив всех кодов (может быть большим) — только мета
    const { codes, appliedCodes, ...meta } = entry;
    return res.json({
      success: true,
      data: {
        ...meta,
        codesTotal: codes?.length ?? 0,
        appliedTotal: appliedCodes?.length ?? 0,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/marking/verify
// Оператор подтверждает нанесение кодов после печати.
// ---------------------------------------------------------------------------
router.post(
  '/verify',
  [
    body('dealId').notEmpty().withMessage('dealId обязателен'),
    body('codes').optional().isArray().withMessage('codes должен быть массивом'),
  ],
  validate,
  async (req, res, next) => {
    const { dealId, codes } = req.body;

    logger.info(`[marking] /verify dealId=${dealId} codes=${codes?.length ?? 'все'}`);

    try {
      const { reportId } = await codeManager.verifyCodesApplied(
        String(dealId),
        codes?.length ? codes : undefined
      );

      // Генерируем отчёты
      const entry = codeManager.getEntry(String(dealId));
      const appliedCodes = entry?.appliedCodes || entry?.codes || [];

      let clientReportPath = null;
      let fnsXmlPath = null;

      try {
        clientReportPath = await reporter.generateClientReport({
          dealId,
          dealTitle: `Сделка #${dealId}`,
          productCategory: entry?.productGroup || '',
          gtin: entry?.gtin || '',
          codes: appliedCodes,
          orderId: entry?.orderId,
        });
      } catch (e) {
        logger.warn(`[marking] Ошибка генерации HTML-отчёта: ${e.message}`);
      }

      try {
        fnsXmlPath = reporter.generateFnsXmlReport({
          dealId,
          dealTitle: `Сделка #${dealId}`,
          gtin: entry?.gtin || '',
          productCategory: entry?.productGroup || '',
          codes: appliedCodes,
          inn: config.mdlp.participantInn,
          orderId: entry?.orderId,
        });
      } catch (e) {
        logger.warn(`[marking] Ошибка генерации XML-отчёта: ${e.message}`);
      }

      return res.json({
        success: true,
        dealId,
        reportId,
        appliedCount: appliedCodes.length,
        clientReportUrl: clientReportPath
          ? `/reports/client_${dealId}.html`
          : null,
        fnsXmlPath,
        message: 'Факт нанесения зарегистрирован в ГИС МТ, отчёты сформированы',
      });
    } catch (err) {
      logger.error(`[marking] /verify ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/report/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/report/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const reportPath = path.join(config.storage.dataDir, 'reports', `client_${dealId}.html`);

    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ success: false, message: 'Отчёт не найден. Сначала выполните /verify' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="marking_report_${dealId}.html"`);
    fs.createReadStream(reportPath).pipe(res);
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/xml/:dealId
// ---------------------------------------------------------------------------
router.get(
  '/xml/:dealId',
  [param('dealId').notEmpty()],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const xmlPath = path.join(config.storage.dataDir, 'reports', `fns_${dealId}.xml`);

    if (!fs.existsSync(xmlPath)) {
      return res.status(404).json({ success: false, message: 'XML-отчёт не найден' });
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marking_fns_${dealId}.xml"`
    );
    fs.createReadStream(xmlPath).pipe(res);
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/monthly
// Ежемесячная сводка. Query: ?year=2025&month=5
// ---------------------------------------------------------------------------
router.get('/monthly', async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(422).json({ success: false, message: 'month должен быть 1–12' });
    }

    const reportPath = await reporter.generateMonthlySummary(year, month);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="monthly_${monthStr}.html"`);
    fs.createReadStream(reportPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/marking/shipment
// Регистрация факта отгрузки в ГИС МТ.
// ---------------------------------------------------------------------------
router.post(
  '/shipment',
  [body('dealId').notEmpty().withMessage('dealId обязателен')],
  validate,
  async (req, res, next) => {
    const { dealId } = req.body;
    logger.info(`[marking] /shipment dealId=${dealId}`);

    try {
      const { reportId } = await codeManager.registerDealShipment(String(dealId));
      return res.json({
        success: true,
        dealId,
        reportId,
        message: 'Отгрузка зарегистрирована в ГИС МТ',
      });
    } catch (err) {
      logger.error(`[marking] /shipment ошибка: ${err.message}`);
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/marking/verify-codes
// Dry-run верификация структуры кодов DataMatrix (без обращения к ГИС МТ).
// ---------------------------------------------------------------------------
router.post(
  '/verify-codes',
  [body('codes').isArray({ min: 1 }).withMessage('codes: непустой массив строк')],
  validate,
  (req, res) => {
    const { codes } = req.body;
    const result = datamatrix.verifyCodes(codes);
    return res.json({ success: true, ...result });
  }
);

// ---------------------------------------------------------------------------
// GET /api/marking/codes/:dealId
// Список всех кодов для сделки (paginated).
// ---------------------------------------------------------------------------
router.get(
  '/codes/:dealId',
  [
    param('dealId').notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 10000 }),
  ],
  validate,
  (req, res) => {
    const { dealId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;

    const entry = codeManager.getEntry(dealId);
    if (!entry) {
      return res.status(404).json({ success: false, message: `Сделка ${dealId} не найдена` });
    }

    const codes = entry.codes || [];
    const total = codes.length;
    const start = (page - 1) * limit;
    const paginated = codes.slice(start, start + limit);

    return res.json({
      success: true,
      dealId,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      codes: paginated,
    });
  }
);

module.exports = router;