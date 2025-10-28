const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

const db = new Database(dbPath, { readonly: true });

const stmt = db.prepare('SELECT key, value FROM cursorDiskKV WHERE key LIKE \'composerData:%\'');

let totalSessions = 0;
let emptySessionCount = 0;
let messageCountDistribution = new Map();

for (const row of stmt.iterate()) {
  totalSessions++;
  
  try {
    const composerData = JSON.parse(row.value);
    const messageCount = composerData.fullConversationHeadersOnly?.length || 0;
    
    // Count distribution
    messageCountDistribution.set(messageCount, (messageCountDistribution.get(messageCount) || 0) + 1);
    
    if (messageCount === 0) {
      emptySessionCount++;
    }
    
  } catch (err) {
    // Skip malformed JSON
  }
}

console.log('📊 SESSION MESSAGE COUNT ANALYSIS:\n');
console.log(`Total sessions: ${totalSessions}`);
console.log(`Empty sessions (0 messages): ${emptySessionCount} (${Math.round(emptySessionCount/totalSessions*100)}%)`);
console.log(`Sessions with messages: ${totalSessions - emptySessionCount} (${Math.round((totalSessions - emptySessionCount)/totalSessions*100)}%)\n`);

console.log('📈 MESSAGE COUNT DISTRIBUTION:\n');

// Sort by message count
const sorted = Array.from(messageCountDistribution.entries())
  .sort((a, b) => a[0] - b[0]);

// Show first 20 buckets
console.log('Messages → Session Count');
console.log('='.repeat(40));
for (const [count, sessions] of sorted.slice(0, 30)) {
  console.log(`${String(count).padStart(8)} → ${sessions}`);
}

if (sorted.length > 30) {
  console.log(`... and ${sorted.length - 30} more message count buckets`);
}

db.close();
