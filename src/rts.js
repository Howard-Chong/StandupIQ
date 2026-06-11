// src/rts.js — Real-Time Search API integration for blocker detection
// Extracts keywords from standup blocker responses and searches Slack
// channels for related messages that may indicate hidden blockers.

// Common English stop words to filter out of keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'you', 'your',
  'i', 'me', 'my', 'we', 'our', 'they', 'them', 'their', 'it', 'its',
  'this', 'that', 'these', 'those', 'not', 'no', 'nor', 'so', 'if',
  'then', 'than', 'too', 'very', 'just', 'about', 'also', 'am', 'been',
  'doing', 'get', 'got', 'here', 'how', 'into', 'out', 'over', 'some',
  'there', 'up', 'what', 'when', 'which', 'who', 'all', 'any', 'more',
  'most', 'other', 'only', 'own', 'same',
  // Noise words — common in standups but not useful for RTS
  'test', 'work', 'working', 'today', 'yesterday', 'just', 'new',
  'good', 'done', 'fixed', 'add', 'update', 'check', 'make', 'made',
  'need', 'needs', 'like', 'know', 'think', 'want', 'going', 'still',
  'try', 'trying', 'use', 'using', 'one', 'two', 'see', 'look',
  'throwing', 'error', 'continue', 'progress', 'halt', 'making',
  'getting', 'help', 'issue', 'problem',
]);

/**
 * Extracts meaningful keywords from a text string.
 * Splits on non-word characters, filters out stop words and short tokens,
 * and returns unique lowercase keywords.
 *
 * @param {string} text — Raw text to extract keywords from
 * @returns {string[]} Array of unique keywords (max 10)
 */
function extractKeywords(text) {
  if (!text || !text.trim()) {
    return [];
  }

  // Split on non-word characters and normalize
  const tokens = text
    .toLowerCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  // Filter out stop words, numbers-only tokens, and short tokens
  const keywords = tokens.filter((token) => {
    if (token.length <= 2) return false;        // too short
    if (/^\d+$/.test(token)) return false;      // numbers-only
    if (STOP_WORDS.has(token)) return false;    // stop word
    return true;
  });

  // Return unique keywords, capped at 10
  return [...new Set(keywords)].slice(0, 10);
}

/**
 * Searches recent Slack channel messages for a given keyword using
 * conversations.history. Bot tokens can't use search.messages,
 * so we scan channels the bot has access to instead.
 *
 * @param {Object} client — Slack Bolt app client
 * @param {string} query — Search keyword
 * @returns {Promise<Object[]>} Array of matching message objects
 */
async function searchMessages(client, query) {
  try {
    // Get list of channels the bot is in
    const channelList = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 50,
    });

    const channels = channelList.channels || [];
    const channelNames = channels.map(c => `#${c.name}`).join(', ');
    console.log(`   🔎 Scanning ${channels.length} channel(s) [${channelNames}] for "${query}"...`);

    const allMatches = [];
    const lowerQuery = query.toLowerCase();

    for (const channel of channels) {
      try {
        const history = await client.conversations.history({
          channel: channel.id,
          limit: 50,
        });

        for (const msg of history.messages || []) {
          if (msg.subtype === 'bot_message' || msg.bot_id) continue;
          const text = msg.text || '';
          if (!text.trim()) continue;

          if (text.toLowerCase().includes(lowerQuery)) {
            allMatches.push({
              channelId: channel.id,
              channelName: channel.name || 'unknown',
              text: text,
              permalink: `https://slack.com/archives/${channel.id}/p${msg.ts.replace('.', '')}`,
              timestamp: msg.ts || '',
              userId: msg.user || '',
              username: msg.user || 'unknown',
            });
          }
        }
      } catch (channelError) {
        // Skip channels the bot can't read
        continue;
      }
    }

    console.log(`   ✅ Found ${allMatches.length} match(es)`);
    return allMatches.slice(0, 5);
  } catch (error) {
    console.error(`❌ RTS search failed for "${query}": ${error.message}`);
    return [];
  }
}

/**
 * Detects potential hidden blockers by extracting keywords from
 * all standup response fields (yesterday, today, blockers) and
 * searching Slack channels for related messages.
 *
 * For each response, extracts keywords from all text fields and runs
 * a search. Returns any findings that may indicate unresolved issues.
 *
 * @param {Object} client — Slack Bolt app client
 * @param {Object[]} responses — Standup responses (from standup.getResponses())
 * @returns {Promise<Object[]>} Array of flagged findings with keyword and message context
 */
async function detectBlockers(client, responses) {
  const seenKeywords = new Set(); // avoid duplicate keyword searches
  // Group findings by unique message (channelId + timestamp)
  const findingMap = new Map();

  if (responses.length === 0) {
    console.log('🔍 RTS: No responses to scan');
    return [];
  }

  console.log(`🔍 RTS: Scanning ${responses.length} response(s) for hidden blockers...`);

  for (const response of responses) {
    // Extract keywords from today and blockers only (not yesterday — past work)
    const allText = [response.today, response.blockers]
      .filter((t) => t && t.trim())
      .join(' ');

    if (!allText.trim()) {
      continue;
    }

    const keywords = extractKeywords(allText);
    console.log(`🔍 RTS: @${response.userName} — keywords: [${keywords.join(', ')}]`);

    if (keywords.length === 0) {
      continue;
    }

    // Search each keyword individually
    for (const keyword of keywords) {
      if (seenKeywords.has(keyword)) {
        console.log(`🔍 RTS: Skipping duplicate keyword "${keyword}"`);
        continue;
      }
      seenKeywords.add(keyword);

      const matches = await searchMessages(client, keyword);
      console.log(`🔍 RTS: Keyword "${keyword}" — ${matches.length} match(es)`);

      if (matches.length > 0) {
        matches.forEach((m) => {
          console.log(`   📍 #${m.channelName}: "${m.text.substring(0, 80)}..."`);
        });

        // Group matches by message — merge keywords that hit the same message
        for (const match of matches) {
          const msgKey = `${match.channelId}:${match.timestamp}`;

          if (findingMap.has(msgKey)) {
            // Same message already flagged — add this keyword
            const existing = findingMap.get(msgKey);
            if (!existing.keywords.includes(keyword)) {
              existing.keywords.push(keyword);
            }
          } else {
            // New message — create a finding
            findingMap.set(msgKey, {
              keywords: [keyword],
              triggeredBy: response.userId,
              triggeredByName: response.userName,
              channelId: match.channelId,
              channelName: match.channelName,
              text: match.text,
              permalink: match.permalink,
              timestamp: match.timestamp,
            });
          }
        }
      }
    }
  }

  // Convert map to findings array with the expected format
  const findings = [];
  for (const finding of findingMap.values()) {
    findings.push({
      keyword: finding.keywords.join(', '),
      triggeredBy: finding.triggeredBy,
      triggeredByName: finding.triggeredByName,
      matches: [{
        channelId: finding.channelId,
        channelName: finding.channelName,
        text: finding.text,
        permalink: finding.permalink,
        timestamp: finding.timestamp,
      }],
    });
  }

  console.log(`🔍 RTS: Scan complete — ${findings.length} finding(s) (${findingMap.size} grouped messages)`);
  return findings;
}

module.exports = { detectBlockers, extractKeywords, searchMessages };
