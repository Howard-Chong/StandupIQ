// index.js — Main entry point for StandupIQ
// Starts the Slack Bolt app, the daily scheduler, and listens for incoming events.

const { app } = require('./src/bot');
const scheduler = require('./src/scheduler');

/**
 * Starts the Bolt app server and the daily standup scheduler.
 * The port is configured via the PORT environment variable (defaults to 3000).
 * The scheduler fires at 9:00 AM server time every day.
 * On successful start, logs the port so we know the app is running.
 */
async function start() {
  try {
    const port = process.env.PORT || 3000;

    await app.start(port);
    console.log(`⚡ StandupIQ is running on port ${port}`);

    // Start the daily 9 AM scheduler for standup collection
    scheduler.start();
  } catch (error) {
    console.error('Failed to start StandupIQ:', error.message);
    process.exit(1);
  }
}

// Start the app
start();
