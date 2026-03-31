'use strict';

/**
 * whisper.js — Транскрибация аудиозаписей через OpenAI Whisper API
 *
 * Возможности:
 *  - Скачивание записи из Битрикс24
 *  - Автоматическое чанкование файлов >25 MB через ffmpeg
 *  - Поддержка языков: ru, be
 *  - Сохранение транскрипта в поле сделки (опционально)
 */

const fs        = require('fs');
const path      = require('path');
const axios     = require('axios');
const ffmpeg    = require('fluent-ffmpeg');
const ffmpegBin = require('ffmpeg-static');
const tmp       = require('tmp');
const { OpenAI } = require('openai');
const config    = require('../../config');
const logger    = require('../utils/logger');
const bitrix    = require('./bitrix');

// Подключить бинарник ffmpeg
ffmpeg.setFfmpegPath(ffmpegBin);

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ── Константы ─────────────────────────────────────────────────────────────
const CHUNK_SIZE_BYTES = config.audio.chunkSizeMB * 1024 * 1024;
const SUPPORTED_LANGS  = config.audio.supportedLangs;

// ─────────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Скачать файл по URL в локальный временный файл.
 * @param {string} url   — URL аудио (может быть с Basic-auth из Б24)
 * @param {string} destPath — куда сохранить
 * @returns {Promise<string>} путь к файлу
 */
async function downloadFile(url, destPath) {
  logger.debug(`[whisper] Скачиваем: ${url}`);
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 120_000,
    headers: {
      // Б24 иногда требует cookie / token — добавляется через webhookUrl
      'User-Agent': 'FlexNRollCommAnalysis/1.0',
    },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error',  reject);
  });

  const stat = fs.statSync(destPath);
  logger.debug(`[whisper] Загружено ${(stat.size / 1024 / 1024).toFixed(1)} MB → ${destPath}`);
  return destPath;
}

/**
 * Конвертировать аудио в mp3 16 kHz (оптимально для Whisper).
 * @param {string} inputPath
 * @returns {Promise<string>} путь к сконвертированному файлу
 */
function convertToMp3(inputPath) {
  const outPath = inputPath.replace(/\.[^.]+$/, '_converted.mp3');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate('32k')
      .output(outPath)
      .on('end',   () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Получить длительность аудио в секундах через ffprobe.
 * @param {string} filePath
 * @returns {Promise<number>}
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Разделить аудиофайл на чанки не более CHUNK_SIZE_BYTES.
 * Разделяем по времени, зная битрейт.
 * @param {string} filePath
 * @returns {Promise<string[]>} массив путей к чанкам
 */
async function splitAudioIntoChunks(filePath) {
  const stat      = fs.statSync(filePath);
  const totalSize = stat.size;

  if (totalSize <= CHUNK_SIZE_BYTES) {
    logger.debug(`[whisper] Файл ${(totalSize/1024/1024).toFixed(1)} MB — чанкование не нужно`);
    return [filePath];
  }

  const duration    = await getAudioDuration(filePath);
  const numChunks   = Math.ceil(totalSize / CHUNK_SIZE_BYTES);
  const chunkSecs   = Math.floor(duration / numChunks);
  const chunkPaths  = [];

  logger.info(`[whisper] Файл ${(totalSize/1024/1024).toFixed(1)} MB → ${numChunks} чанков по ~${chunkSecs}с`);

  for (let i = 0; i < numChunks; i++) {
    const start   = i * chunkSecs;
    const outPath = filePath.replace(/\.mp3$/, `_chunk${i + 1}.mp3`);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(filePath)
        .setStartTime(start)
        .audioCodec('libmp3lame')
        .output(outPath)
        .on('end',   resolve)
        .on('error', reject);

      // Для последнего чанка не задаём duration
      if (i < numChunks - 1) cmd.duration(chunkSecs);
      cmd.run();
    });

    chunkPaths.push(outPath);
  }

  return chunkPaths;
}

// ─────────────────────────────────────────────────────────────────────────
//  ОСНОВНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Отправить ОДИН аудиофайл в Whisper API.
 * @param {string} filePath  — локальный путь
 * @param {string} language  — 'ru' | 'be'
 * @returns {Promise<{ text: string, segments?: object[] }>}
 */
async function transcribeSingleFile(filePath, language = 'ru') {
  const lang = SUPPORTED_LANGS.includes(language) ? language : 'ru';
  logger.debug(`[whisper] Отправляем в Whisper: ${path.basename(filePath)} lang=${lang}`);

  const response = await openai.audio.transcriptions.create({
    file:             fs.createReadStream(filePath),
    model:            config.openai.whisperModel,
    language:         lang,
    response_format: 'verbose_json',  // получим segments с timestamps
    timestamp_granularities: ['segment'],
  });

  return {
    text:     response.text,
    segments: response.segments || [],
    language: response.language,
    duration: response.duration,
  };
}

