// src/commands.js — Slash command handlers
// Registers /standup (opens the Block Kit form modal) and /standup-report
// (weekly summary with blocker trends and team health score).

const { getTeamStatus, generateSummary } = require('./digest');
const { buildStandupForm } = require('../views/standupForm');

/**
 * Calculates team health score as a percentage of responses without blockers.
 * Returns a score from 0–100 where 100 means no blockers reported.
 *
 * @param {Object[]} responses — Standup responses
 * @returns {number} Health score percentage
 */
function calculateHealthScore(responses) {
  if (responses.length === 0) return 0;

  const withoutBlockers = responses.filter(
    (r) => !r.blockers || !r.blockers.trim()
  ).length;

  return Math.round((withoutBlockers / responses.length) * 100);
}

/**
 * Returns a health label and emoji for a given score.
 *
 * @param {number} score — Health score (0–100)
 * @returns {{ emoji: string, label: string }}
 */
function healthLabel(score) {
  if (score >= 80) return { emoji: '💚', label: 'Great' };
  if (score >= 50) return { emoji: '💛', label: 'Fair' };
  return { emoji: '❤️', label: 'Needs Attention' };
}

/**
 * Builds per-user stats from the response history.
 * Counts submissions and blocker frequency per user.
 *
 * @param {Object[]} responses — All standup responses
 * @returns {Object[]} Array of { userId, userName, total, withBlockers, withoutBlockers }
 */
function buildUserStats(responses) {
  const userMap = {};

  for (const r of responses) {
    if (!userMap[r.userId]) {
      userMap[r.userId] = {
        userId: r.userId,
        userName: r.userName,
        total: 0,
        withBlockers: 0,
        withoutBlockers: 0,
      };
    }
    userMap[r.userId].total += 1;
    if (r.blockers && r.blockers.trim()) {
      userMap[r.userId].withBlockers += 1;
    } else {
      userMap[r.userId].withoutBlockers += 1;
    }
  }

  return Object.values(userMap);
}

/**
 * Builds the Block Kit message payload for the standup report.
 * Shows team health, individual stats, recent updates, and summary.
 *
 * @param {Object[]} responses — Standup responses to report on
 * @returns {Object} Block Kit message payload
 */
function buildReportBlocks(responses) {
  const score = calculateHealthScore(responses);
  const health = healthLabel(score);
  const status = getTeamStatus(responses);
  const userStats = buildUserStats(responses);
  const summary = generateSummary(responses);

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const blocks = [
    // Header
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📋 Standup Report',
        emoji: true,
      },
    },
    // Date
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Report generated:* ${dateLabel}\n*Period:* Last ${responses.length} standup(s) on record`,
      },
    },
    { type: 'divider' },
    // Team Health Score
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${health.emoji} Team Health Score: ${score}% — ${health.label}*`,
      },
    },
    // Blocker Summary
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Status:* ${status.emoji} ${status.label}\n*Total Updates:* ${responses.length}\n*With Blockers:* ${responses.filter((r) => r.blockers && r.blockers.trim()).length}\n*Without Blockers:* ${responses.filter((r) => !r.blockers || !r.blockers.trim()).length}`,
      },
    },
    { type: 'divider' },
    // Per-User Stats
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*👤 Individual Stats*',
      },
    },
  ];

  // Per-user breakdown
  for (const stat of userStats) {
    const userScore = Math.round((stat.withoutBlockers / stat.total) * 100);
    const userEmoji = userScore >= 80 ? '💚' : userScore >= 50 ? '💛' : '❤️';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<@${stat.userId}>\n>📥 ${stat.total} submission(s) | ${userEmoji} ${userScore}% blocker-free | 🛑 ${stat.withBlockers} blocker(s)`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Recent Updates
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*📝 Recent Updates*',
    },
  });

  // Show the 5 most recent responses
  const recent = responses.slice(-5);
  for (const r of recent) {
    const submittedDate = new Date(r.submittedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const blockerLine = r.blockers?.trim()
      ? `\n>🛑 *Blocker:* ${r.blockers}`
      : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${submittedDate}* — <@${r.userId}>\n>🎯 ${r.today || '—'}${blockerLine}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // AI Summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*🤖 Summary*\n' + summary,
    },
  });

  blocks.push({ type: 'divider' });

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '🤖 Generated by StandupIQ',
      },
    ],
  });

  return blocks;
}

/**
 * Registers slash command handlers on the Bolt app.
 * Currently handles /standup-report for weekly team summaries.
 *
 * @param {App} app — The Bolt app instance
 * @param {Function} getResponses — Function that returns stored responses
 */
function setupHandlers(app, getResponses) {
  /**
   * /standup — Opens the standup Block Kit modal directly.
   * Slash commands provide a trigger_id, so the modal can be opened
   * immediately without needing a button click first.
   */
  app.command('/standup', async ({ ack, command, client }) => {
    console.log('✅ /standup command received');

    // Acknowledge immediately — Slack requires this within 3 seconds
    await ack();

    try {
      const modal = buildStandupForm();

      const result = await client.views.open({
        trigger_id: command.trigger_id,
        view: modal,
      });

      console.log(`📋 /standup modal opened — view_id: ${result.view?.id}`);
    } catch (error) {
      console.error('Error opening standup modal:', error.message);
      console.error('trigger_id used:', command.trigger_id);
    }
  });

  /**
   * /standup-report — Weekly summary of standup activity.
   * Shows team health score, blocker trends, individual stats,
   * and an AI-generated summary. Response is visible only to
   * the user who invoked the command.
   */
  app.command('/standup-report', async ({ ack, respond, command }) => {
    try {
      await ack();

      const responses = getResponses();

      if (responses.length === 0) {
        await respond({
          response_type: 'ephemeral',
          text: 'No standup data available yet.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📋 *No standup data available yet.*\n\nStandup responses are collected when team members submit the daily form. Check back after some standups have been completed.',
              },
            },
          ],
        });
        return;
      }

      const blocks = buildReportBlocks(responses);

      await respond({
        response_type: 'ephemeral',
        text: 'Standup Report',
        blocks,
      });

      console.log(
        `📋 /standup-report served to <@${command.user_name}> — ${responses.length} response(s)`
      );
    } catch (error) {
      console.error('Error handling /standup-report:', error.message);

      try {
        await respond({
          response_type: 'ephemeral',
          text: 'Sorry, something went wrong generating the report.',
        });
      } catch (respondError) {
        console.error('Failed to send error response:', respondError.message);
      }
    }
  });

  console.log('✅ Slash command handlers registered');
}

module.exports = { setupHandlers, buildReportBlocks, calculateHealthScore, buildUserStats };
