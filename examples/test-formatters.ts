/**
 * Test session formatters
 */

import {
  CursorDB,
  MetadataDB,
  getCursorDBPath,
  getMetadataDBPath,
  parseBubbles,
  getWorkspaceInfo,
  formatSessionMarkdown,
  formatSessionJSON,
  formatSessionPreview,
  formatSessionList
} from '../src/core/index.js';
import type { SessionWithMessages } from '../src/core/types.js';

console.log('='.repeat(80));
console.log('Cursor Context - Formatters Test');
console.log('='.repeat(80));

const cursorDB = new CursorDB(getCursorDBPath());
const metadataDB = new MetadataDB(getMetadataDBPath());

// Find a session with messages
const sessionIds = cursorDB.listComposerIds(20);
let foundSession: SessionWithMessages | null = null;

for (const sessionId of sessionIds) {
  try {
    const bubbles = cursorDB.getSessionBubbles(sessionId);
    
    if (bubbles.length >= 3) {
      const messages = parseBubbles(bubbles);
      const workspaceInfo = getWorkspaceInfo(bubbles);
      
      // Create or get metadata
      let metadata = metadataDB.getSessionMetadata(sessionId);
      if (!metadata) {
        const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
        metadata = {
          session_id: sessionId,
          project_path: workspaceInfo.primaryPath,
          project_name: workspaceInfo.projectName,
          has_project: workspaceInfo.hasProject,
          first_message_preview: firstUserMsg.substring(0, 100),
          message_count: messages.length,
          tags: ['test', 'example'],
          nickname: 'test-formatter-session'
        };
        metadataDB.upsertSessionMetadata(metadata);
      }
      
      foundSession = {
        metadata,
        messages: messages.slice(0, 5) // First 5 messages only
      };
      break;
    }
  } catch (error) {
    // Skip this session
  }
}

if (!foundSession) {
  console.log('No suitable session found for testing!');
  process.exit(0);
}

console.log('\n' + '-'.repeat(80));
console.log('Test 1: Markdown Format (first 3 messages)');
console.log('-'.repeat(80));

const markdown = formatSessionMarkdown(foundSession, { maxMessages: 3 });
console.log(markdown);

console.log('\n' + '-'.repeat(80));
console.log('Test 2: Markdown Format (no tools, no metadata)');
console.log('-'.repeat(80));

const markdownNoTools = formatSessionMarkdown(foundSession, { 
  maxMessages: 3,
  includeTools: false,
  includeMetadata: false
});
console.log(markdownNoTools);

console.log('\n' + '-'.repeat(80));
console.log('Test 3: JSON Format');
console.log('-'.repeat(80));

const json = formatSessionJSON(foundSession, { maxMessages: 2 });
console.log(json.substring(0, 500) + '\n... (truncated)');

console.log('\n' + '-'.repeat(80));
console.log('Test 4: Preview Format');
console.log('-'.repeat(80));

const preview = formatSessionPreview(foundSession.metadata);
console.log(preview);

console.log('\n' + '-'.repeat(80));
console.log('Test 5: List Format');
console.log('-'.repeat(80));

// Get a few sessions for list test
const sessionMetadatas = metadataDB.listSessions({ limit: 5 });
const list = formatSessionList(sessionMetadatas);
console.log(list);

// Cleanup
metadataDB.deleteSessionMetadata(foundSession.metadata.session_id);
cursorDB.close();
metadataDB.close();

console.log('\n' + '='.repeat(80));
console.log('✓ Formatter tests complete!');
console.log('='.repeat(80));

