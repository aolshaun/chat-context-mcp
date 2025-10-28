/**
 * Format Adapters
 *
 * Convert between Cursor and Claude Code message formats to a unified format
 */

import type { BubbleData, ParsedMessage } from './types.js';
import type { ClaudeCodeMessage } from './claude-code-db.js';
import { parseBubbles } from './message-parser.js';

/**
 * Convert Cursor bubbles to unified message format
 */
export function cursorToUnified(bubbles: BubbleData[]): ParsedMessage[] {
  // Use existing message parser for Cursor format
  return parseBubbles(bubbles);
}

/**
 * Convert Claude Code messages to unified message format
 */
export function claudeToUnified(messages: ClaudeCodeMessage[]): ParsedMessage[] {
  const unified: ParsedMessage[] = [];

  for (const msg of messages) {
    // Handle user messages
    if (msg.type === 'user') {
      let content = '';

      if (typeof msg.message.content === 'string') {
        content = msg.message.content;
      } else if (Array.isArray(msg.message.content)) {
        // Combine all text content
        const textParts = msg.message.content
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text || '');
        content = textParts.join('\n');
      }

      if (content.trim()) {
        unified.push({
          role: 'user',
          content,
          bubbleId: msg.uuid,
          timestamp: msg.timestamp
        });
      }
    }

    // Handle assistant messages
    if (msg.type === 'assistant') {
      let content = '';
      let toolData = undefined;

      if (typeof msg.message.content === 'string') {
        content = msg.message.content;
      } else if (Array.isArray(msg.message.content)) {
        // Process content array
        for (const item of msg.message.content) {
          if (item.type === 'text' && item.text) {
            content += (content ? '\n' : '') + item.text;
          }

          // Extract tool use information
          if (item.type === 'tool_use' && item.name) {
            toolData = {
              name: item.name,
              params: item.input || {},
              result: undefined // Tool results come in separate messages
            };
          }
        }
      }

      // Create unified message
      unified.push({
        role: toolData ? 'tool' : 'assistant',
        content: content.trim(),
        bubbleId: msg.uuid,
        timestamp: msg.timestamp,
        toolData
      });
    }
  }

  return unified;
}

/**
 * Detect message format and convert to unified
 */
export function toUnified(messages: BubbleData[] | ClaudeCodeMessage[]): ParsedMessage[] {
  if (messages.length === 0) {
    return [];
  }

  // Check if it's Cursor format (has bubbleId property)
  const first = messages[0] as any;
  if ('bubbleId' in first) {
    return cursorToUnified(messages as BubbleData[]);
  }

  // Otherwise assume Claude Code format (has sessionId property)
  return claudeToUnified(messages as ClaudeCodeMessage[]);
}
