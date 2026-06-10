// src/bot.js — Slack Bolt app initialization
// This file creates and configures the Slack Bolt app instance.
// Secrets are loaded from environment variables via dotenv.
// Uses Socket Mode — no public URL needed; events flow over WebSocket.

const { App } = require('@slack/bolt');

// Load environment variables (must be called before accessing process.env)
require('dotenv').config();

/**
 * Initializes and exports the Slack Bolt app instance.
 * Configured with Socket Mode enabled — the bot opens a WebSocket
 * connection to Slack so events and commands flow both ways without
 * needing a public-facing HTTP endpoint.
 *
 * Required env vars:
 *   SLACK_BOT_TOKEN     — Bot User OAuth Token (xoxb-...)
 *   SLACK_APP_TOKEN     — App-Level Token with connections:write (xapp-...)
 *
 * @returns {App} Configured Slack Bolt app instance
 */
function createApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
  });

  return app;
}

// Export the configured app instance
const app = createApp();

module.exports = { app };
