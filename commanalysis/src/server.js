'use strict';

const express  = require('express');
const morgan   = require('morgan');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const config   = require('../config');
const logger   = require('./utils/logger');

const whisperService   = require('./services/whisper');
const callAnalyzer     = require('./services/callAnalyzer');
const chatAnalyzer     = require('./services/chatAnalyzer');
const bitrixClient     = require('./services/bitrix');
const reporter         = require('./utils/reporter');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Multer (загрузка аудио) ────────────────────────────────────────────────
const upload = multer({
  dest: config.audio.tmpDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 * Проверка живости сервиса
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────────────────────
//  ЗВОНКИ
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/calls/analyze-by-deal
 * Тело: { dealId: string, language?: "ru"|"be" }
 * Полный цикл: скачать запись из Б24 → транскрибировать → анализировать → сохранить карточку
 */
app.post('/api/calls/analyze-by-deal', async (req, res) => {
  const { dealId, language } = req.body;
  if (!dealId) return res.status(400).json({ error: 'dealId required' });

  try {
    logger.info(`[calls] Запуск анализа сделки dealId=${dealId}`);

    // 1. Получить данные звонка из Б24
    const callInfo = await bitrixClient.getCallByDealId(dealId);
    if (!callInfo) {
      return res.status(404).json({ error: 'Запись звонка не найдена' });
    }

    // 2. Транскрибация
    const transcript = await whisperService.transcribeFromBitrix(
      callInfo.RECORD_URL,
      { language: language || config.audio.defaultLang, dealId }
    );

    // 3. Анализ
    const analysisResult = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo,
    });

    // 4. Сохранить поля в сделке
    await bitrixClient.updateDealFields(dealId, {
      UF_TRANSCRIPT: transcript.text.substring(0, 4000),
      UF_CALL_SCORE: analysisResult.overall_score,
      UF_SENTIMENT:  analysisResult.sentiment.overall_tone,
    });

    // 5. Создать HTML-карточку и сохранить как комментарий
    const managerInfo = await bitrixClient.getUserById(callInfo.PORTAL_USER_ID);
    const contactInfo = await bitrixClient.getContactByDealId(dealId);

    const card = reporter.buildCard({
      dealId,
      date: callInfo.CALL_START_DATE || new Date().toISOString(),
      manager: managerInfo?.NAME || 'Менеджер',
      client: contactInfo?.NAME || 'Клиент',
      type: 'call',
      analysis: analysisResult,
    });

    await bitrixClient.addTimelineComment(dealId, card.html);

    logger.info(`[calls] Анализ завершён dealId=${dealId} score=${analysisResult.overall_score}`);
    res.json({ success: true, dealId, analysis: analysisResult });

  } catch (err) {
    logger.error(`[calls] Ошибка dealId=${dealId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/calls/analyze-upload
 * Multipart: audio file + dealId + managerId + clientName
 * Прямая загрузка аудио без Б24-записи
 */
app.post('/api/calls/analyze-upload', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Аудиофайл не приложен' });

  const { dealId, managerId, clientName, language } = req.body;
  const tmpPath = req.file.path;

  try {
    logger.info(`[calls/upload] dealId=${dealId} file=${req.file.originalname}`);

    // Транскрибация загруженного файла
    const transcript = await whisperService.transcribeFile(tmpPath, {
      language: language || config.audio.defaultLang,
      originalName: req.file.originalname,
    });

    // Анализ
    const analysisResult = await callAnalyzer.analyzeCall({
      transcript,
      dealId,
      callInfo: { PORTAL_USER_ID: managerId },
    });

    // HTML-карточка
    const card = reporter.buildCard({
      dealId,
      date: new Date().toISOString(),
      manager: managerId  || 'Менеджер',
      client:  clientName || 'Клиент',
      type: 'call',
      analysis: analysisResult,
    });

    if (dealId) {
      await bitrixClient.updateDealFields(dealId, {
        UF_TRANSCRIPT: transcript.text.substring(0, 4000),
        UF_CALL_SCORE: analysisResult.overall_score,
        UF_SENTIMENT:  analysisResult.sentiment.overall_tone,
      });
      await bitrixClient.addTimelineComment(dealId, card.html);
    }

    res.json({ success: true, dealId, analysis: analysisResult, cardHtml: card.html });

  } catch (err) {
    logger.error(`[calls/upload] Ошибка: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    // Удалить временный файл
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  ЧАТ / ПЕРЕПИСКА
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/chats/analyze
 * Тело: { dealId: string, messages: [{role, text, timestamp}] }
 * Или  : { dealId: string }  — автозагрузка из Б24 CRM
 */
app.post('/api/chats/analyze', async (req, res) => {
  const { dealId, messages } = req.body;
  if (!dealId) return res.status(400).json({ error: 'dealId required' });

  try {
    logger.info(`[chats] Анализ переписки dealId=${dealId}`);

    let msgs = messages;
    if (!msgs || !msgs.length) {
      // Загрузить историю из Б24
      msgs = await bitrixClient.getChatMessagesByDealId(dealId);
    }
    if (!msgs || !msgs.length) {
      return res.status(404).json({ error: 'Сообщения не найдены' });
    }

    const analysisResult = await chatAnalyzer.analyzeChat({ dealId, messages: msgs });

    const managerInfo = await bitrixClient.getUserById(analysisResult.managerId);
    const contactInfo = await bitrixClient.getContactByDealId(dealId);

    const card = reporter.buildCard({
      dealId,
      date: new Date().toISOString(),
      manager: managerInfo?.NAME || 'Менеджер',
      client: contactInfo?.NAME || 'Клиент',
      type: 'chat',
      analysis: analysisResult,
    });

    await bitrixClient.addTimelineComment(dealId, card.html);

    logger.info(`[chats] Анализ завершён dealId=${dealId}`);
    res.json({ success: true, dealId, analysis: analysisResult });

  } catch (err) {
    logger.error(`[chats] Ошибка dealId=${dealId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  WEBHOOK ОТ БИТРИКС24
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhook/bitrix
 * Обработчик событий Б24:
 *   - ONCRMDEALADD       → запланировать анализ
 *   - ONVOXIMPLANTCALLEND → немедленно транскрибировать
 */
app.post('/api/webhook/bitrix', async (req, res) => {
  // Verify Bitrix24 portal domain
  const auth = req.body?.auth || {};
  const domain = auth.domain || auth.DOMAIN;
  if (process.env.NODE_ENV === 'production' && domain !== process.env.BITRIX_PORTAL_DOMAIN) {
    logger.warn('[webhook] Domain mismatch or missing', { domain });
    return res.status(401).send('Unauthorized');
  }

  // Сразу ответить Б24, дальше обрабатывать асинхронно
  res.sendStatus(200);

  const event = req.body?.event || req.body?.EVENT;
  const data  = req.body?.data  || req.body?.DATA || {};

  logger.info(`[webhook] Событие: ${event}`);

  try {
    if (event === 'ONVOXIMPLANTCALLEND' || event === 'OnVoximplantCallEnd') {
      const callId = data?.CALL_ID;
      const dealId = data?.CRM_ENTITY_ID;
      if (callId && dealId) {
        // Небольшая задержка — запись может ещё записываться
        setTimeout(async () => {
          try {
            const callInfo = await bitrixClient.getCallInfo(callId);
            if (callInfo?.RECORD_URL) {
              const transcript = await whisperService.transcribeFromBitrix(
                callInfo.RECORD_URL,
                { language: config.audio.defaultLang, dealId }
              );
              const analysis = await callAnalyzer.analyzeCall({ transcript, dealId, callInfo });
              const card = reporter.buildCard({
                dealId,
                date: callInfo.CALL_START_DATE || new Date().toISOString(),
                manager: callInfo.PORTAL_USER_ID || 'Менеджер',
                client: callInfo.CRM_ENTITY_ID   || 'Клиент',
                type: 'call',
                analysis,
              });
              await bitrixClient.updateDealFields(dealId, {
                UF_TRANSCRIPT: transcript.text.substring(0, 4000),
                UF_CALL_SCORE: analysis.overall_score,
                UF_SENTIMENT:  analysis.sentiment.overall_tone,
              });
              await bitrixClient.addTimelineComment(dealId, card.html);
              logger.info(`[webhook] Обработан звонок callId=${callId}`);
            }
          } catch (e) {
            logger.error(`[webhook] Ошибка обработки callId=${callId}: ${e.message}`);
          }
        }, 10_000); // 10 секунд на запись файла
      }
    }
  } catch (err) {
    logger.error(`[webhook] Ошибка: ${err.message}`);
  }
});

// ── 404 / Error handlers ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  logger.error(`[server] Необработанная ошибка: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Запуск ─────────────────────────────────────────────────────────────────
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`FLEX-N-ROLL CommAnalysis API запущен на порту ${PORT}`);
});

module.exports = app; // для тестов