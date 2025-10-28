#!/usr/bin/env node

/**
 * Universal Anchor Finder
 * 
 * Finds ALL fields in composerData that contain file paths,
 * WITHOUT needing to know project names in advance.
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

const db = new Database(dbPath, { readonly: true });

// Map to store: field path -> count of sessions where it contains a file path
const anchorMap = new Map();
let sessionsWithPaths = 0;
let totalSessions = 0;

// Patterns that indicate a file path
const FILE_PATH_PATTERNS = [
  /file:\/\/\//i,
  /^\/Users\//i,
  /^\/home\//i,
  /^[A-Z]:\\/i,  // Windows paths
  /\.ts$|\.js$|\.py$|\.java$|\.go$|\.rb$|\.php$|\.jsx$|\.tsx$/i,  // File extensions
];

function containsFilePath(value) {
  if (typeof value !== 'string') return false;
  return FILE_PATH_PATTERNS.some(pattern => pattern.test(value));
}

function searchForFilePaths(obj, currentPath = '', sessionHasPaths) {
  if (typeof obj === 'string') {
    if (containsFilePath(obj)) {
      const key = currentPath || 'root';
      anchorMap.set(key, (anchorMap.get(key) || 0) + 1);
      sessionHasPaths.found = true;
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      searchForFilePaths(item, `${currentPath}[${index}]`, sessionHasPaths);
    });
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      searchForFilePaths(value, newPath, sessionHasPaths);
    }
  }
}

console.log('🔍 Searching for ALL file path anchors in Cursor database...\n');

// Get all composerData entries
const stmt = db.prepare(`
  SELECT key, value 
  FROM cursorDiskKV 
  WHERE key LIKE 'composerData:%'
`);

for (const row of stmt.iterate()) {
  totalSessions++;
  
  try {
    const composerData = JSON.parse(row.value);
    const sessionHasPaths = { found: false };
    
    searchForFilePaths(composerData, '', sessionHasPaths);
    
    if (sessionHasPaths.found) {
      sessionsWithPaths++;
    }

    // Progress indicator
    if (totalSessions % 50 === 0) {
      process.stdout.write(`\rProcessed ${totalSessions} sessions...`);
    }
  } catch (err) {
    // Skip malformed JSON
  }
}

console.log(`\n\n✅ Processed ${totalSessions} total sessions`);
console.log(`📊 Found file paths in ${sessionsWithPaths} sessions (${Math.round(sessionsWithPaths/totalSessions*100)}%)\n`);

// Sort by frequency
const sortedAnchors = Array.from(anchorMap.entries())
  .sort((a, b) => b[1] - a[1])
  .filter(([_, count]) => count >= 3);  // Filter out rare fields

console.log('📍 ANCHOR FIELDS (where file paths appear):\n');
console.log('Field Path → Sessions Count\n' + '='.repeat(70));

for (const [fieldPath, count] of sortedAnchors.slice(0, 100)) {
  console.log(`${fieldPath.padEnd(55)} → ${count}`);
}

console.log(`\n... and ${sortedAnchors.length - 100} more fields`);

db.close();

