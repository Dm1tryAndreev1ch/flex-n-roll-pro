// src/services/slaMonitor.js
'use strict';

const { getOpenTasks, sendNotification, callBitrix } = require('./bitrix');
const logger = require('../utils/logger');

// Check interval: 15 minutes
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// SLA thresholds by priority (hours)
const SLA_HOURS = {
  P1: 1,
  P2: 4,
  P3: 8,
  P4: 24,
};

// Track notified tasks to avoid spam
const notifiedTasks = new Map(); // taskId → { warning: bool, escalation: bool }

let intervalId = null;

/**
 * Start the SLA monitoring loop.
 */
function start() {
  if (intervalId) {
    logger.warn('[slaMonitor] Already running');
    return;
  }

  logger.info('[slaMonitor] Starting SLA monitor (every 15 min)');

  // Run immediately on start, then on interval
  checkSLA().catch(err =>
    logger.error('[slaMonitor] Initial check failed', { error: err.message })
  );

  intervalId = setInterval(() => {
    checkSLA().catch(err =>
      logger.error('[slaMonitor] Check failed', { error: err.message })
    );
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the SLA monitoring loop.
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[slaMonitor] Stopped');
  }
}

/**
 * Check all open CRM tasks for SLA compliance.
 */
async function checkSLA() {
  logger.debug('[slaMonitor] Running SLA check');

  let tasks;
  try {
    tasks = await getOpenTasks();
  } catch (err) {
    logger.error('[slaMonitor] Failed to fetch tasks', { error: err.message });
    return;
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    logger.debug('[slaMonitor] No open CRM tasks found');
    return;
  }

  const now = new Date();

  for (const task of tasks) {
    const taskId       = task.ID || task.id;
    const title        = task.TITLE || task.title || '';
    const responsibleId = task.RESPONSIBLE_ID || task.responsibleId;
    const deadline     = task.DEADLINE || task.deadline;
    const createdDate  = task.CREATED_DATE || task.createdDate;
    const status       = Number(task.STATUS || task.status);

    if (!taskId || !responsibleId || !deadline) continue;

    // Skip tasks already in progress (status 3 = in progress, 4 = supposedly completed)
    if (status >= 3) continue;

    const deadlineDate = new Date(deadline);
    const createdAt    = new Date(createdDate);
    const totalMs      = deadlineDate.getTime() - createdAt.getTime();
    const halfMs       = totalMs / 2;
    const halfwayDate  = new Date(createdAt.getTime() + halfMs);
    const elapsedMs    = now.getTime() - createdAt.getTime();

    const tracked = notifiedTasks.get(String(taskId)) || { warning: false, escalation: false };

    // Warning: task not started and SLA/2 has passed
    if (!tracked.warning && now >= halfwayDate && now < deadlineDate) {
      logger.info('[slaMonitor] SLA warning — task not started', { taskId, title, responsibleId });

      await sendNotification(responsibleId,
        `⚠️ [b]SLA предупреждение[/b]\n` +
        `Задача "[url=/workgroups/group/0/tasks/task/view/${taskId}/]${title}[/url]" ` +
        `не взята в работу. Дедлайн: ${deadlineDate.toLocaleString('ru-RU')}. ` +
        `Осталось ${Math.round((deadlineDate.getTime() - now.getTime()) / 3600000)} ч.`
      ).catch(() => {});

      tracked.warning = true;
      notifiedTasks.set(String(taskId), tracked);
    }

    // Escalation: SLA expired
    if (!tracked.escalation && now >= deadlineDate) {
      logger.warn('[slaMonitor] SLA BREACH — task overdue!', { taskId, title, responsibleId });

      // Notify the responsible manager
      await sendNotification(responsibleId,
        `🔴 [b]SLA НАРУШЕН![/b]\n` +
        `Задача "[url=/workgroups/group/0/tasks/task/view/${taskId}/]${title}[/url]" ` +
        `просрочена! Дедлайн был: ${deadlineDate.toLocaleString('ru-RU')}.`
      ).catch(() => {});

      // Also notify admin (user ID 1) about escalation
      await sendNotification(1,
        `🚨 [b]Эскалация SLA[/b]\n` +
        `Задача "[url=/workgroups/group/0/tasks/task/view/${taskId}/]${title}[/url]" ` +
        `просрочена. Ответственный: [user=${responsibleId}][/user].`
      ).catch(() => {});

      tracked.escalation = true;
      notifiedTasks.set(String(taskId), tracked);
    }
  }

  // Cleanup: remove tracked tasks that are no longer in the open list
  const openTaskIds = new Set(tasks.map(t => String(t.ID || t.id)));
  for (const [taskId] of notifiedTasks) {
    if (!openTaskIds.has(taskId)) {
      notifiedTasks.delete(taskId);
    }
  }
}

module.exports = { start, stop };
