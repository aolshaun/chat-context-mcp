/**
 * Show messages from a Cursor session
 */

import { CursorDB, getCursorDBPath } from '../src/core/index.js';

const dbPath = getCursorDBPath();
const db = new CursorDB(dbPath);

console.log('Finding sessions with messages...\n');

const sessionIds = db.listComposerIds(20);

for (const sessionId of sessionIds) {
  const bubbles = db.getSessionBubbles(sessionId);
  
  if (bubbles.length > 0) {
    console.log('='.repeat(80));
    console.log(`Session: ${sessionId}`);
    console.log(`Messages: ${bubbles.length}`);
    console.log('='.repeat(80));
    
    // Show first 3 messages
    const toShow = Math.min(3, bubbles.length);
    for (let i = 0; i < toShow; i++) {
      const bubble = bubbles[i]!;
      const role = bubble.type === 1 ? 'USER' : 'ASSISTANT';
      const content = bubble.text || (bubble.richText ? '[Rich Text]' : '[No content]');
      const preview = content.substring(0, 200);
      
      console.log(`\n[${role}]`);
      console.log(preview);
      if (content.length > 200) {
        console.log('...');
      }
    }
    
    if (bubbles.length > toShow) {
      console.log(`\n... and ${bubbles.length - toShow} more messages`);
    }
    
    console.log('\n');
    break; // Found one, that's enough for demo
  }
}

db.close();

