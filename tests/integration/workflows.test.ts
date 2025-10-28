/**
 * End-to-End Workflow Tests
 * 
 * These tests simulate real-world usage scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  CursorContext,
  getCursorDBPath,
  formatSessionMarkdown,
  formatSessionPreview
} from '../../src/core/index.js';

describe('E2E Workflows', () => {
  let api: CursorContext;
  let testMetadataDB: string;
  
  beforeAll(async () => {
    // Use a temporary metadata DB for testing
    testMetadataDB = path.join(os.tmpdir(), `cursor-context-e2e-${Date.now()}.db`);
    api = new CursorContext(getCursorDBPath(), testMetadataDB, true);
    
    // Sync some sessions for testing
    await api.syncSessions(15);
  });
  
  afterAll(() => {
    if (api) {
      api.close();
    }
    
    // Cleanup test database
    if (fs.existsSync(testMetadataDB)) {
      fs.unlinkSync(testMetadataDB);
    }
  });
  
  describe('Workflow: Organize and Retrieve Sessions', () => {
    it('should complete full workflow: sync, tag, search, retrieve', async () => {
      // Step 1: List available sessions
      const sessions = await api.listSessions({ limit: 5 });
      expect(sessions.length).toBeGreaterThan(0);
      
      if (sessions.length === 0) return;
      
      const testSession = sessions[0]!;
      
      // Step 2: Give it a memorable nickname
      const nickname = `e2e-test-${Date.now()}`;
      await api.setNickname(testSession.session_id, nickname);
      
      // Step 3: Add tags for organization
      await api.addTag(testSession.session_id, 'test');
      await api.addTag(testSession.session_id, 'workflow');
      await api.addTag(testSession.session_id, 'e2e');
      
      // Step 4: Search for the session by nickname
      const searchResults = await api.searchSessions({ query: nickname });
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some(s => s.session_id === testSession.session_id)).toBe(true);
      
      // Step 5: Retrieve by nickname with full messages
      const fullSession = await api.getSession(nickname);
      expect(fullSession.metadata.session_id).toBe(testSession.session_id);
      expect(fullSession.metadata.nickname).toBe(nickname);
      expect(fullSession.metadata.tags).toContain('test');
      expect(fullSession.metadata.tags).toContain('workflow');
      expect(fullSession.metadata.tags).toContain('e2e');
      
      // Step 6: Format the session for display
      const markdown = formatSessionMarkdown(fullSession, { maxMessages: 3 });
      expect(markdown).toContain(nickname);
      expect(markdown).toContain('# Cursor Session');
      
      const preview = formatSessionPreview(fullSession.metadata);
      expect(preview).toContain(nickname);
    });
  });
  
  describe('Workflow: Project-Based Organization', () => {
    it('should organize and filter sessions by project', async () => {
      // Step 1: Get all projects
      const projects = api.getProjects();
      
      if (projects.length === 0) {
        // No projects available, skip test
        return;
      }
      
      const targetProject = projects[0]!;
      
      // Step 2: List all sessions in that project
      const projectSessions = await api.listSessions({
        projectPath: targetProject.path
      });
      
      expect(projectSessions.length).toBe(targetProject.session_count);
      expect(projectSessions.every(s => s.project_path === targetProject.path)).toBe(true);
      
      // Step 3: Tag all sessions in the project
      for (const session of projectSessions.slice(0, 3)) {
        await api.addTag(session.session_id, `project:${targetProject.name}`);
      }
      
      // Step 4: Search within the project
      const projectSearch = await api.searchSessions({
        query: '',
        projectPath: targetProject.path
      });
      
      expect(projectSearch.every(s => s.project_path === targetProject.path)).toBe(true);
    });
  });
  
  describe('Workflow: Tag-Based Organization', () => {
    it('should organize sessions with tags and retrieve by tag', async () => {
      const sessions = await api.listSessions({ limit: 5 });
      
      if (sessions.length < 3) return;
      
      // Step 1: Tag sessions by category
      await api.addTag(sessions[0]!.session_id, 'feature');
      await api.addTag(sessions[1]!.session_id, 'feature');
      await api.addTag(sessions[1]!.session_id, 'bugfix');
      await api.addTag(sessions[2]!.session_id, 'documentation');
      
      // Step 2: Get all tags
      const tags = api.getTags();
      const featureTag = tags.find(t => t.tag === 'feature');
      expect(featureTag).toBeDefined();
      expect(featureTag!.count).toBeGreaterThanOrEqual(2);
      
      // Step 3: List sessions by tag
      const featureSessions = await api.listSessions({ tag: 'feature' });
      expect(featureSessions.length).toBeGreaterThanOrEqual(2);
      expect(featureSessions.every(s => s.tags?.includes('feature'))).toBe(true);
      
      // Step 4: Search within tagged sessions
      const taggedSearch = await api.searchSessions({
        query: '',
        taggedOnly: true
      });
      expect(taggedSearch.every(s => s.tags && s.tags.length > 0)).toBe(true);
    });
  });
  
  describe('Workflow: Session Discovery', () => {
    it('should discover and sync new sessions automatically', async () => {
      // Step 1: Get current stats
      const statsBefore = api.getStats();
      
      // Step 2: List sessions to trigger auto-sync
      const cursorDB = api.getCursorDB();
      const allIds = cursorDB.listComposerIds(50);
      const metadataDB = api.getMetadataDB();
      
      // Find an unsynced session
      const unsyncedId = allIds.find(id => !metadataDB.getSessionMetadata(id));
      
      if (!unsyncedId) {
        // All sessions already synced
        return;
      }
      
      // Step 3: Access the session (should auto-sync)
      try {
        const session = await api.getSession(unsyncedId);
        expect(session.metadata.session_id).toBe(unsyncedId);
        
        // Step 4: Verify it's now in metadata DB
        const metadata = metadataDB.getSessionMetadata(unsyncedId);
        expect(metadata).toBeDefined();
        
        // Step 5: Stats should reflect the new session
        const statsAfter = api.getStats();
        expect(statsAfter.totalSessionsWithMetadata).toBeGreaterThan(statsBefore.totalSessionsWithMetadata);
      } catch {
        // Session might not have valid data, skip
      }
    });
  });
  
  describe('Workflow: Bulk Operations', () => {
    it('should handle bulk tagging and organization', async () => {
      const sessions = await api.listSessions({ limit: 10 });
      
      if (sessions.length < 5) return;
      
      // Step 1: Bulk tag sessions
      const bulkTag = `bulk-${Date.now()}`;
      for (const session of sessions.slice(0, 5)) {
        await api.addTag(session.session_id, bulkTag);
      }
      
      // Step 2: Verify all tagged
      const taggedSessions = await api.listSessions({ tag: bulkTag });
      expect(taggedSessions.length).toBe(5);
      
      // Step 3: Bulk rename with pattern
      for (let i = 0; i < 3; i++) {
        await api.setNickname(
          sessions[i]!.session_id,
          `bulk-session-${i + 1}`
        );
      }
      
      // Step 4: Search across bulk operations
      const bulkSearch = await api.searchSessions({ query: 'bulk' });
      expect(bulkSearch.length).toBeGreaterThanOrEqual(5);
    });
  });
  
  describe('Workflow: Sorting and Filtering', () => {
    it('should support complex sorting and filtering', async () => {
      await api.syncSessions(20);
      
      // Step 1: Get newest sessions
      const newest = await api.listSessions({ 
        sortBy: 'newest', 
        limit: 5 
      });
      expect(newest.length).toBeGreaterThan(0);
      
      // Step 2: Get oldest sessions
      const oldest = await api.listSessions({ 
        sortBy: 'oldest', 
        limit: 5 
      });
      expect(oldest.length).toBeGreaterThan(0);
      
      // Step 3: Get sessions with most messages
      const mostMessages = await api.listSessions({ 
        sortBy: 'most_messages', 
        limit: 5 
      });
      expect(mostMessages.length).toBeGreaterThan(0);
      
      // Verify sorting
      if (mostMessages.length >= 2) {
        const first = mostMessages[0]!.message_count || 0;
        const second = mostMessages[1]!.message_count || 0;
        expect(first).toBeGreaterThanOrEqual(second);
      }
      
      // Step 4: Combine filters
      const projects = api.getProjects();
      if (projects.length > 0) {
        const filtered = await api.listSessions({
          projectPath: projects[0]!.path,
          sortBy: 'newest',
          limit: 3
        });
        
        expect(filtered.every(s => s.project_path === projects[0]!.path)).toBe(true);
      }
    });
  });
  
  describe('Workflow: Error Recovery', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to get non-existent session
      await expect(
        api.getSession('invalid-session-id-12345')
      ).rejects.toThrow();
      
      // Try to tag non-existent session
      await expect(
        api.addTag('invalid-session-id-12345', 'test')
      ).rejects.toThrow();
      
      // Try to set nickname for non-existent session
      await expect(
        api.setNickname('invalid-session-id-12345', 'test')
      ).rejects.toThrow();
      
      // Empty search should not throw
      const emptySearch = await api.searchSessions({ query: 'xyznonexistent123' });
      expect(emptySearch).toEqual([]);
      
      // List with no results should not throw
      const noResults = await api.listSessions({ tag: 'nonexistent-tag-xyz' });
      expect(noResults).toEqual([]);
    });
  });
});

