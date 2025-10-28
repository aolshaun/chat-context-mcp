/**
 * Tests for message parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseBubble,
  parseBubbles,
  parseLexicalText,
  filterMessagesByRole,
  getConversationOnly,
  estimateTokens
} from '../../src/core/message-parser.js';
import type { BubbleData } from '../../src/core/types.js';

describe('Message Parser', () => {
  describe('parseLexicalText', () => {
    it('should parse simple text', () => {
      const lexical = JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Hello world'
                }
              ]
            }
          ]
        }
      });
      
      const result = parseLexicalText(lexical);
      expect(result.trim()).toBe('Hello world');
    });
    
    it('should handle code blocks', () => {
      const lexical = JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'code',
              language: 'javascript',
              children: [
                {
                  type: 'text',
                  text: 'console.log("test");'
                }
              ]
            }
          ]
        }
      });
      
      const result = parseLexicalText(lexical);
      expect(result).toContain('```javascript');
      expect(result).toContain('console.log("test");');
      expect(result).toContain('```');
    });
    
    it('should handle inline code', () => {
      const lexical = JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Use '
                },
                {
                  type: 'code-highlight',
                  text: 'const foo = 1'
                },
                {
                  type: 'text',
                  text: ' to declare'
                }
              ]
            }
          ]
        }
      });
      
      const result = parseLexicalText(lexical);
      expect(result).toContain('`const foo = 1`');
    });
    
    it('should handle nested structures', () => {
      const lexical = JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Paragraph 1'
                }
              ]
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Paragraph 2'
                }
              ]
            }
          ]
        }
      });
      
      const result = parseLexicalText(lexical);
      expect(result).toContain('Paragraph 1');
      expect(result).toContain('Paragraph 2');
    });
    
    it('should handle empty richText', () => {
      const lexical = JSON.stringify({
        root: {
          type: 'root',
          children: []
        }
      });
      
      const result = parseLexicalText(lexical);
      expect(result).toBe('');
    });
    
    it('should handle invalid JSON gracefully', () => {
      const result = parseLexicalText('not valid json {');
      expect(result).toBe('');
    });
    
    it('should handle missing root', () => {
      const result = parseLexicalText(JSON.stringify({ noRoot: true }));
      expect(result).toBe('');
    });
  });
  
  describe('parseBubble', () => {
    it('should parse user message with richText', () => {
      const bubble: BubbleData = {
        type: 1,
        bubbleId: 'test-bubble',
        richText: JSON.stringify({
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'User message'
                  }
                ]
              }
            ]
          }
        })
      };
      
      const message = parseBubble(bubble);
      expect(message.role).toBe('user');
      expect(message.content.trim()).toBe('User message');
      expect(message.bubbleId).toBe('test-bubble');
    });
    
    it('should parse assistant message with plain text', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        text: 'Assistant response'
      };
      
      const message = parseBubble(bubble);
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Assistant response');
    });
    
    it('should handle user message with plain text fallback', () => {
      const bubble: BubbleData = {
        type: 1,
        bubbleId: 'test-bubble',
        text: 'Plain text user message'
      };
      
      const message = parseBubble(bubble);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Plain text user message');
    });
    
    it('should handle empty content', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble'
      };
      
      const message = parseBubble(bubble);
      expect(message.content).toBe('');
    });
    
    it('should parse tool data', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        text: '',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          params: JSON.stringify({ pattern: 'test' }),
          result: JSON.stringify({
            success: {
              workspaceResults: {
                '/Users/test/project': {}
              }
            }
          })
        }
      };
      
      const message = parseBubble(bubble);
      expect(message.toolData).toBeDefined();
      expect(message.toolData?.name).toBe('grep');
      expect(message.toolData?.params).toEqual({ pattern: 'test' });
      expect(message.toolData?.workspacePath).toBe('/Users/test/project');
    });
    
    it('should exclude tool data when option is set', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        text: 'Response',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          result: '{}'
        }
      };
      
      const message = parseBubble(bubble, { excludeTools: true });
      expect(message.toolData).toBeUndefined();
    });
    
    it('should include timestamp if present', () => {
      const bubble: BubbleData = {
        type: 1,
        bubbleId: 'test-bubble',
        text: 'Test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const message = parseBubble(bubble);
      expect(message.timestamp).toBe('2025-01-01T00:00:00Z');
    });
  });
  
  describe('parseBubbles', () => {
    it('should parse multiple bubbles', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'User message'
        },
        {
          type: 2,
          bubbleId: 'b2',
          text: 'Assistant response'
        }
      ];
      
      const messages = parseBubbles(bubbles);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
    });
    
    it('should handle empty array', () => {
      const messages = parseBubbles([]);
      expect(messages).toEqual([]);
    });
    
    it('should apply maxContentLength option', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'This is a very long message that should be truncated'
        }
      ];
      
      const messages = parseBubbles(bubbles, { maxContentLength: 20 });
      expect(messages[0]?.content.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(messages[0]?.content).toContain('...');
    });
    
    it('should apply excludeTools option to all bubbles', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          text: 'Response 1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: '{}'
          }
        },
        {
          type: 2,
          bubbleId: 'b2',
          text: 'Response 2',
          toolFormerData: {
            tool: 5,
            name: 'read_file',
            result: '{}'
          }
        }
      ];
      
      const messages = parseBubbles(bubbles, { excludeTools: true });
      expect(messages.every(m => m.toolData === undefined)).toBe(true);
    });
  });
  
  describe('filterMessagesByRole', () => {
    const messages = [
      { role: 'user' as const, content: '1', bubbleId: 'b1' },
      { role: 'assistant' as const, content: '2', bubbleId: 'b2' },
      { role: 'user' as const, content: '3', bubbleId: 'b3' },
      { role: 'assistant' as const, content: '4', bubbleId: 'b4' }
    ];
    
    it('should filter by single role', () => {
      const userMessages = filterMessagesByRole(messages, ['user']);
      expect(userMessages).toHaveLength(2);
      expect(userMessages.every(m => m.role === 'user')).toBe(true);
    });
    
    it('should filter by multiple roles', () => {
      const filtered = filterMessagesByRole(messages, ['user', 'assistant']);
      expect(filtered).toHaveLength(4);
    });
    
    it('should handle empty filter', () => {
      const filtered = filterMessagesByRole(messages, []);
      expect(filtered).toHaveLength(0);
    });
  });
  
  describe('getConversationOnly', () => {
    it('should exclude tool messages', () => {
      const messages = [
        { role: 'user' as const, content: '1', bubbleId: 'b1' },
        { role: 'assistant' as const, content: '2', bubbleId: 'b2', toolData: { name: 'grep' } },
        { role: 'user' as const, content: '3', bubbleId: 'b3' },
        { role: 'assistant' as const, content: '4', bubbleId: 'b4' }
      ];
      
      const conversation = getConversationOnly(messages);
      expect(conversation).toHaveLength(4); // All are user or assistant
    });
    
    it('should work with tool role', () => {
      const messages = [
        { role: 'user' as const, content: '1', bubbleId: 'b1' },
        { role: 'tool' as const, content: '2', bubbleId: 'b2' },
        { role: 'assistant' as const, content: '3', bubbleId: 'b3' }
      ];
      
      const conversation = getConversationOnly(messages);
      expect(conversation).toHaveLength(2);
      expect(conversation.every(m => m.role !== 'tool')).toBe(true);
    });
  });
  
  describe('estimateTokens', () => {
    it('should estimate tokens from content', () => {
      expect(estimateTokens('test')).toBe(1); // 4 chars / 4 = 1
      expect(estimateTokens('this is a test')).toBe(4); // 14 chars / 4 = 3.5 -> 4
      expect(estimateTokens('')).toBe(0);
    });
    
    it('should round up', () => {
      expect(estimateTokens('abc')).toBe(1); // 3 / 4 = 0.75 -> 1
      expect(estimateTokens('abcde')).toBe(2); // 5 / 4 = 1.25 -> 2
    });
  });
});

