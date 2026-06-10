// index.js — Main entry point for StandupIQ
// Starts the Slack Bolt app and listens for incoming events.

const { app } = require('./src/bot');

/**
 * Starts the Bolt app server.
 * The port is configured via the PORT environment variable (defaults to 3000).
 * On successful start, logs the port so we know the app is running.
 */
async function start() {
  try {
    const port = process.env.PORT || 3000;

    await app.start(port);
    console.log(`⚡ StandupIQ is running on port ${port}`);
  } catch (error) {
    console.error('Failed to start StandupIQ:', error.message);
    process.exit(1);
  }
}

// Start the app
start();
