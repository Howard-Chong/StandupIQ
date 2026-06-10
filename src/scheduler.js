// src/scheduler.js — Daily standup scheduler using node-cron
// Triggers the standup collection workflow at 9:00 AM every day.
// Uses server local time — per-user timezone support is a future enhancement.

const cron = require('node-cron');

/** Holds a reference to the running cron task so we can stop it later */
let task = null;

/**
 * Builds the cron callback that fires at 9:00 AM daily.
 * Wraps the provided callback with error handling and logging.
 *
 * @param {Function} [onTrigger] — Optional callback to run at 9:00 AM
 * @returns {Function} Async function suitable for node-cron
 */
function buildTrigger(onTrigger) {
  return async function dailyStandupTrigger() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ Standup trigger fired at ${timestamp}`);

      if (onTrigger) {
        await onTrigger();
      }
    } catch (error) {
      console.error('Failed to run daily standup trigger:', error.message);
    }
  };
}

/**
 * Starts the daily standup cron scheduler.
 * Schedules the trigger for 9:00 AM server time every day.
 *
 * @param {Function} [onTrigger] — Optional callback to run at 9:00 AM
 * @returns {Object} The scheduled cron task
 */
function start(onTrigger) {
  if (task) {
    console.log('Scheduler is already running');
    return task;
  }

  // Schedule for 9:00 AM daily (server local time by default)
  task = cron.schedule('0 9 * * *', buildTrigger(onTrigger));

  console.log('📅 Standup scheduler started — will trigger at 9:00 AM daily');
  return task;
}

/**
 * Stops the cron scheduler gracefully.
 * Useful for testing or shutting down the app.
 */
function stop() {
  if (task) {
    task.stop();
    task = null;
    console.log('🛑 Standup scheduler stopped');
  }
}

/**
 * Returns whether the scheduler is currently running.
 *
 * @returns {boolean} True if the scheduler is active
 */
function isRunning() {
  return task !== null;
}

module.exports = { start, stop, isRunning };
