// index.js — Main entry point for StandupIQ
// Starts the Slack Bolt app (Socket Mode), the daily scheduler,
// and handles incoming events via WebSocket.

const { app } = require('./src/bot');
const scheduler = require('./src/scheduler');

/**
 * Starts the Bolt app in Socket Mode and the daily standup scheduler.
 * Socket Mode uses WebSocket — no HTTP server or public URL needed.
 * The scheduler fires at 9:00 AM server time every day.
 */
async function start() {
  try {
    // Socket Mode: app.start() opens a WebSocket to Slack
    await app.start();
    console.log('⚡ StandupIQ is running (Socket Mode)');

    // Start the daily 9 AM scheduler for standup collection
    scheduler.start();
  } catch (error) {
    console.error('Failed to start StandupIQ:', error.message);
    process.exit(1);
  }
}

// Start the app
start();
