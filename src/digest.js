// src/digest.js — AI-powered standup digest generation and posting
// Takes collected standup responses and RTS findings, generates a
// natural language team summary, and posts it to #standup-digest
// with color-coded Block Kit formatting.

/**
 * Checks whether a blocker value represents a real blocker.
 * Filters out empty, whitespace-only, and common "no blocker" phrases.
 *
 * @param {string} blockers — The blockers field from a standup response
 * @returns {boolean} True if the blocker is real
 */
function hasRealBlocker(blockers) {
  if (!blockers || !blockers.trim()) return false;
  const normalized = blockers.trim().toLowerCase();
  const falseBlockers = ['no', 'none', 'n/a', 'na', 'none.', 'nope', 'nil', '-'];
  return !falseBlockers.includes(normalized);
}

/**
 * Determines the team health status based on real blocker count.
 * Green: no blockers, Yellow: 1-2 blockers, Red: 3+ blockers.
 *
 * @param {Object[]} responses — Standup responses
 * @returns {{ color: string, emoji: string, label: string }}
 */
function getTeamStatus(responses) {
  const blockerCount = responses.filter(
    (r) => hasRealBlocker(r.blockers)
  ).length;

  if (blockerCount === 0) {
    return { color: '#2EB886', emoji: '🟢', label: 'All Clear' };
  }
  if (blockerCount <= 2) {
    return { color: '#DAA038', emoji: '🟡', label: 'Mixed' };
  }
  return { color: '#DA213A', emoji: '🔴', label: 'Blocked' };
}

/**
 * Generates a short natural language summary (max 2-3 sentences).
 *
 * @param {Object[]} responses — Standup responses
 * @returns {string} Natural language team summary (2-3 sentences)
 */
function generateSummary(responses) {
  if (responses.length === 0) {
    return 'No standup responses were submitted.';
  }

  const realBlockers = responses.filter((r) => hasRealBlocker(r.blockers));

  // Sentence 1: Who submitted and overall state
  const names = responses.map((r) => `<@${r.userId}>`).join(', ');
  let summary = `${responses.length} update(s) from ${names}. `;

  // Sentence 2: Work focus
  const tasks = responses
    .map((r) => r.today?.trim())
    .filter((t) => t)
    .slice(0, 3); // just top 3 focus areas

  if (tasks.length > 0) {
    summary += `Focus areas: ${tasks.join('; ')}. `;
  }

  // Sentence 3: Blocker callout (only if any)
  if (realBlockers.length > 0) {
    summary += `${realBlockers.length} blocker(s) need attention.`;
  } else {
    summary += 'No blockers reported.';
  }

  return summary;
}

/**
 * Builds the complete digest data object including status, summary,
 * individual updates, AI summary, and RTS findings.
 *
 * @param {Object[]} responses — Standup responses
 * @param {Object[]} rtsFindings — RTS blocker detection findings
 * @returns {{ date: string, status: Object, summary: string, responses: Object[], rtsFindings: Object[] }}
 */
function buildDigestData(responses, rtsFindings = []) {
  const status = getTeamStatus(responses);
  const summary = generateSummary(responses);

  return {
    date: new Date().toISOString(),
    status,
    summary,
    responses,
    rtsFindings,
  };
}

/**
 * Posts the standup digest to the #standup-digest channel using
 * a clean Block Kit layout with team status, individual updates,
 * AI summary, and RTS blocker flags.
 *
 * @param {Object} app — Slack Bolt app instance
 * @param {Object} digestData — Output from buildDigestData()
 * @param {string} [channelId] — Optional channel ID (defaults to #standup-digest)
 */
