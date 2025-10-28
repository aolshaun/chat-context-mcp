/**
 * Tests for metadata database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetadataDB } from '../../src/core/metadata-db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('MetadataDB', () => {
  let db: MetadataDB;
  let dbPath: string;
  
  beforeEach(() => {
    // Create temp database for each test
    const tmpDir = os.tmpdir();
    dbPath = path.join(tmpDir, `.test-metadata-${Date.now()}.db`);
    db = new MetadataDB(dbPath);
  });
  
  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });
  
  describe('Initialization', () => {
    it('should create database file on first use', () => {
      // Database is created lazily on first operation
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      expect(fs.existsSync(dbPath)).toBe(true);
    });
    
    it('should create schema on first use', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      const stats = db.getStats();
      expect(stats.total_sessions).toBe(1);
    });
    
    it('should report connection status', () => {
      expect(db.isConnected()).toBe(false);
      
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      expect(db.isConnected()).toBe(true);
    });
  });
  
  describe('CRUD Operations', () => {
    it('should upsert session metadata', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        project_path: '/path/to/project',
        project_name: 'test-project',
        has_project: true,
        message_count: 10
      });
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata).not.toBeNull();
      expect(metadata?.session_id).toBe('test-session');
      expect(metadata?.project_path).toBe('/path/to/project');
      expect(metadata?.has_project).toBe(true);
      expect(metadata?.message_count).toBe(10);
    });
    
    it('should update existing metadata on upsert', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        message_count: 10,
        has_project: false
      });
      
      db.upsertSessionMetadata({
        session_id: 'test-session',
        message_count: 20,
        has_project: false
      });
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.message_count).toBe(20);
    });
    
    it('should return null for non-existent session', () => {
      const metadata = db.getSessionMetadata('non-existent');
      expect(metadata).toBeNull();
    });
    
    it('should delete session metadata', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      expect(db.getSessionMetadata('test-session')).not.toBeNull();
      
      db.deleteSessionMetadata('test-session');
      expect(db.getSessionMetadata('test-session')).toBeNull();
    });
  });
  
  describe('Nickname Operations', () => {
    it('should set nickname for existing session', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      db.setNickname('test-session', 'my-nickname');
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.nickname).toBe('my-nickname');
    });
    
    it('should create session if setting nickname for new session', () => {
      db.setNickname('new-session', 'new-nickname');
      
      const metadata = db.getSessionMetadata('new-session');
      expect(metadata).not.toBeNull();
      expect(metadata?.nickname).toBe('new-nickname');
    });
    
    it('should get session by nickname', () => {
      db.setNickname('test-session', 'my-nickname');
      
      const metadata = db.getSessionByNickname('my-nickname');
      expect(metadata?.session_id).toBe('test-session');
    });
    
    it('should return null for non-existent nickname', () => {
      const metadata = db.getSessionByNickname('non-existent');
      expect(metadata).toBeNull();
    });
    
    it('should enforce unique nicknames', () => {
      db.setNickname('session-1', 'unique-name');
      
      expect(() => {
        db.setNickname('session-2', 'unique-name');
      }).toThrow(/already in use/);
    });
    
    it('should allow same nickname for same session', () => {
      db.setNickname('test-session', 'my-nickname');
      
      // Setting same nickname again should not throw
      expect(() => {
        db.setNickname('test-session', 'my-nickname');
      }).not.toThrow();
    });
    
    it('should list all nicknames', () => {
      db.setNickname('session-1', 'nickname-1');
      db.setNickname('session-2', 'nickname-2');
      db.setNickname('session-3', 'nickname-3');
      
      const nicknames = db.listNicknames();
      expect(nicknames).toHaveLength(3);
      expect(nicknames).toContain('nickname-1');
      expect(nicknames).toContain('nickname-2');
      expect(nicknames).toContain('nickname-3');
    });
  });
  
  describe('Tag Operations', () => {
    it('should add tag to existing session', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      db.addTag('test-session', 'important');
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.tags).toContain('important');
    });
    
    it('should create session if adding tag to new session', () => {
      db.addTag('new-session', 'tag-1');
      
      const metadata = db.getSessionMetadata('new-session');
      expect(metadata).not.toBeNull();
      expect(metadata?.tags).toContain('tag-1');
    });
    
    it('should add multiple tags', () => {
      db.addTag('test-session', 'tag-1');
      db.addTag('test-session', 'tag-2');
      db.addTag('test-session', 'tag-3');
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.tags).toHaveLength(3);
      expect(metadata?.tags).toContain('tag-1');
      expect(metadata?.tags).toContain('tag-2');
      expect(metadata?.tags).toContain('tag-3');
    });
    
    it('should not add duplicate tags', () => {
      db.addTag('test-session', 'tag-1');
      db.addTag('test-session', 'tag-1');
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.tags).toHaveLength(1);
    });
    
    it('should remove tag from session', () => {
      db.addTag('test-session', 'tag-1');
      db.addTag('test-session', 'tag-2');
      
      db.removeTag('test-session', 'tag-1');
      
      const metadata = db.getSessionMetadata('test-session');
      expect(metadata?.tags).not.toContain('tag-1');
      expect(metadata?.tags).toContain('tag-2');
    });
    
    it('should handle removing tag from session without tags', () => {
      db.upsertSessionMetadata({
        session_id: 'test-session',
        has_project: false
      });
      
      // Should not throw
      expect(() => {
        db.removeTag('test-session', 'non-existent');
      }).not.toThrow();
    });
    
    it('should find sessions by tag', () => {
      db.addTag('session-1', 'important');
      db.addTag('session-2', 'important');
      db.addTag('session-3', 'other');
      
      const sessions = db.findByTag('important');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.session_id)).toContain('session-1');
      expect(sessions.map(s => s.session_id)).toContain('session-2');
    });
    
    it('should list all tags with counts', () => {
      db.addTag('session-1', 'tag-a');
      db.addTag('session-2', 'tag-a');
      db.addTag('session-3', 'tag-b');
      
      const tags = db.listAllTags();
      expect(tags).toHaveLength(2);
      
      const tagA = tags.find(t => t.tag === 'tag-a');
      const tagB = tags.find(t => t.tag === 'tag-b');
      
      expect(tagA?.count).toBe(2);
      expect(tagB?.count).toBe(1);
    });
  });
  
  describe('Project Operations', () => {
    it('should list sessions by project', () => {
      db.upsertSessionMetadata({
        session_id: 'session-1',
        project_path: '/path/to/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-2',
        project_path: '/path/to/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-3',
        project_path: '/path/to/project-b',
        has_project: true
      });
      
      const sessions = db.listSessionsByProject('/path/to/project-a');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.session_id)).toContain('session-1');
      expect(sessions.map(s => s.session_id)).toContain('session-2');
    });
    
    it('should list all projects', () => {
      db.upsertSessionMetadata({
        session_id: 'session-1',
        project_path: '/path/to/project-a',
        project_name: 'project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-2',
        project_path: '/path/to/project-a',
        project_name: 'project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-3',
        project_path: '/path/to/project-b',
        project_name: 'project-b',
        has_project: true
      });
      
      const projects = db.listProjects();
      expect(projects).toHaveLength(2);
      
      const projectA = projects.find(p => p.name === 'project-a');
      const projectB = projects.find(p => p.name === 'project-b');
      
      expect(projectA?.session_count).toBe(2);
      expect(projectB?.session_count).toBe(1);
    });
  });
  
  describe('List Sessions with Filters', () => {
    beforeEach(() => {
      db.upsertSessionMetadata({
        session_id: 'session-1',
        nickname: 'nick-1',
        project_path: '/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-2',
        project_path: '/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-3',
        nickname: 'nick-3',
        project_path: '/project-b',
        has_project: true
      });
    });
    
    it('should list all sessions', () => {
      const sessions = db.listSessions();
      expect(sessions).toHaveLength(3);
    });
    
    it('should filter by project', () => {
      const sessions = db.listSessions({ project: '/project-a' });
      expect(sessions).toHaveLength(2);
    });
    
    it('should filter by tagged_only', () => {
      const sessions = db.listSessions({ tagged_only: true });
      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.nickname)).toBe(true);
    });
    
    it('should apply limit', () => {
      const sessions = db.listSessions({ limit: 2 });
      expect(sessions).toHaveLength(2);
    });
    
    it('should combine filters', () => {
      const sessions = db.listSessions({
        project: '/project-a',
        tagged_only: true,
        limit: 10
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.session_id).toBe('session-1');
    });
  });
  
  describe('Statistics', () => {
    it('should return correct stats', () => {
      db.upsertSessionMetadata({
        session_id: 'session-1',
        nickname: 'nick-1',
        project_path: '/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-2',
        project_path: '/project-a',
        has_project: true
      });
      db.upsertSessionMetadata({
        session_id: 'session-3',
        has_project: false
      });
      
      const stats = db.getStats();
      expect(stats.total_sessions).toBe(3);
      expect(stats.sessions_with_nicknames).toBe(1);
      expect(stats.sessions_with_projects).toBe(2);
      expect(stats.total_projects).toBe(1);
    });
    
    it('should return zero stats for empty database', () => {
      const stats = db.getStats();
      expect(stats.total_sessions).toBe(0);
      expect(stats.sessions_with_nicknames).toBe(0);
      expect(stats.sessions_with_projects).toBe(0);
      expect(stats.total_projects).toBe(0);
    });
  });
});

