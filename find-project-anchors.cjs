#!/usr/bin/env node

/**
 * Find Project Anchors Script
 * 
 * Searches the Cursor database for known project names and reports
 * WHERE in the JSON structure those project names appear.
 * This helps us reverse-engineer all possible anchor fields.
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Known project names from the user's /play folder
const KNOWN_PROJECTS = [
  'chat-context-mcp',
  'tapjot',
  'thedayis',
  'notebooklm-automator',
  'ascii-video-maker',
  'bbpool',
  'steffy',
  'new_fourchum',
  'codex',
  'labcart',
  'telegram-code',
  'ForgeML',
  'loopa',
  'dreammachine',
  'famouschains'
];

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

const db = new Database(dbPath, { readonly: true });

// Map to store: field path -> count of occurrences
const anchorMap = new Map();

function searchJsonForProjects(obj, currentPath = '', projectName) {
  if (typeof obj === 'string') {
    // Check if this string contains the project name
    if (obj.includes(projectName)) {
      const key = currentPath || 'root';
      anchorMap.set(key, (anchorMap.get(key) || 0) + 1);
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      searchJsonForProjects(item, `${currentPath}[${index}]`, projectName);
    });
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      searchJsonForProjects(value, newPath, projectName);
    }
  }
}

console.log('🔍 Searching for project anchors in Cursor database...\n');
console.log(`Projects to search: ${KNOWN_PROJECTS.join(', ')}\n`);

// Get all composerData entries
const stmt = db.prepare(`
  SELECT key, value 
  FROM cursorDiskKV 
  WHERE key LIKE 'composerData:%'
`);

let totalSessions = 0;
let sessionsWithProjects = 0;

for (const row of stmt.iterate()) {
  totalSessions++;
  
  try {
    const composerData = JSON.parse(row.value);
    let foundProjectInSession = false;

    // Search for each known project in this session
    for (const projectName of KNOWN_PROJECTS) {
      const beforeSize = anchorMap.size;
      searchJsonForProjects(composerData, '', projectName);
      
      if (anchorMap.size > beforeSize) {
        foundProjectInSession = true;
      }
    }

    if (foundProjectInSession) {
      sessionsWithProjects++;
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
console.log(`📊 Found projects in ${sessionsWithProjects} sessions\n`);

// Sort by frequency
const sortedAnchors = Array.from(anchorMap.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('📍 ANCHOR FIELDS (where project paths appear):\n');
console.log('Field Path → Count\n' + '='.repeat(60));

for (const [fieldPath, count] of sortedAnchors) {
  console.log(`${fieldPath.padEnd(50)} → ${count}`);
}

db.close();