async function postDigest(app, digestData, channelId) {
  try {
    // Resolve the digest channel
    const targetChannel = channelId || (await findDigestChannel(app.client));

    if (!targetChannel) {
      console.error('❌ Could not find or create #standup-digest channel');
      return null;
    }

    const { status, summary, responses, rtsFindings } = digestData;
    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build Block Kit blocks for the digest message
    const blocks = [
      // Header with date and status
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Daily Standup Digest — ${dateLabel}`,
          emoji: true,
        },
      },
      // Team status bar
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Status:* ${status.emoji} ${status.label} — ${responses.length} update(s), ${rtsFindings.length} RTS flag(s)`,
        },
      },
      { type: 'divider' },
    ];

    // Individual team member updates
    if (responses.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*👤 Team Updates*',
        },
      });

      for (const r of responses) {
        const blockerText = hasRealBlocker(r.blockers)
          ? `\n>🛑 *Blocker:* ${r.blockers}`
          : '';

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${r.userId}>\n>✅ *Yesterday:* ${r.yesterday || '—'}\n>🎯 *Today:* ${r.today || '—'}${blockerText}`,
          },
        });
      }

      blocks.push({ type: 'divider' });
    }

    // AI Summary section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🤖 AI Summary*\n' + summary,
      },
    });

    // RTS Findings section
    if (rtsFindings.length > 0) {
      blocks.push({ type: 'divider' });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔍 RTS Blocker Flags*',
        },
      });

      for (const finding of rtsFindings) {
        const channelMentions = finding.matches
          .map((m) => `<#${m.channelId}>`)
          .filter((v, i, a) => a.indexOf(v) === i) // unique channels
          .join(', ');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔑 *"${finding.keyword}"* flagged by <@${finding.triggeredBy}> — found ${finding.matches.length} match(es) in ${channelMentions}`,
          },
        });
      }
    }

    // Footer
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🤖 Generated by StandupIQ at ${new Date().toLocaleTimeString()}`,
        },
      ],
    });

    // Post the digest message
    const result = await app.client.chat.postMessage({
      channel: targetChannel,
      text: `Standup Digest — ${dateLabel}`,
      blocks,
    });

    console.log(`📊 Digest posted to #standup-digest (ts: ${result.ts})`);
    return result;
  } catch (error) {
    console.error('Failed to post digest:', error.message);
    return null;
  }
}

/**
 * Finds or returns the #standup-digest channel ID.
 * Searches public channels for one named "standup-digest".
 *
 * @param {Object} client — Slack Bolt app client
 * @returns {Promise<string|null>} Channel ID or null if not found
 */
async function findDigestChannel(client) {
  try {
    // List conversations the bot is in and search for standup-digest
    const result = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 200,
    });

    console.log(`🔍 findDigestChannel: bot sees ${result.channels?.length || 0} channels`);
    if (result.channels?.length > 0) {
      const channelNames = result.channels.map(c => `#${c.name} (${c.id})`).join(', ');
      console.log(`📋 Channels found: ${channelNames}`);
    }

    const digestChannel = result.channels?.find(
      (ch) => ch.name === 'standup-digest' || ch.name_normalized === 'standup-digest'
    );

    if (digestChannel) {
      console.log(`📺 Found #standup-digest channel: ${digestChannel.id}`);
      return digestChannel.id;
    }

    console.warn('⚠️  #standup-digest channel not found — create it in Slack and invite the bot');
    return null;
  } catch (error) {
    console.error('Error finding digest channel:', error.message);
    return null;
  }
}

/**
 * Convenience function: generates a digest from responses and RTS findings,
 * then posts it to #standup-digest. This is the main entry point called
 * after standup responses are collected.
 *
 * @param {Object} app — Slack Bolt app instance
 * @param {Object[]} responses — Standup responses (from standup.getResponses())
 * @param {Object[]} [rtsFindings] — Optional RTS findings (from rts.detectBlockers())
 * @returns {Promise<Object|null>} Post result or null on failure
 */
async function generateAndPost(app, responses, rtsFindings = []) {
  try {
    console.log(`📊 generateAndPost called — ${responses.length} response(s), ${rtsFindings.length} RTS finding(s)`);

    if (responses.length === 0) {
      console.log('📊 No responses to generate digest from');
      return null;
    }

    console.log(`📊 Generating digest from ${responses.length} response(s)...`);
    const digestData = buildDigestData(responses, rtsFindings);
    console.log('📊 Digest data built, posting...');
    const result = await postDigest(app, digestData);
    console.log('📊 postDigest result:', result ? `posted (ts: ${result.ts})` : 'FAILED');

    return result;
  } catch (error) {
    console.error('Failed to generate and post digest:', error.message);
    return null;
  }
}

module.exports = { buildDigestData, postDigest, generateAndPost, generateSummary, getTeamStatus, hasRealBlocker };