/**
 * Транскрибировать файл с поддержкой чанкования.
 * @param {string} filePath
 * @param {{ language?: string, originalName?: string }} opts
 * @returns {Promise<{ text: string, segments: object[], duration?: number }>}
 */
async function transcribeFile(filePath, opts = {}) {
  const { language = config.audio.defaultLang } = opts;
  const tmpFiles = [];

  try {
    // Конвертация в mp3
    logger.info(`[whisper] Конвертация ${filePath}`);
    const mp3Path = await convertToMp3(filePath);
    tmpFiles.push(mp3Path);

    // Чанкование при необходимости
    const chunks = await splitAudioIntoChunks(mp3Path);
    // chunks[0] === mp3Path если не нужно делить — добавляем в tmpFiles остальные
    if (chunks.length > 1) tmpFiles.push(...chunks);

    // Транскрибация каждого чанка
    logger.info(`[whisper] Транскрибируем ${chunks.length} чанк(ов)...`);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      logger.debug(`[whisper] Чанк ${i + 1}/${chunks.length}`);
      const r = await transcribeSingleFile(chunks[i], language);
      results.push(r);
    }

    // Объединение результатов
    const combinedText = results.map(r => r.text).join(' ').trim();

    // Пересчитать смещения segments для склейки
    let timeOffset = 0;
    const allSegments = [];
    for (const r of results) {
      for (const seg of (r.segments || [])) {
        allSegments.push({
          ...seg,
          start: seg.start + timeOffset,
          end:   seg.end   + timeOffset,
        });
      }
      timeOffset += r.duration || 0;
    }

    logger.info(`[whisper] Транскрипт готов: ${combinedText.length} символов`);
    return { text: combinedText, segments: allSegments, duration: timeOffset };

  } finally {
    // Очистка временных файлов (не удаляем входной filePath — это забота вызывающего)
    for (const f of tmpFiles) {
      try { if (fs.existsSync(f) && f !== filePath) fs.unlinkSync(f); } catch (_) {}
    }
  }
}

/**
 * Скачать запись звонка из Битрикс24 и транскрибировать.
 * @param {string} recordUrl  — URL записи из telephony.externalcall.show
 * @param {{ language?: string, dealId?: string }} opts
 * @returns {Promise<{ text: string, segments: object[], duration?: number }>}
 */
async function transcribeFromBitrix(recordUrl, opts = {}) {
  const { language = config.audio.defaultLang, dealId } = opts;

  // Создать временный файл для скачивания
  const tmpFile = tmp.fileSync({
    dir:    config.audio.tmpDir,
    prefix: `call_${dealId || 'unknown'}_`,
    postfix: '.tmp',
    keep: false,
  });

  try {
    logger.info(`[whisper] Скачиваем запись dealId=${dealId} url=${recordUrl}`);

    // Попробовать скачать напрямую; если 403 — через Б24 webhook
    let localPath;
    try {
      localPath = await downloadFile(recordUrl, tmpFile.name);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        // Перезапросить защищённую ссылку через Б24 API
        logger.warn('[whisper] Прямое скачивание отклонено, запрашиваем через Б24...');
        const signed = await bitrix.getSignedAudioUrl(recordUrl, dealId);
        localPath = await downloadFile(signed, tmpFile.name);
      } else {
        throw err;
      }
    }

    const result = await transcribeFile(localPath, { language });

    // Сохранить транскрипт в поле сделки (первые 4000 символов — лимит поля Б24)
    if (dealId && result.text) {
      await bitrix.updateDealFields(dealId, {
        UF_TRANSCRIPT: result.text.substring(0, 4000),
      }).catch(e => logger.warn(`[whisper] Не удалось сохранить транскрипт в Б24: ${e.message}`));
    }

    return result;

  } finally {
    try { fs.unlinkSync(tmpFile.name); } catch (_) {}
  }
}

/**
 * Транскрибировать звонок по ID из Битрикс24 (telephony.externalcall.show).
 * @param {string} callId
 * @param {{ language?: string }} opts
 */
async function transcribeByCallId(callId, opts = {}) {
  const callInfo = await bitrix.getCallInfo(callId);
  if (!callInfo?.RECORD_URL) {
    throw new Error(`[whisper] Запись для callId=${callId} не найдена`);
  }
  return transcribeFromBitrix(callInfo.RECORD_URL, {
    language: opts.language || config.audio.defaultLang,
    dealId:   callInfo.CRM_ENTITY_ID,
  });
}

module.exports = {
  transcribeFile,
  transcribeFromBitrix,
  transcribeByCallId,
  // Экспорт утилит для тестов
  _splitAudioIntoChunks: splitAudioIntoChunks,
  _convertToMp3:         convertToMp3,
};