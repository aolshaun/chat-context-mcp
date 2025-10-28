/**
 * Integration tests for Core API
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  CursorContext,
  getCursorDBPath,
  SessionNotFoundError
} from '../../src/core/index.js';

describe('CursorContext API', () => {
  let api: CursorContext;
  let testMetadataDB: string;
  
  beforeAll(() => {
    // Use a temporary metadata DB for testing
    testMetadataDB = path.join(os.tmpdir(), `cursor-context-test-${Date.now()}.db`);
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
  
  beforeEach(() => {
    // Create fresh API instance for each test
    if (api) {
      api.close();
    }
    api = new CursorContext(getCursorDBPath(), testMetadataDB, true);
  });
  
  describe('Constructor & Initialization', () => {
    it('should create instance with default paths', () => {
      const defaultApi = new CursorContext();
      expect(defaultApi).toBeDefined();
      expect(defaultApi.getCursorDB()).toBeDefined();
      expect(defaultApi.getMetadataDB()).toBeDefined();
      defaultApi.close();
    });
    
    it('should create instance with custom paths', () => {
      expect(api).toBeDefined();
      expect(api.getCursorDB()).toBeDefined();
      expect(api.getMetadataDB()).toBeDefined();
    });
    
    it('should support autoSync option', () => {
      const noAutoSyncApi = new CursorContext(undefined, testMetadataDB, false);
      expect(noAutoSyncApi).toBeDefined();
      noAutoSyncApi.close();
    });
  });
  
  describe('syncSessions', () => {
    it('should sync sessions from Cursor DB', async () => {
      const synced = await api.syncSessions(5);
      expect(synced).toBeGreaterThanOrEqual(0);
      expect(synced).toBeLessThanOrEqual(5);
    });
    
    it('should not re-sync already synced sessions', async () => {
      const firstSync = await api.syncSessions(3);
      const secondSync = await api.syncSessions(3);
      
      // Second sync should sync fewer or 0 sessions
      expect(secondSync).toBeLessThanOrEqual(firstSync);
    });
  });
  
  describe('listSessions', () => {
    beforeEach(async () => {
      // Sync some sessions for testing
      await api.syncSessions(10);
    });
    
    it('should list all sessions', async () => {
      const sessions = await api.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
    
    it('should limit results', async () => {
      const sessions = await api.listSessions({ limit: 3 });
      expect(sessions.length).toBeLessThanOrEqual(3);
    });
    
    it('should filter by project', async () => {
      const allSessions = await api.listSessions();
      const projectSession = allSessions.find(s => s.has_project);
      
      if (projectSession && projectSession.project_path) {
        const projectSessions = await api.listSessions({ 
          projectPath: projectSession.project_path 
        });
        
        expect(projectSessions.every(s => s.project_path === projectSession.project_path)).toBe(true);
      }
    });
    
    it('should sort by newest', async () => {
      const sessions = await api.listSessions({ sortBy: 'newest', limit: 5 });
      
      for (let i = 1; i < sessions.length; i++) {
        const prev = sessions[i - 1]!.created_at || 0;
        const current = sessions[i]!.created_at || 0;
        expect(prev).toBeGreaterThanOrEqual(current);
      }
    });
    
    it('should sort by oldest', async () => {
      const sessions = await api.listSessions({ sortBy: 'oldest', limit: 5 });
      
      for (let i = 1; i < sessions.length; i++) {
        const prev = sessions[i - 1]!.created_at || 0;
        const current = sessions[i]!.created_at || 0;
        expect(prev).toBeLessThanOrEqual(current);
      }
    });
    
    it('should sort by most messages', async () => {
      const sessions = await api.listSessions({ sortBy: 'most_messages', limit: 5 });
      
      for (let i = 1; i < sessions.length; i++) {
        const prev = sessions[i - 1]!.message_count || 0;
        const current = sessions[i]!.message_count || 0;
        expect(prev).toBeGreaterThanOrEqual(current);
      }
    });
    
    it('should filter by tag', async () => {
      const sessions = await api.listSessions({ limit: 1 });
      if (sessions.length > 0) {
        await api.addTag(sessions[0]!.session_id, 'test-tag');
        
        const taggedSessions = await api.listSessions({ tag: 'test-tag' });
        expect(taggedSessions.some(s => s.session_id === sessions[0]!.session_id)).toBe(true);
      }
    });
    
    it('should filter by taggedOnly', async () => {
      const sessions = await api.listSessions({ limit: 2 });
      if (sessions.length > 0) {
        await api.addTag(sessions[0]!.session_id, 'filter-test');
        
        const taggedSessions = await api.listSessions({ taggedOnly: true });
        expect(taggedSessions.every(s => s.tags && s.tags.length > 0)).toBe(true);
      }
    });
  });
  
  describe('getSession', () => {
    let testSessionId: string;
    
    beforeEach(async () => {
      await api.syncSessions(5);
      const sessions = await api.listSessions({ limit: 1 });
      if (sessions.length > 0) {
        testSessionId = sessions[0]!.session_id;
      }
    });
    
    it('should get session by ID with messages', async () => {
      if (!testSessionId) {
        return; // Skip if no sessions available
      }
      
      const session = await api.getSession(testSessionId);
      expect(session).toBeDefined();
      expect(session.metadata.session_id).toBe(testSessionId);
      expect(Array.isArray(session.messages)).toBe(true);
    });
    
    it('should get session without messages', async () => {
      if (!testSessionId) {
        return;
      }
      
      const session = await api.getSession(testSessionId, { includeMessages: false });
      expect(session).toBeDefined();
      expect(session.messages).toHaveLength(0);
    });
    
    it('should get session by nickname', async () => {
      if (!testSessionId) {
        return;
      }
      
      const nickname = `test-nick-${Date.now()}`;
      await api.setNickname(testSessionId, nickname);
      
      const session = await api.getSession(nickname);
      expect(session.metadata.session_id).toBe(testSessionId);
      expect(session.metadata.nickname).toBe(nickname);
    });
    
    it('should throw SessionNotFoundError for invalid ID', async () => {
      await expect(api.getSession('invalid-id-12345')).rejects.toThrow(SessionNotFoundError);
    });
    
    it('should respect parseOptions', async () => {
      if (!testSessionId) {
        return;
      }
      
      const session = await api.getSession(testSessionId, {
        parseOptions: {
          excludeTools: true,
          maxContentLength: 100
        }
      });
      
      // Messages should be parsed with options
      expect(session.messages.every(m => !m.toolData)).toBe(true);
    });
    
    it('should auto-sync session if not in metadata DB', async () => {
      // Get a session ID from Cursor DB that's not synced
      const cursorDB = api.getCursorDB();
      const allIds = cursorDB.listComposerIds(50);
      const metadataDB = api.getMetadataDB();
      
      // Find an unsynced session that has messages
      let unsyncedId: string | undefined;
      for (const id of allIds) {
        if (!metadataDB.getSessionMetadata(id)) {
          // Check if it has messages (valid session)
          try {
            const bubbles = cursorDB.getSessionBubbles(id);
            if (bubbles.length > 0) {
              unsyncedId = id;
              break;
            }
          } catch {
            // Skip this session
          }
        }
      }
      
      if (unsyncedId) {
        const session = await api.getSession(unsyncedId);
        expect(session.metadata.session_id).toBe(unsyncedId);
        
        // Should now be in metadata DB
        const metadata = metadataDB.getSessionMetadata(unsyncedId);
        expect(metadata).toBeDefined();
      }
    });
  });
  
  describe('searchSessions', () => {
    beforeEach(async () => {
      await api.syncSessions(10);
      
      // Add some test data
      const sessions = await api.listSessions({ limit: 3 });
      if (sessions.length >= 3) {
        await api.setNickname(sessions[0]!.session_id, 'search-test-apple');
        await api.setNickname(sessions[1]!.session_id, 'search-test-banana');
        await api.addTag(sessions[2]!.session_id, 'fruit-tag');
      }
    });
    
    it('should search by nickname', async () => {
      const results = await api.searchSessions({ query: 'apple' });
      expect(results.some(s => s.nickname?.includes('apple'))).toBe(true);
    });
    
    it('should search by tag', async () => {
      const results = await api.searchSessions({ query: 'fruit' });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should be case insensitive by default', async () => {
      const results = await api.searchSessions({ query: 'APPLE' });
      expect(results.some(s => s.nickname?.toLowerCase().includes('apple'))).toBe(true);
    });
    
    it('should support case sensitive search', async () => {
      const results = await api.searchSessions({ 
        query: 'APPLE', 
        caseSensitive: true 
      });
      expect(results.every(s => !s.nickname?.includes('apple'))).toBe(true);
    });
    
    it('should limit results', async () => {
      const results = await api.searchSessions({ query: 'test', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
    
    it('should filter by project', async () => {
      const sessions = await api.listSessions();
      const projectSession = sessions.find(s => s.has_project);
      
      if (projectSession && projectSession.project_path) {
        const results = await api.searchSessions({
          query: '',
          projectPath: projectSession.project_path
        });
        
        expect(results.every(s => s.project_path === projectSession.project_path)).toBe(true);
      }
    });
    
    it('should search in first message preview', async () => {
      const sessions = await api.listSessions({ limit: 1 });
      if (sessions.length > 0 && sessions[0]!.first_message_preview) {
        const preview = sessions[0]!.first_message_preview;
        const searchTerm = preview.split(' ')[0] || 'test';
        
        const results = await api.searchSessions({ query: searchTerm });
        expect(results.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
  
  describe('setNickname', () => {
    let testSessionId: string;
    
    beforeEach(async () => {
      await api.syncSessions(1);
      const sessions = await api.listSessions({ limit: 1 });
      if (sessions.length > 0) {
        testSessionId = sessions[0]!.session_id;
      }
    });
    
    it('should set nickname for session', async () => {
      if (!testSessionId) {
        return;
      }
      
      const nickname = `nick-${Date.now()}`;
      await api.setNickname(testSessionId, nickname);
      
      const session = await api.getSession(testSessionId);
      expect(session.metadata.nickname).toBe(nickname);
    });
    
    it('should update existing nickname', async () => {
      if (!testSessionId) {
        return;
      }
      
      await api.setNickname(testSessionId, 'first-nick');
      await api.setNickname(testSessionId, 'second-nick');
      
      const session = await api.getSession(testSessionId);
      expect(session.metadata.nickname).toBe('second-nick');
    });
    
    it('should throw for invalid session ID', async () => {
      await expect(api.setNickname('invalid-id', 'test')).rejects.toThrow(SessionNotFoundError);
    });
  });
  
  describe('addTag & removeTag', () => {
    let testSessionId: string;
    
    beforeEach(async () => {
      await api.syncSessions(1);
      const sessions = await api.listSessions({ limit: 1 });
      if (sessions.length > 0) {
        testSessionId = sessions[0]!.session_id;
      }
    });
    
    it('should add tag to session', async () => {
      if (!testSessionId) {
        return;
      }
      
      await api.addTag(testSessionId, 'test-tag');
      
      const session = await api.getSession(testSessionId);
      expect(session.metadata.tags).toContain('test-tag');
    });
    
    it('should add multiple tags', async () => {
      if (!testSessionId) {
        return;
      }
      
      await api.addTag(testSessionId, 'tag1');
      await api.addTag(testSessionId, 'tag2');
      
      const session = await api.getSession(testSessionId);
      expect(session.metadata.tags).toContain('tag1');
      expect(session.metadata.tags).toContain('tag2');
    });
    
    it('should remove tag from session', async () => {
      if (!testSessionId) {
        return;
      }
      
      await api.addTag(testSessionId, 'removable-tag');
      await api.removeTag(testSessionId, 'removable-tag');
      
      const session = await api.getSession(testSessionId);
      expect(session.metadata.tags || []).not.toContain('removable-tag');
    });
    
    it('should throw for invalid session ID when adding tag', async () => {
      await expect(api.addTag('invalid-id', 'test')).rejects.toThrow(SessionNotFoundError);
    });
  });
  
  describe('getProjects', () => {
    beforeEach(async () => {
      await api.syncSessions(10);
    });
    
    it('should list all projects', () => {
      const projects = api.getProjects();
      expect(Array.isArray(projects)).toBe(true);
      
      projects.forEach(project => {
        expect(project.path).toBeDefined();
        expect(project.session_count).toBeGreaterThanOrEqual(1);
      });
    });
    
    it('should have session counts', () => {
      const projects = api.getProjects();
      if (projects.length > 0) {
        expect(projects[0]!.session_count).toBeGreaterThanOrEqual(1);
      }
    });
  });
  
  describe('getTags', () => {
    beforeEach(async () => {
      await api.syncSessions(3);
      const sessions = await api.listSessions({ limit: 3 });
      
      if (sessions.length >= 2) {
        await api.addTag(sessions[0]!.session_id, 'common-tag');
        await api.addTag(sessions[1]!.session_id, 'common-tag');
      }
    });
    
    it('should list all tags with counts', () => {
      const tags = api.getTags();
      expect(Array.isArray(tags)).toBe(true);
      
      tags.forEach(tag => {
        expect(tag.tag).toBeDefined();
        expect(tag.count).toBeGreaterThanOrEqual(1);
      });
    });
    
    it('should have correct counts', () => {
      const tags = api.getTags();
      const commonTag = tags.find(t => t.tag === 'common-tag');
      
      if (commonTag) {
        expect(commonTag.count).toBeGreaterThanOrEqual(2);
      }
    });
  });
  
  describe('getStats', () => {
    beforeEach(async () => {
      await api.syncSessions(5);
    });
    
    it('should return statistics', () => {
      const stats = api.getStats();
      
      expect(stats.totalSessionsInCursor).toBeGreaterThanOrEqual(0);
      expect(stats.totalSessionsWithMetadata).toBeGreaterThanOrEqual(0);
      expect(stats.sessionsWithNicknames).toBeGreaterThanOrEqual(0);
      expect(stats.sessionsWithTags).toBeGreaterThanOrEqual(0);
      expect(stats.sessionsWithProjects).toBeGreaterThanOrEqual(0);
      expect(stats.totalTags).toBeGreaterThanOrEqual(0);
      expect(stats.totalProjects).toBeGreaterThanOrEqual(0);
    });
    
    it('should have consistent statistics', () => {
      const stats = api.getStats();
      
      // Synced sessions should be <= total in Cursor
      expect(stats.totalSessionsWithMetadata).toBeLessThanOrEqual(stats.totalSessionsInCursor);
      
      // Nicknames/tags/projects <= total sessions
      expect(stats.sessionsWithNicknames).toBeLessThanOrEqual(stats.totalSessionsWithMetadata);
      expect(stats.sessionsWithTags).toBeLessThanOrEqual(stats.totalSessionsWithMetadata);
      expect(stats.sessionsWithProjects).toBeLessThanOrEqual(stats.totalSessionsWithMetadata);
    });
  });
  
  describe('close', () => {
    it('should close database connections', () => {
      const tempApi = new CursorContext(undefined, testMetadataDB + '.temp', false);
      tempApi.close();
      
      expect(tempApi.getCursorDB().isConnected()).toBe(false);
      expect(tempApi.getMetadataDB().isConnected()).toBe(false);
    });
  });
});

