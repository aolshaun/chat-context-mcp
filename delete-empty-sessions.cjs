const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

// Open database in read-write mode
const db = new Database(dbPath, { readonly: false });

console.log('🔍 Finding empty sessions...\n');

// Find all empty sessions
const emptySessionKeys = [];
const selectStmt = db.prepare('SELECT key, value FROM cursorDiskKV WHERE key LIKE \'composerData:%\'');

for (const row of selectStmt.iterate()) {
  try {
    const composerData = JSON.parse(row.value);
    const messageCount = composerData.fullConversationHeadersOnly?.length || 0;
    
    if (messageCount === 0) {
      emptySessionKeys.push(row.key);
    }
  } catch (err) {
    console.error(`Error parsing session ${row.key}:`, err.message);
  }
}

console.log(`Found ${emptySessionKeys.length} empty sessions to delete\n`);

if (emptySessionKeys.length === 0) {
  console.log('No empty sessions to delete. Exiting.');
  db.close();
  process.exit(0);
}

console.log('🗑️  Deleting empty sessions...\n');

// Delete them
const deleteStmt = db.prepare('DELETE FROM cursorDiskKV WHERE key = ?');
let deleted = 0;

const transaction = db.transaction(() => {
  for (const key of emptySessionKeys) {
    deleteStmt.run(key);
    deleted++;
    
    if (deleted % 50 === 0) {
      process.stdout.write(`\rDeleted ${deleted}/${emptySessionKeys.length}...`);
    }
  }
});

transaction();

console.log(`\n\n✅ Successfully deleted ${deleted} empty sessions!`);

// Vacuum to reclaim space
console.log('\n�� Vacuuming database to reclaim space...');
db.exec('VACUUM');

console.log('✅ Database compacted!\n');

// Show new stats
const totalStmt = db.prepare('SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE \'composerData:%\'');
const totalResult = totalStmt.get();

console.log(`📊 Final stats:`);
console.log(`   Total sessions remaining: ${totalResult.count}`);

db.close();
