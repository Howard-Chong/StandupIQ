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
 * Stores a standup response by appending it to the JSON file.
 *
 * @param {Object} entry — { userId, userName, yesterday, today, blockers }
 */
function storeResponse(entry) {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const responses = JSON.parse(raw);

    responses.push({
      ...entry,
      submittedAt: new Date().toISOString(),
    });

    fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2), 'utf-8');
    console.log(`📥 Standup response saved to file — ${responses.length} total`);
  } catch (error) {
    console.error('Error saving response:', error.message);
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
