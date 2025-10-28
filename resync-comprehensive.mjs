import { CursorContext } from './dist/core/index.js';

const ctx = new CursorContext();
console.log('🔄 Syncing sessions with comprehensive detection...\n');
const count = await ctx.syncSessions();
console.log(`\n✅ Synced ${count} sessions\n`);
const stats = ctx.getStats();
console.log('📊 Final Stats:');
console.log(`   Total sessions: ${stats.totalSessions}`);
console.log(`   Sessions with projects: ${stats.sessionsWithProjects}`);
console.log(`   Unique projects: ${stats.uniqueProjects}`);
console.log(`   Unique tags: ${stats.uniqueTags}\n`);
ctx.close();

