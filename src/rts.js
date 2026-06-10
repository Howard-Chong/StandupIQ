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
 * Searches Slack for messages matching a given query using the
 * search.messages API. Returns relevant message excerpts.
 *
 * @param {Object} client — Slack Bolt app client
 * @param {string} query — Search query string
 * @returns {Promise<Object[]>} Array of search result objects
 */
async function searchMessages(client, query) {
  try {
    const result = await client.search.messages({
      query,
      sort: 'timestamp',
      count: 5,
    });

    const matches = result.messages?.matches || [];

    return matches.map((match) => ({
      channelId: match.channel?.id || 'unknown',
      channelName: match.channel?.name || 'unknown',
      text: match.text || '',
      permalink: match.permalink || '',
      timestamp: match.ts || '',
      userId: match.user || '',
      username: match.username || 'unknown',
    }));
  } catch (error) {
    // If search fails (e.g., missing scope), return empty array gracefully
    console.error(`RTS search failed for query "${query}":`, error.message);
    return [];
  }
}

/**
 * Detects potential hidden blockers by extracting keywords from
 * standup blocker responses and searching Slack channels for
 * related messages.
 *
 * For each response that has blockers, extracts keywords and runs
 * a search. Returns any findings that may indicate unresolved issues.
 *
 * @param {Object} client — Slack Bolt app client
 * @param {Object[]} responses — Standup responses (from standup.getResponses())
 * @returns {Promise<Object[]>} Array of flagged findings with keyword and message context
 */
async function detectBlockers(client, responses) {
  const findings = [];

  // Only process responses that have blockers
  const responsesWithBlockers = responses.filter((r) => r.blockers && r.blockers.trim());

  if (responsesWithBlockers.length === 0) {
    console.log('🔍 RTS: No blockers to search for');
    return findings;
  }

  console.log(`🔍 RTS: Scanning blockers from ${responsesWithBlockers.length} response(s)...`);

  for (const response of responsesWithBlockers) {
    const keywords = extractKeywords(response.blockers);

    if (keywords.length === 0) {
      continue;
    }

    // Search each keyword individually for targeted results
    for (const keyword of keywords) {
      const matches = await searchMessages(client, keyword);

      if (matches.length > 0) {
        findings.push({
          keyword,
          triggeredBy: response.userId,
          triggeredByName: response.userName,
          matches,
        });

        console.log(`🔍 RTS: Keyword "${keyword}" returned ${matches.length} match(es)`);
      }
    }
  }

  console.log(`🔍 RTS: Scan complete — ${findings.length} finding(s)`);
  return findings;
}

module.exports = { detectBlockers, extractKeywords, searchMessages };
