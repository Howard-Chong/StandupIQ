// src/bot.js — Slack Bolt app initialization
// This file creates and configures the Slack Bolt app instance.
// Secrets are loaded from environment variables via dotenv.

const { App } = require('@slack/bolt');

// Load environment variables (must be called before accessing process.env)
require('dotenv').config();

/**
 * Initializes and exports the Slack Bolt app instance.
 * The app is configured with Socket Mode disabled (HTTP receiver)
 * so it can receive Slack events and handle slash commands.
 *
 * @returns {App} Configured Slack Bolt app instance
 */
function createApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });

  return app;
}

// Export the configured app instance
const app = createApp();

module.exports = { app };
