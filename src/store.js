// src/store.js — JSON file persistence layer for standup responses
// Replaces in-memory storage so responses survive bot restarts.
// Data is stored in data/responses.json (gitignored).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');

/**
 * Ensures the data directory and file exist.
 * Called automatically before any read/write operation.
 */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
}

/**
 * Returns all stored standup responses (most recent first).
 *
 * @returns {Object[]} Array of stored responses
 */
function getResponses() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const responses = JSON.parse(raw);
    return responses.reverse(); // Most recent first
  } catch (error) {
    console.error('Error reading responses file:', error.message);
    return [];
  }
}

/**
 * Stores a standup response. If the user already submitted today,
 * replaces their previous entry instead of creating a duplicate.
 *
 * @param {Object} entry — { userId, userName, yesterday, today, blockers }
 * @returns {{ isUpdate: boolean, total: number }} Whether it was an update
 */
function storeResponse(entry) {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const responses = JSON.parse(raw);

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const newEntry = {
      ...entry,
      submittedAt: now.toISOString(),
    };

    // Check if same user already submitted today — replace if so
    const existingIndex = responses.findIndex((r) => {
      const entryDate = (r.submittedAt || '').slice(0, 10);
      return r.userId === entry.userId && entryDate === today;
    });

    let isUpdate = false;

    if (existingIndex >= 0) {
      responses[existingIndex] = newEntry;
      isUpdate = true;
      console.log(`📝 Standup response updated for <@${entry.userId}> — ${responses.length} total`);
    } else {
      responses.push(newEntry);
      console.log(`📥 Standup response saved for <@${entry.userId}> — ${responses.length} total`);
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2), 'utf-8');
    return { isUpdate, total: responses.length };
  } catch (error) {
    console.error('Error saving response:', error.message);
    return { isUpdate: false, total: 0 };
  }
}

/**
 * Clears all stored responses from the file.
 */
function clearResponses() {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
    console.log('🧹 Standup responses cleared from file');
  } catch (error) {
    console.error('Error clearing responses:', error.message);
  }
}

/**
 * Returns the count of stored responses without loading all data.
 *
 * @returns {number} Number of stored responses
 */
function count() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw).length;
  } catch {
    return 0;
  }
}

module.exports = { getResponses, storeResponse, clearResponses, count };
