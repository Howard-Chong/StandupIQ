// views/standupForm.js — Block Kit UI form definition
// Defines the modal view for the daily standup form with 3 questions:
// 1. What did you complete yesterday?
// 2. What are you working on today?
// 3. Any blockers?

/**
 * Builds and returns the Block Kit modal view for the daily standup form.
 * Uses Slack's modal type with 3 multiline text inputs — one for each
 * standup question. The callback_id "standup_submission" is used to
 * identify form submissions in the bot's view_submission handler.
 *
 * @returns {Object} A Slack Block Kit modal view object
 */
function buildStandupForm() {
  return {
    type: 'modal',
    callback_id: 'standup_submission',
    title: {
      type: 'plain_text',
      text: 'Daily Standup',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Submit',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'input',
        block_id: 'yesterday_block',
        label: {
          type: 'plain_text',
          text: 'What did you complete yesterday?',
          emoji: true,
        },
        element: {
          type: 'plain_text_input',
          action_id: 'yesterday_input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'List tasks you finished yesterday...',
            emoji: true,
          },
        },
      },
      {
        type: 'input',
        block_id: 'today_block',
        label: {
          type: 'plain_text',
          text: 'What are you working on today?',
          emoji: true,
        },
        element: {
          type: 'plain_text_input',
          action_id: 'today_input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'List tasks you plan to work on today...',
            emoji: true,
          },
        },
      },
      {
        type: 'input',
        block_id: 'blockers_block',
        optional: true,
        label: {
          type: 'plain_text',
          text: 'Any blockers?',
          emoji: true,
        },
        element: {
          type: 'plain_text_input',
          action_id: 'blockers_input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Describe any blockers or challenges...',
            emoji: true,
          },
        },
      },
    ],
  };
}

module.exports = { buildStandupForm };
