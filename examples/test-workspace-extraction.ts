/**
 * Test workspace extraction from Cursor sessions
 */

import { CursorDB, getCursorDBPath, getWorkspaceInfo } from '../src/core/index.js';

console.log('='.repeat(80));
console.log('Cursor Context - Workspace Extraction Test');
console.log('='.repeat(80));

const dbPath = getCursorDBPath();
const db = new CursorDB(dbPath);

console.log('\nAnalyzing sessions for workspace information...\n');

const sessionIds = db.listComposerIds(20);
let sessionsWithProjects = 0;
let sessionsWithoutProjects = 0;
let multiWorkspaceSessions = 0;

const projectCounts: Record<string, number> = {};

for (const sessionId of sessionIds) {
  try {
    const bubbles = db.getSessionBubbles(sessionId);
    
    if (bubbles.length === 0) {
      continue; // Skip empty sessions
    }
    
    const workspaceInfo = getWorkspaceInfo(bubbles);
    
    if (workspaceInfo.hasProject) {
      sessionsWithProjects++;
      
      if (workspaceInfo.projectName) {
        projectCounts[workspaceInfo.projectName] = (projectCounts[workspaceInfo.projectName] || 0) + 1;
      }
      
      if (workspaceInfo.isMultiWorkspace) {
        multiWorkspaceSessions++;
        console.log(`[Multi-Workspace] Session ${sessionId.substring(0, 8)}...`);
        console.log(`  Workspaces: ${workspaceInfo.allPaths.join(', ')}`);
      }
    } else {
      sessionsWithoutProjects++;
    }
  } catch (error) {
    // Skip sessions that error
  }
}

console.log('\n' + '='.repeat(80));
console.log('Summary');
console.log('='.repeat(80));
console.log(`Total sessions analyzed: ${sessionIds.length}`);
console.log(`Sessions with projects: ${sessionsWithProjects}`);
console.log(`Sessions without projects (general): ${sessionsWithoutProjects}`);
console.log(`Multi-workspace sessions: ${multiWorkspaceSessions}`);

console.log('\n' + '-'.repeat(80));
console.log('Projects Found:');
console.log('-'.repeat(80));

const sortedProjects = Object.entries(projectCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10); // Top 10

if (sortedProjects.length > 0) {
  sortedProjects.forEach(([project, count]) => {
    console.log(`  ${project}: ${count} session(s)`);
  });
} else {
  console.log('  No projects found (sessions may not have tool results yet)');
}

// Show detailed example of one session with workspace
console.log('\n' + '-'.repeat(80));
console.log('Example Session with Workspace:');
console.log('-'.repeat(80));

for (const sessionId of sessionIds) {
  try {
    const bubbles = db.getSessionBubbles(sessionId);
    const workspaceInfo = getWorkspaceInfo(bubbles);
    
    if (workspaceInfo.hasProject) {
      console.log(`Session ID: ${sessionId}`);
      console.log(`Primary Path: ${workspaceInfo.primaryPath}`);
      console.log(`Project Name: ${workspaceInfo.projectName}`);
      console.log(`All Paths: ${workspaceInfo.allPaths.join(', ')}`);
      console.log(`Is Multi-Workspace: ${workspaceInfo.isMultiWorkspace}`);
      console.log(`Message Count: ${bubbles.length}`);
      break;
    }
  } catch (error) {
    // Skip
  }
}

db.close();

console.log('\n' + '='.repeat(80));
console.log('✓ Workspace extraction test complete!');
console.log('='.repeat(80));

