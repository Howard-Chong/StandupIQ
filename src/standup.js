// src/standup.js — Standup response collection and storage
// Handles sending the standup form to users, collecting submissions,
// and storing responses in memory for later digest generation.

const { buildStandupForm } = require('../views/standupForm');

// In-memory store for standup responses
// Each response: { userId, userName, yesterday, today, blockers, submittedAt }
const responses = [];

/**
 * Stores a standup response in memory.
 *
 * @param {Object} entry — { userId, userName, yesterday, today, blockers }
 */
function storeResponse(entry) {
  responses.push({
    ...entry,
    submittedAt: new Date().toISOString(),
  });
  console.log(`📥 Standup response stored from <@${entry.userId}>`);
}

/**
 * Returns all stored standup responses (most recent first).
 *
 * @returns {Array} Array of stored responses
 */
function getResponses() {
  return [...responses].reverse();
}

/**
 * Clears all stored responses. Useful for testing or daily reset.
 */
function clearResponses() {
  responses.length = 0;
  console.log('🧹 Standup responses cleared');
}

/**
 * Sends a standup prompt to a single user via DM.
 * Posts a message with a "Fill Out Standup" button — all modals
 * require a trigger_id, so the button click provides one.
 *
 * @param {Object} client — Slack Bolt app client
 * @param {string} userId — Slack user ID to DM
 */
async function sendStandupPrompt(client, userId) {
  try {
    await client.chat.postMessage({
      channel: userId,
      text: 'Time for your daily standup!',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🌅 Daily Standup',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Time to share your update with the team.',
          },
        },
        {
          type: 'actions',
          block_id: 'standup_actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📝 Fill Out Standup',
                emoji: true,
              },
              style: 'primary',
              action_id: 'open_standup',
            },
          ],
        },
      ],
    });
    console.log(`📨 Standup prompt sent to <@${userId}>`);
  } catch (error) {
    console.error(`Failed to send standup prompt to ${userId}:`, error.message);
  }
}

/**
 * Sends the standup prompt to all team members listed in TEAM_MEMBERS.
 * Called by the daily scheduler at 9:00 AM.
 *
 * @param {Object} client — Slack Bolt app client
 */
async function sendStandupToTeam(client) {
  const membersEnv = process.env.TEAM_MEMBERS || '';
  if (!membersEnv.trim()) {
    console.log('⚠️  TEAM_MEMBERS is empty — no team members configured');
    return;
  }

  const members = membersEnv.split(',').map((id) => id.trim()).filter(Boolean);
  console.log(`📋 Sending standup prompts to ${members.length} team member(s)...`);

  for (const userId of members) {
    await sendStandupPrompt(client, userId);
  }
}

/**
 * Registers all standup-related event handlers on the Bolt app.
 * - message handler: replies to "standup" in DM with a prompt button
 * - action handler: opens the standup modal when the button is clicked
 * - view submission handler: stores the submitted standup response
 *
 * @param {App} app — The Bolt app instance
 */
function setupHandlers(app) {
  // --- Message handler ---
  // Listens for "standup" keyword in DMs and sends a prompt with button
  app.message(async ({ message, say, client }) => {
    try {
      // Only respond in DMs (channel_type === 'im') and ignore bot messages
      if (message.channel_type !== 'im' || message.subtype === 'bot_message' || message.bot_id) {
        return;
      }

      const text = (message.text || '').trim().toLowerCase();
      if (text !== 'standup') {
        return;
      }

      // Send the prompt with a button (modal needs a trigger_id from button click)
      await sendStandupPrompt(client, message.user);
    } catch (error) {
      console.error('Error handling standup message:', error.message);
    }
  });

  // --- Button action handler ---
  // Opens the standup modal when the "Fill Out Standup" button is clicked
  app.action('open_standup', async ({ ack, body, client }) => {
    try {
      await ack();

      const modal = buildStandupForm();

      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal,
      });

      console.log(`📋 Standup modal opened for <@${body.user.id}>`);
    } catch (error) {
      console.error('Error opening standup modal:', error.message);
    }
  });

  // --- View submission handler ---
  // Collects form data and stores the standup response
  app.view('standup_submission', async ({ ack, body, view, client }) => {
    try {
      // Extract values from the form submission using block_ids and action_ids
      const yesterday = view.state.values.yesterday_block.yesterday_input.value || '';
      const today = view.state.values.today_block.today_input.value || '';
      const blockers = view.state.values.blockers_block.blockers_input.value || '';

      // Acknowledge the submission (closes the modal)
      await ack();

      // Send a confirmation message to the user
      try {
        await client.chat.postMessage({
          channel: body.user.id,
          text: "Thanks! Your standup has been recorded. ✅",
        });
      } catch (dmError) {
        console.error('Failed to send confirmation DM:', dmError.message);
      }

      // Store the response
      storeResponse({
        userId: body.user.id,
        userName: body.user.username || body.user.id,
        yesterday,
        today,
        blockers,
      });
    } catch (error) {
      console.error('Error handling standup submission:', error.message);
    }
  });

  console.log('✅ Standup handlers registered');
}

module.exports = { setupHandlers, sendStandupToTeam, getResponses, clearResponses };
