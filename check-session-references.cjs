const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

const db = new Database(dbPath, { readonly: true });

// Get all empty session IDs
const emptySessionIds = [];
const composerStmt = db.prepare('SELECT key, value FROM cursorDiskKV WHERE key LIKE \'composerData:%\'');

for (const row of composerStmt.iterate()) {
  try {
    const composerData = JSON.parse(row.value);
    const messageCount = composerData.fullConversationHeadersOnly?.length || 0;
    
    if (messageCount === 0) {
      const sessionId = row.key.replace('composerData:', '');
      emptySessionIds.push(sessionId);
    }
  } catch (err) {}
}

console.log(`Found ${emptySessionIds.length} empty sessions\n`);
console.log('Checking for references to empty sessions...\n');

// Check if empty sessions have any bubbleId entries
let bubblesFound = 0;
for (const sessionId of emptySessionIds.slice(0, 10)) {  // Check first 10 as sample
  const bubbleStmt = db.prepare('SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE ?');
  const result = bubbleStmt.get(`bubbleId:${sessionId}:%`);
  if (result.count > 0) {
    bubblesFound++;
    console.log(`Session ${sessionId.substring(0, 8)}... has ${result.count} bubble entries`);
  }
}

console.log(`\nOut of 10 sampled empty sessions: ${bubblesFound} have bubble data\n`);

// Check for any other references
console.log('Checking for other key patterns...\n');
const allKeysStmt = db.prepare('SELECT DISTINCT substr(key, 1, instr(key, \':\') - 1) as prefix FROM cursorDiskKV WHERE key LIKE \'%:%\' GROUP BY prefix');
console.log('Key prefixes in database:');
for (const row of allKeysStmt.iterate()) {
  console.log(`  - ${row.prefix}`);
}

db.close();
