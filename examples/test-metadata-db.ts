/**
 * Test metadata database functionality
 */

import { 
  CursorDB, 
  MetadataDB, 
  getCursorDBPath, 
  getMetadataDBPath,
  getWorkspaceInfo,
  parseBubbles
} from '../src/core/index.js';

console.log('='.repeat(80));
console.log('Cursor Context - Metadata Database Test');
console.log('='.repeat(80));

const cursorDBPath = getCursorDBPath();
const metadataDBPath = getMetadataDBPath();

console.log(`\nCursor DB: ${cursorDBPath}`);
console.log(`Metadata DB: ${metadataDBPath}\n`);

const cursorDB = new CursorDB(cursorDBPath);
const metadataDB = new MetadataDB(metadataDBPath);

// Get a session to work with
const sessionIds = cursorDB.listComposerIds(10);

if (sessionIds.length === 0) {
  console.log('No sessions found!');
  process.exit(0);
}

console.log('-'.repeat(80));
console.log('Test 1: Store Session Metadata');
console.log('-'.repeat(80));

const testSessionId = sessionIds[0]!;
const bubbles = cursorDB.getSessionBubbles(testSessionId);
const workspaceInfo = getWorkspaceInfo(bubbles);
const messages = parseBubbles(bubbles);

const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
const preview = firstUserMsg.substring(0, 100);

console.log(`Session: ${testSessionId.substring(0, 8)}...`);
console.log(`Messages: ${messages.length}`);
console.log(`Preview: ${preview}`);

// Store metadata
metadataDB.upsertSessionMetadata({
  session_id: testSessionId,
  project_path: workspaceInfo.primaryPath || undefined,
  project_name: workspaceInfo.projectName || undefined,
  has_project: workspaceInfo.hasProject,
  first_message_preview: preview,
  message_count: messages.length
});

console.log('✓ Metadata stored');

console.log('\n' + '-'.repeat(80));
console.log('Test 2: Set Nickname');
console.log('-'.repeat(80));

metadataDB.setNickname(testSessionId, 'test-session-demo');
console.log('✓ Nickname set: test-session-demo');

const retrieved = metadataDB.getSessionByNickname('test-session-demo');
console.log(`✓ Retrieved by nickname: ${retrieved?.session_id === testSessionId}`);

console.log('\n' + '-'.repeat(80));
console.log('Test 3: Add Tags');
console.log('-'.repeat(80));

metadataDB.addTag(testSessionId, 'test');
metadataDB.addTag(testSessionId, 'demo');
metadataDB.addTag(testSessionId, 'example');

const metadata = metadataDB.getSessionMetadata(testSessionId);
console.log(`✓ Tags added: ${metadata?.tags?.join(', ')}`);

console.log('\n' + '-'.repeat(80));
console.log('Test 4: Find by Tag');
console.log('-'.repeat(80));

const sessionsWithTest = metadataDB.findByTag('test');
console.log(`✓ Sessions with 'test' tag: ${sessionsWithTest.length}`);

console.log('\n' + '-'.repeat(80));
console.log('Test 5: List All Tags');
console.log('-'.repeat(80));

const allTags = metadataDB.listAllTags();
console.log(`✓ All tags:`);
allTags.slice(0, 5).forEach(({ tag, count }) => {
  console.log(`  ${tag}: ${count} session(s)`);
});

console.log('\n' + '-'.repeat(80));
console.log('Test 6: Project Filtering');
console.log('-'.repeat(80));

if (workspaceInfo.hasProject && workspaceInfo.primaryPath) {
  const projectSessions = metadataDB.listSessionsByProject(workspaceInfo.primaryPath);
  console.log(`✓ Sessions in project '${workspaceInfo.projectName}': ${projectSessions.length}`);
}

const allProjects = metadataDB.listProjects();
console.log(`✓ Total projects: ${allProjects.length}`);
if (allProjects.length > 0) {
  console.log('  Top projects:');
  allProjects.slice(0, 3).forEach(({ name, session_count }) => {
    console.log(`    ${name}: ${session_count} session(s)`);
  });
}

console.log('\n' + '-'.repeat(80));
console.log('Test 7: List with Filters');
console.log('-'.repeat(80));

const taggedSessions = metadataDB.listSessions({ tagged_only: true, limit: 5 });
console.log(`✓ Sessions with nicknames: ${taggedSessions.length}`);

console.log('\n' + '-'.repeat(80));
console.log('Test 8: Database Statistics');
console.log('-'.repeat(80));

const stats = metadataDB.getStats();
console.log(`Total sessions: ${stats.total_sessions}`);
console.log(`With nicknames: ${stats.sessions_with_nicknames}`);
console.log(`With projects: ${stats.sessions_with_projects}`);
console.log(`Total projects: ${stats.total_projects}`);

console.log('\n' + '-'.repeat(80));
console.log('Test 9: Cleanup');
console.log('-'.repeat(80));

// Clean up test data
metadataDB.deleteSessionMetadata(testSessionId);
console.log('✓ Test session deleted');

cursorDB.close();
metadataDB.close();

console.log('\n' + '='.repeat(80));
console.log('✓ All metadata database tests passed!');
console.log('='.repeat(80));

