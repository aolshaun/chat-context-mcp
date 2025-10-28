/**
 * Test the high-level CursorContext API
 */

import { CursorContext } from '../src/core/index.js';

console.log('='.repeat(80));
console.log('Cursor Context API - Complete Example');
console.log('='.repeat(80));

// Create API instance (auto-detects paths)
const api = new CursorContext();

async function main() {
  try {
    // 1. Sync sessions from Cursor DB
    console.log('\n📥 Syncing sessions...');
    const synced = await api.syncSessions(20);
    console.log(`✓ Synced ${synced} new sessions`);
    
    // 2. Get statistics
    console.log('\n📊 Database Statistics:');
    const stats = api.getStats();
    console.log(`  Total sessions in Cursor: ${stats.totalSessionsInCursor}`);
    console.log(`  Synced to metadata DB: ${stats.totalSessionsWithMetadata}`);
    console.log(`  With nicknames: ${stats.sessionsWithNicknames}`);
    console.log(`  With tags: ${stats.sessionsWithTags}`);
    console.log(`  With projects: ${stats.sessionsWithProjects}`);
    console.log(`  Total projects: ${stats.totalProjects}`);
    console.log(`  Total tags: ${stats.totalTags}`);
    
    // 3. List recent sessions
    console.log('\n📝 Recent Sessions (top 5):');
    const recentSessions = await api.listSessions({ limit: 5, sortBy: 'newest' });
    recentSessions.forEach((session, i) => {
      console.log(`  ${i + 1}. ${session.nickname || session.session_id.substring(0, 8)}`);
      console.log(`     Project: ${session.project_name || 'none'}`);
      console.log(`     Messages: ${session.message_count || 0}`);
      if (session.tags && session.tags.length > 0) {
        console.log(`     Tags: ${session.tags.join(', ')}`);
      }
    });
    
    // 4. Set a nickname for the first session
    if (recentSessions.length > 0) {
      const firstSession = recentSessions[0]!;
      const nickname = `demo-session-${Date.now()}`;
      
      console.log(`\n🏷️  Setting nickname: "${nickname}"`);
      await api.setNickname(firstSession.session_id, nickname);
      
      // Add some tags
      console.log('🏷️  Adding tags...');
      await api.addTag(firstSession.session_id, 'demo');
      await api.addTag(firstSession.session_id, 'example');
      
      // Get the session by nickname
      console.log(`\n📖 Fetching session by nickname: "${nickname}"`);
      const session = await api.getSession(nickname);
      console.log(`✓ Found session: ${session.metadata.session_id}`);
      console.log(`  Nickname: ${session.metadata.nickname}`);
      console.log(`  Tags: ${session.metadata.tags?.join(', ')}`);
      console.log(`  Messages: ${session.messages.length}`);
      
      // Show first message
      if (session.messages.length > 0) {
        const firstMsg = session.messages[0]!;
        console.log(`\n  First message (${firstMsg.role}):`);
        const preview = firstMsg.content?.substring(0, 100) || '(no content)';
        console.log(`  "${preview}${firstMsg.content && firstMsg.content.length > 100 ? '...' : ''}"`);
      }
    }
    
    // 5. Search for sessions
    console.log('\n🔍 Searching for sessions with "test"...');
    const searchResults = await api.searchSessions({ 
      query: 'test', 
      limit: 3 
    });
    console.log(`✓ Found ${searchResults.length} matching sessions`);
    searchResults.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.nickname || result.session_id.substring(0, 8)}`);
    });
    
    // 6. List projects
    const projects = api.getProjects();
    if (projects.length > 0) {
      console.log(`\n📁 Projects (top 5):`);
      projects.slice(0, 5).forEach((project, i) => {
        console.log(`  ${i + 1}. ${project.name || 'unknown'}`);
        console.log(`     Path: ${project.path}`);
        console.log(`     Sessions: ${project.session_count}`);
      });
    }
    
    // 7. List tags
    const tags = api.getTags();
    if (tags.length > 0) {
      console.log(`\n🏷️  Popular Tags (top 5):`);
      tags.slice(0, 5).forEach((tag, i) => {
        console.log(`  ${i + 1}. ${tag.tag} (${tag.count} sessions)`);
      });
    }
    
    // 8. Filter by project
    if (projects.length > 0) {
      const firstProject = projects[0]!;
      console.log(`\n📂 Sessions in project "${firstProject.name}":`);
      const projectSessions = await api.listSessions({ 
        projectPath: firstProject.path,
        limit: 3
      });
      projectSessions.forEach((session, i) => {
        console.log(`  ${i + 1}. ${session.nickname || session.session_id.substring(0, 8)}`);
        console.log(`     Messages: ${session.message_count || 0}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ API Demo Complete!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    // Always close connections
    api.close();
  }
}

main();

