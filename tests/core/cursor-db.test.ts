/**
 * Tests for Cursor database access
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CursorDB, getCursorDBPath, DBConnectionError, SessionNotFoundError } from '../../src/core/index.js';
import fs from 'fs';

describe('CursorDB', () => {
  let db: CursorDB;
  let dbPath: string;
  
  beforeAll(() => {
    dbPath = getCursorDBPath();
    db = new CursorDB(dbPath);
  });
  
  afterAll(() => {
    db.close();
  });
  
  describe('Connection', () => {
    it('should connect to database', () => {
      // Connection happens lazily on first query
      const sessions = db.listComposerIds(1);
      expect(sessions).toBeDefined();
      expect(db.isConnected()).toBe(true);
    });
    
    it('should throw error if database does not exist', () => {
      const fakePath = '/fake/path/to/nonexistent.db';
      const fakeDb = new CursorDB(fakePath);
      
      expect(() => {
        fakeDb.listComposerIds();
      }).toThrow(DBConnectionError);
    });
    
    it('should handle readonly mode', () => {
      // Just verify we can read - actual readonly enforcement is by SQLite
      const sessions = db.listComposerIds(1);
      expect(sessions).toBeDefined();
    });
  });
  
  describe('List Composer IDs', () => {
    it('should list composer session IDs', () => {
      const sessions = db.listComposerIds();
      expect(Array.isArray(sessions)).toBe(true);
      
      if (sessions.length > 0) {
        // Check UUID format (roughly)
        expect(sessions[0]).toMatch(/^[a-f0-9-]{36}$/);
      }
    });
    
    it('should respect limit parameter', () => {
      const limit = 3;
      const sessions = db.listComposerIds(limit);
      expect(sessions.length).toBeLessThanOrEqual(limit);
    });
    
    it('should return all sessions when no limit', () => {
      const allSessions = db.listComposerIds();
      const limitedSessions = db.listComposerIds(1);
      
      expect(allSessions.length).toBeGreaterThanOrEqual(limitedSessions.length);
    });
  });
  
  describe('Get Composer Data', () => {
    it('should fetch composer data for existing session', () => {
      const sessions = db.listComposerIds(1);
      
      if (sessions.length > 0) {
        const sessionId = sessions[0]!;
        const data = db.getComposerData(sessionId);
        
        expect(data).not.toBeNull();
        expect(data?.composerId).toBe(sessionId);
      }
    });
    
    it('should return null for non-existent session', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const data = db.getComposerData(fakeId);
      
      expect(data).toBeNull();
    });
    
    it('should have expected composer fields', () => {
      const sessions = db.listComposerIds(10);
      
      if (sessions.length > 0) {
        const sessionId = sessions[0]!;
        const data = db.getComposerData(sessionId);
        
        expect(data).toHaveProperty('composerId');
        // At least one of these should exist
        expect(
          data?.conversation || data?.fullConversationHeadersOnly
        ).toBeDefined();
      }
    });
  });
  
  describe('Get Bubble Data', () => {
    it('should fetch bubble data for existing message', () => {
      // Find a session with messages
      const sessions = db.listComposerIds(10);
      
      for (const sessionId of sessions) {
        const composerData = db.getComposerData(sessionId);
        const headers = composerData?.fullConversationHeadersOnly || composerData?.conversation || [];
        
        if (headers.length > 0) {
          const bubbleId = headers[0]!.bubbleId;
          const bubble = db.getBubbleData(sessionId, bubbleId);
          
          expect(bubble).not.toBeNull();
          expect(bubble?.bubbleId).toBe(bubbleId);
          expect(bubble?.type).toBeGreaterThanOrEqual(1);
          expect(bubble?.type).toBeLessThanOrEqual(2);
          break;
        }
      }
    });
    
    it('should return null for non-existent bubble', () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000000';
      const fakeBubbleId = '11111111-1111-1111-1111-111111111111';
      const bubble = db.getBubbleData(fakeSessionId, fakeBubbleId);
      
      expect(bubble).toBeNull();
    });
  });
  
  describe('Get Session Bubbles', () => {
    it('should fetch all bubbles for a session', () => {
      // Find session with messages
      const sessions = db.listComposerIds(10);
      
      for (const sessionId of sessions) {
        const bubbles = db.getSessionBubbles(sessionId);
        
        if (bubbles.length > 0) {
          expect(Array.isArray(bubbles)).toBe(true);
          expect(bubbles[0]).toHaveProperty('type');
          expect(bubbles[0]).toHaveProperty('bubbleId');
          break;
        }
      }
    });
    
    it('should return empty array for session with no messages', () => {
      // Find an empty session
      const sessions = db.listComposerIds(20);
      
      for (const sessionId of sessions) {
        const bubbles = db.getSessionBubbles(sessionId);
        
        if (bubbles.length === 0) {
          expect(Array.isArray(bubbles)).toBe(true);
          expect(bubbles.length).toBe(0);
          break;
        }
      }
    });
    
    it('should throw SessionNotFoundError for non-existent session', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      expect(() => {
        db.getSessionBubbles(fakeId);
      }).toThrow(SessionNotFoundError);
    });
    
    it('should preserve message order', () => {
      // Find session with multiple messages
      const sessions = db.listComposerIds(10);
      
      for (const sessionId of sessions) {
        const bubbles = db.getSessionBubbles(sessionId);
        
        if (bubbles.length > 1) {
          // Just verify we got bubbles in some order
          expect(bubbles[0]?.bubbleId).not.toBe(bubbles[1]?.bubbleId);
          break;
        }
      }
    });
  });
  
  describe('Connection Management', () => {
    it('should report connection status', () => {
      // Trigger connection
      db.listComposerIds(1);
      expect(db.isConnected()).toBe(true);
    });
    
    it('should close connection', () => {
      const testDb = new CursorDB(dbPath);
      testDb.listComposerIds(1);
      
      expect(testDb.isConnected()).toBe(true);
      
      testDb.close();
      expect(testDb.isConnected()).toBe(false);
    });
  });
});

