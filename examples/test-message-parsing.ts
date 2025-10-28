/**
 * Test message parsing from Cursor sessions
 */

import { CursorDB, getCursorDBPath, parseBubbles, getConversationOnly, estimateTokens } from '../src/core/index.js';

console.log('='.repeat(80));
console.log('Cursor Context - Message Parsing Test');
console.log('='.repeat(80));

const dbPath = getCursorDBPath();
const db = new CursorDB(dbPath);

// Find a session with messages
const sessionIds = db.listComposerIds(20);
let foundSession = false;

for (const sessionId of sessionIds) {
  try {
    const bubbles = db.getSessionBubbles(sessionId);
    
    if (bubbles.length >= 5) {
      console.log(`\nTesting with session: ${sessionId}`);
      console.log(`Total messages: ${bubbles.length}\n`);
      
      // Parse all messages
      const messages = parseBubbles(bubbles);
      
      console.log('-'.repeat(80));
      console.log('Parsed Messages (first 5):');
      console.log('-'.repeat(80));
      
      for (let i = 0; i < Math.min(5, messages.length); i++) {
        const msg = messages[i]!;
        const preview = msg.content.substring(0, 150);
        
        console.log(`\n[${i + 1}] ${msg.role.toUpperCase()}`);
        console.log(`Bubble ID: ${msg.bubbleId.substring(0, 8)}...`);
        console.log(`Timestamp: ${msg.timestamp || 'N/A'}`);
        console.log(`Content length: ${msg.content.length} chars (~${estimateTokens(msg.content)} tokens)`);
        console.log(`Content: ${preview}${msg.content.length > 150 ? '...' : ''}`);
        
        if (msg.toolData) {
          console.log(`Tool: ${msg.toolData.name}`);
          if (msg.toolData.workspacePath) {
            console.log(`Workspace: ${msg.toolData.workspacePath}`);
          }
        }
      }
      
      // Test filtering
      console.log('\n' + '-'.repeat(80));
      console.log('Message Statistics:');
      console.log('-'.repeat(80));
      
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      const toolMessages = messages.filter(m => m.toolData);
      const conversationOnly = getConversationOnly(messages);
      
      console.log(`User messages: ${userMessages.length}`);
      console.log(`Assistant messages: ${assistantMessages.length}`);
      console.log(`Messages with tool calls: ${toolMessages.length}`);
      console.log(`Conversation only (no tools): ${conversationOnly.length}`);
      
      // Calculate total tokens
      const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      console.log(`\nEstimated total tokens: ${totalTokens.toLocaleString()}`);
      
      // Test with excludeTools option
      console.log('\n' + '-'.repeat(80));
      console.log('Parsing with excludeTools option:');
      console.log('-'.repeat(80));
      
      const messagesNoTools = parseBubbles(bubbles, { excludeTools: true });
      const withTools = messages.filter(m => m.toolData).length;
      const withoutTools = messagesNoTools.filter(m => m.toolData).length;
      
      console.log(`Messages with tool data (default): ${withTools}`);
      console.log(`Messages with tool data (excludeTools): ${withoutTools}`);
      console.log(`✓ Tool exclusion working: ${withoutTools === 0 ? 'Yes' : 'No'}`);
      
      foundSession = true;
      break;
    }
  } catch (error) {
    // Skip this session
  }
}

if (!foundSession) {
  console.log('\n⚠️  No sessions with enough messages found for testing');
}

db.close();

console.log('\n' + '='.repeat(80));
console.log('✓ Message parsing test complete!');
console.log('='.repeat(80));

