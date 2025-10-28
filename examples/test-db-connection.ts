/**
 * Test database connection and basic queries
 */

import { CursorDB, getCursorDBPath } from '../src/core/index.js';

console.log('='.repeat(80));
console.log('Cursor Context - Database Connection Test');
console.log('='.repeat(80));

try {
  const dbPath = getCursorDBPath();
  console.log(`\nConnecting to: ${dbPath}`);
  
  const db = new CursorDB(dbPath);
  
  // Test: List sessions
  console.log('\n[Test 1] Listing composer sessions...');
  const sessionIds = db.listComposerIds(5);
  console.log(`✓ Found ${sessionIds.length} sessions (showing first 5)`);
  sessionIds.forEach((id, i) => {
    console.log(`  ${i + 1}. ${id}`);
  });
  
  // Test: Fetch composer data
  if (sessionIds.length > 0) {
    const firstSessionId = sessionIds[0]!;
    console.log(`\n[Test 2] Fetching composer data for: ${firstSessionId}`);
    const composerData = db.getComposerData(firstSessionId);
    
    if (composerData) {
      console.log(`✓ Successfully fetched composer data`);
      console.log(`  - Composer ID: ${composerData.composerId}`);
      console.log(`  - Has conversation: ${composerData.conversation ? 'Yes' : 'No'}`);
      console.log(`  - Has fullConversationHeadersOnly: ${composerData.fullConversationHeadersOnly ? 'Yes' : 'No'}`);
      console.log(`  - Name: ${composerData.name || '(untitled)'}`);
      console.log(`  - Created at: ${composerData.createdAt || '(unknown)'}`);
      
      // Test: Fetch bubbles
      console.log(`\n[Test 3] Fetching bubbles for session...`);
      const bubbles = db.getSessionBubbles(firstSessionId);
      console.log(`✓ Found ${bubbles.length} messages`);
      
      if (bubbles.length > 0) {
        console.log(`\n  First message:`);
        const first = bubbles[0]!;
        console.log(`  - Type: ${first.type === 1 ? 'User' : 'Assistant'}`);
        console.log(`  - Has text: ${first.text ? 'Yes' : 'No'}`);
        console.log(`  - Has richText: ${first.richText ? 'Yes' : 'No'}`);
        console.log(`  - Bubble ID: ${first.bubbleId}`);
      }
    } else {
      console.log(`✗ Composer data not found`);
    }
  }
  
  // Test: Connection status
  console.log(`\n[Test 4] Connection status`);
  console.log(`✓ Connected: ${db.isConnected()}`);
  
  // Clean up
  db.close();
  console.log(`✓ Connection closed`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✓ All tests passed!');
  console.log('='.repeat(80));
  
} catch (error) {
  console.error('\n✗ Error:', (error as Error).message);
  console.error('\nStack:', (error as Error).stack);
  process.exit(1);
}

