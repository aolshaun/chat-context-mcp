/**
 * Tests for session formatters
 */

import { describe, it, expect } from 'vitest';
import {
  formatSessionMarkdown,
  formatSessionJSON,
  formatSessionPreview,
  formatSessionPreviewPlain,
  formatSessionList,
  formatMessage
} from '../../src/core/formatter.js';
import type { SessionWithMessages, SessionMetadata, ParsedMessage } from '../../src/core/types.js';

describe('Formatter', () => {
  const mockMetadata: SessionMetadata = {
    session_id: 'test-session-123',
    nickname: 'test-session',
    tags: ['tag1', 'tag2'],
    project_path: '/path/to/project',
    project_name: 'test-project',
    has_project: true,
    created_at: Date.now(),
    message_count: 3
  };
  
  const mockMessages: ParsedMessage[] = [
    {
      role: 'user',
      content: 'Hello, how are you?',
      bubbleId: 'bubble-1'
    },
    {
      role: 'assistant',
      content: 'I am doing well, thank you!',
      bubbleId: 'bubble-2'
    },
    {
      role: 'assistant',
      content: 'Let me check that file.',
      bubbleId: 'bubble-3',
      toolData: {
        name: 'read_file',
        params: { path: '/test/file.txt' },
        workspacePath: '/path/to/project'
      }
    }
  ];
  
  const mockSession: SessionWithMessages = {
    metadata: mockMetadata,
    messages: mockMessages
  };
  
  describe('formatSessionMarkdown', () => {
    it('should format session as Markdown with metadata', () => {
      const markdown = formatSessionMarkdown(mockSession);
      
      expect(markdown).toContain('# Cursor Session');
      expect(markdown).toContain('**Nickname:** test-session');
      expect(markdown).toContain('**Project:** test-project');
      expect(markdown).toContain('**Tags:** tag1, tag2');
      expect(markdown).toContain('**Messages:** 3');
      expect(markdown).toContain('## 👤 User');
      expect(markdown).toContain('Hello, how are you?');
      expect(markdown).toContain('## 🤖 Assistant');
    });
    
    it('should format without metadata header', () => {
      const markdown = formatSessionMarkdown(mockSession, { includeMetadata: false });
      
      expect(markdown).not.toContain('# Cursor Session');
      expect(markdown).toContain('## 👤 User');
      expect(markdown).toContain('Hello, how are you?');
    });
    
    it('should limit messages', () => {
      const markdown = formatSessionMarkdown(mockSession, { maxMessages: 2 });
      
      expect(markdown).toContain('Hello, how are you?');
      expect(markdown).toContain('I am doing well');
      expect(markdown).toContain('... and 1 more message');
    });
    
    it('should include tool information', () => {
      const markdown = formatSessionMarkdown(mockSession, { includeTools: true });
      
      expect(markdown).toContain('🔧 Tool: read_file');
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('**Workspace:**');
    });
    
    it('should exclude tool information', () => {
      const markdown = formatSessionMarkdown(mockSession, { includeTools: false });
      
      expect(markdown).not.toContain('Tool: read_file');
      expect(markdown).not.toContain('**Parameters:**');
    });
    
    it('should handle empty messages', () => {
      const emptySession: SessionWithMessages = {
        metadata: mockMetadata,
        messages: []
      };
      
      const markdown = formatSessionMarkdown(emptySession);
      expect(markdown).toContain('# Cursor Session');
    });
  });
  
  describe('formatSessionJSON', () => {
    it('should format session as JSON', () => {
      const json = formatSessionJSON(mockSession);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata.session_id).toBe('test-session-123');
      expect(parsed.messages).toHaveLength(3);
      expect(parsed.messages[0].role).toBe('user');
    });
    
    it('should limit messages in JSON', () => {
      const json = formatSessionJSON(mockSession, { maxMessages: 2 });
      const parsed = JSON.parse(json);
      
      expect(parsed.messages).toHaveLength(2);
    });
    
    it('should exclude tool data when requested', () => {
      const json = formatSessionJSON(mockSession, { includeTools: false });
      const parsed = JSON.parse(json);
      
      expect(parsed.messages[2].toolData).toBeUndefined();
    });
    
    it('should include tool data by default', () => {
      const json = formatSessionJSON(mockSession);
      const parsed = JSON.parse(json);
      
      expect(parsed.messages[2].toolData).toBeDefined();
      expect(parsed.messages[2].toolData.name).toBe('read_file');
    });
  });
  
  describe('formatSessionPreview', () => {
    it('should format session preview with all info', () => {
      const preview = formatSessionPreview(mockMetadata);
      
      expect(preview).toContain('test-session');
      expect(preview).toContain('test-project');
      expect(preview).toContain('tag1, tag2');
      expect(preview).toContain('3');
    });
    
    it('should show session ID if no nickname', () => {
      const metadataNoNickname = { ...mockMetadata, nickname: undefined };
      const preview = formatSessionPreview(metadataNoNickname);
      
      expect(preview).toContain('🆔');
      expect(preview).toContain('test-ses'); // First 8 chars
    });
    
    it('should handle missing optional fields', () => {
      const minimalMetadata: SessionMetadata = {
        session_id: 'test-123',
        has_project: false
      };
      
      const preview = formatSessionPreview(minimalMetadata);
      expect(preview).toBeTruthy();
      expect(preview).toContain('test-123');
    });
    
    it('should format relative dates', () => {
      const today = Date.now();
      const yesterday = today - (24 * 60 * 60 * 1000);
      const weekAgo = today - (7 * 24 * 60 * 60 * 1000);
      
      const todayPreview = formatSessionPreview({ ...mockMetadata, created_at: today });
      expect(todayPreview).toContain('today');
      
      const yesterdayPreview = formatSessionPreview({ ...mockMetadata, created_at: yesterday });
      expect(yesterdayPreview).toContain('yesterday');
      
      const weekAgoPreview = formatSessionPreview({ ...mockMetadata, created_at: weekAgo });
      expect(weekAgoPreview).toContain('7d ago');
    });
  });
  
  describe('formatSessionPreviewPlain', () => {
    it('should format without emojis', () => {
      const preview = formatSessionPreviewPlain(mockMetadata);
      
      expect(preview).toContain('test-session');
      expect(preview).toContain('[test-project]');
      expect(preview).toContain('3 msgs');
      expect(preview).not.toContain('📝');
      expect(preview).not.toContain('📁');
    });
    
    it('should include first message preview if available', () => {
      const metadataWithPreview = {
        ...mockMetadata,
        first_message_preview: 'This is a test message'
      };
      
      const preview = formatSessionPreviewPlain(metadataWithPreview);
      expect(preview).toContain('This is a test message');
    });
    
    it('should truncate long previews', () => {
      const longPreview = 'a'.repeat(100);
      const metadataWithLongPreview = {
        ...mockMetadata,
        first_message_preview: longPreview
      };
      
      const preview = formatSessionPreviewPlain(metadataWithLongPreview);
      expect(preview.length).toBeLessThan(longPreview.length + 50);
      expect(preview).toContain('...');
    });
  });
  
  describe('formatSessionList', () => {
    const sessions: SessionMetadata[] = [
      mockMetadata,
      {
        session_id: 'session-2',
        nickname: 'another-session',
        has_project: false,
        message_count: 5
      }
    ];
    
    it('should format list of sessions with emojis', () => {
      const list = formatSessionList(sessions, true);
      
      expect(list).toContain('1.');
      expect(list).toContain('2.');
      expect(list).toContain('test-session');
      expect(list).toContain('another-session');
      expect(list).toContain('📝');
    });
    
    it('should format list without emojis', () => {
      const list = formatSessionList(sessions, false);
      
      expect(list).toContain('1.');
      expect(list).toContain('test-session');
      expect(list).not.toContain('📝');
    });
    
    it('should handle empty list', () => {
      const list = formatSessionList([]);
      expect(list).toBe('No sessions found.');
    });
  });
  
  describe('formatMessage', () => {
    it('should format user message', () => {
      const message: ParsedMessage = {
        role: 'user',
        content: 'Test message',
        bubbleId: 'b1'
      };
      
      const formatted = formatMessage(message);
      expect(formatted).toContain('[USER]');
      expect(formatted).toContain('Test message');
    });
    
    it('should format assistant message', () => {
      const message: ParsedMessage = {
        role: 'assistant',
        content: 'Response',
        bubbleId: 'b2'
      };
      
      const formatted = formatMessage(message);
      expect(formatted).toContain('[ASSISTANT]');
      expect(formatted).toContain('Response');
    });
    
    it('should include tool info when requested', () => {
      const message: ParsedMessage = {
        role: 'assistant',
        content: 'Checking file',
        bubbleId: 'b3',
        toolData: {
          name: 'read_file'
        }
      };
      
      const formatted = formatMessage(message, true);
      expect(formatted).toContain('Tool: read_file');
    });
    
    it('should exclude tool info when requested', () => {
      const message: ParsedMessage = {
        role: 'assistant',
        content: 'Checking file',
        bubbleId: 'b3',
        toolData: {
          name: 'read_file'
        }
      };
      
      const formatted = formatMessage(message, false);
      expect(formatted).not.toContain('Tool: read_file');
    });
  });
});

