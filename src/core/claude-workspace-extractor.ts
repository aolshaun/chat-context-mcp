/**
 * Claude Code Workspace Extractor
 *
 * Extracts workspace paths and nicknames from Claude Code JSONL messages
 */

import type { ClaudeCodeMessage } from './claude-code-db.js';

/**
 * Extract project path from Claude Code messages
 * Claude Code stores the project path in the `cwd` field of each message
 */
export function extractWorkspaceFromClaudeMessages(messages: ClaudeCodeMessage[]): string | null {
  if (messages.length === 0) {
    return null;
  }

  // Get cwd from first message (all messages in a session have the same cwd)
  const firstMessage = messages[0];
  if (firstMessage && firstMessage.cwd) {
    return firstMessage.cwd;
  }

  return null;
}

/**
 * Extract nickname from nickname_current_session tool calls in Claude Code messages
 */
export function extractNicknameFromClaudeMessages(messages: ClaudeCodeMessage[]): string | null {
  for (const message of messages) {
    // Check if this is an assistant message with tool_use
    if (message.type !== 'assistant' || !message.message.content) {
      continue;
    }

    // Claude Code stores content as an array
    if (!Array.isArray(message.message.content)) {
      continue;
    }

    for (const content of message.message.content) {
      // Look for tool_use blocks
      if (content.type !== 'tool_use') {
        continue;
      }

      // Check if this is a nickname_current_session tool
      const toolName = content.name || '';
      if (toolName === 'mcp__cursor-context__nickname_current_session' ||
          toolName === 'nickname_current_session') {

        // Extract nickname from input
        if (content.input && typeof content.input === 'object') {
          const nickname = (content.input as any).nickname;
          if (nickname && typeof nickname === 'string') {
            return nickname;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get project name from workspace path
 */
export function getProjectNameFromPath(workspacePath: string): string {
  if (!workspacePath) {
    return 'unknown';
  }

  // Remove trailing slashes
  const cleaned = workspacePath.replace(/[\/\\]+$/, '');

  if (!cleaned) {
    return 'unknown';
  }

  // Handle Windows paths
  const separator = cleaned.includes('\\') ? '\\' : '/';

  // Split and get last part
  const parts = cleaned.split(separator);
  const lastPart = parts[parts.length - 1];

  // Return last part or 'unknown' if empty
  return lastPart || 'unknown';
}

/**
 * Extract all unique project paths from messages
 */
export function extractAllWorkspacePathsFromClaudeMessages(messages: ClaudeCodeMessage[]): string[] {
  const paths = new Set<string>();

  for (const message of messages) {
    if (message.cwd) {
      paths.add(message.cwd);
    }
  }

  return Array.from(paths);
}

/**
 * Check if Claude Code session has a project
 */
export function hasProjectInClaudeMessages(messages: ClaudeCodeMessage[]): boolean {
  return extractWorkspaceFromClaudeMessages(messages) !== null;
}

/**
 * Get workspace info for Claude Code session
 */
export interface ClaudeWorkspaceInfo {
  primaryPath: string | null;
  projectName: string | null;
  allPaths: string[];
  hasProject: boolean;
  isMultiWorkspace: boolean;
  nickname: string | null;
}

export function getClaudeWorkspaceInfo(messages: ClaudeCodeMessage[]): ClaudeWorkspaceInfo {
  const allPaths = extractAllWorkspacePathsFromClaudeMessages(messages);
  const primaryPath = allPaths[0] || null;
  const nickname = extractNicknameFromClaudeMessages(messages);

  return {
    primaryPath,
    projectName: primaryPath ? getProjectNameFromPath(primaryPath) : null,
    allPaths,
    hasProject: allPaths.length > 0,
    isMultiWorkspace: allPaths.length > 1,
    nickname
  };
}
