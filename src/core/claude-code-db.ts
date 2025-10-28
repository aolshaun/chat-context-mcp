/**
 * Claude Code Database Reader
 *
 * Reads chat sessions from Claude Code's JSONL files
 * Location: ~/.claude/projects/[project-path]/[session-id].jsonl
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Single message from Claude Code JSONL file
 */
export interface ClaudeCodeMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  type: 'user' | 'assistant';
  message: {
    role: 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      id?: string;
      name?: string;
      input?: any;
      tool_use_id?: string;
      content?: string;
    }>;
    model?: string;
    id?: string;
    usage?: any;
  };
  uuid: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Claude Code session metadata
 */
export interface ClaudeCodeSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  messageCount: number;
  createdAt: number;
  lastAccessedAt: number;
  firstMessagePreview?: string;
}

/**
 * Database reader for Claude Code sessions
 */
export class ClaudeCodeDB {
  private claudeProjectsPath: string;

  constructor(claudeProjectsPath?: string) {
    this.claudeProjectsPath = claudeProjectsPath || path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Get all Claude Code sessions across all projects
   */
  getAllSessions(): ClaudeCodeSession[] {
    const sessions: ClaudeCodeSession[] = [];

    if (!fs.existsSync(this.claudeProjectsPath)) {
      return sessions;
    }

    const projectDirs = fs.readdirSync(this.claudeProjectsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(this.claudeProjectsPath, projectDir);
      const sessionFiles = this.getSessionFilesInProject(projectPath);

      for (const sessionFile of sessionFiles) {
        try {
          const session = this.parseSessionFile(sessionFile, projectDir);
          if (session) {
            sessions.push(session);
          }
        } catch (error) {
          // Skip invalid session files
          console.error(`Error parsing session file ${sessionFile}:`, error);
        }
      }
    }

    return sessions;
  }

  /**
   * Get all session files in a project directory
   */
  private getSessionFilesInProject(projectPath: string): string[] {
    if (!fs.existsSync(projectPath)) {
      return [];
    }

    return fs.readdirSync(projectPath)
      .filter(file => file.endsWith('.jsonl'))
      .map(file => path.join(projectPath, file));
  }

  /**
   * Parse a session JSONL file
   */
  private parseSessionFile(filePath: string, projectDir: string): ClaudeCodeSession | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return null;
    }

    const messages: ClaudeCodeMessage[] = [];
    let sessionId = '';
    let cwd = '';
    let firstMessageText = '';
    let createdAt = 0;
    let lastAccessedAt = 0;

    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as ClaudeCodeMessage;
        messages.push(msg);

        // Extract metadata from first message
        if (!sessionId) {
          sessionId = msg.sessionId;
          cwd = msg.cwd;
          createdAt = new Date(msg.timestamp).getTime();
        }

        // Get first user message for preview
        if (!firstMessageText && msg.type === 'user') {
          if (typeof msg.message.content === 'string') {
            firstMessageText = msg.message.content;
          } else if (Array.isArray(msg.message.content)) {
            const textContent = msg.message.content.find(c => c.type === 'text');
            if (textContent && textContent.text) {
              firstMessageText = textContent.text;
            }
          }
        }

        // Track last accessed time
        const msgTime = new Date(msg.timestamp).getTime();
        if (msgTime > lastAccessedAt) {
          lastAccessedAt = msgTime;
        }
      } catch (error) {
        // Skip invalid lines
        continue;
      }
    }

    if (!sessionId) {
      return null;
    }

    // Extract project name from cwd or directory name
    const projectName = cwd ? path.basename(cwd) : this.extractProjectNameFromDir(projectDir);

    return {
      sessionId,
      projectPath: cwd || this.extractProjectPathFromDir(projectDir),
      projectName,
      messageCount: messages.length,
      createdAt,
      lastAccessedAt,
      firstMessagePreview: firstMessageText.substring(0, 200)
    };
  }

  /**
   * Extract project name from directory name
   * Example: "-Users-macbook-play-chat-context-mcp" -> "chat-context-mcp"
   */
  private extractProjectNameFromDir(dirName: string): string {
    const parts = dirName.split('-').filter(p => p);
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Extract project path from directory name
   * Example: "-Users-macbook-play-chat-context-mcp" -> "/Users/macbook/play/chat-context-mcp"
   */
  private extractProjectPathFromDir(dirName: string): string {
    // Directory names are encoded with dashes replacing slashes
    // Example: -Users-macbook-play-project -> /Users/macbook/play/project
    return '/' + dirName.replace(/^-/, '').replace(/-/g, '/');
  }

  /**
   * Get messages for a specific session
   */
  getSessionMessages(sessionId: string): ClaudeCodeMessage[] {
    // Find the session file across all projects
    if (!fs.existsSync(this.claudeProjectsPath)) {
      return [];
    }

    const projectDirs = fs.readdirSync(this.claudeProjectsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(this.claudeProjectsPath, projectDir);
      const sessionFile = path.join(projectPath, `${sessionId}.jsonl`);

      if (fs.existsSync(sessionFile)) {
        return this.readMessagesFromFile(sessionFile);
      }
    }

    return [];
  }

  /**
   * Read all messages from a JSONL file
   */
  private readMessagesFromFile(filePath: string): ClaudeCodeMessage[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const messages: ClaudeCodeMessage[] = [];

    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as ClaudeCodeMessage;
        messages.push(msg);
      } catch (error) {
        // Skip invalid lines
        continue;
      }
    }

    return messages;
  }

  /**
   * Get session timestamps for sync optimization
   * Returns Map<sessionId, lastAccessedTimestamp>
   */
  getSessionTimestamps(limit?: number): Map<string, number> {
    const sessions = this.getAllSessions();
    const timestamps = new Map<string, number>();

    // Sort by last accessed (newest first)
    const sorted = sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    // Apply limit if specified
    const limited = limit ? sorted.slice(0, limit) : sorted;

    for (const session of limited) {
      timestamps.set(session.sessionId, session.lastAccessedAt);
    }

    return timestamps;
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return this.getAllSessions().map(s => s.sessionId);
  }

  /**
   * Close the database connection (no-op for file-based storage)
   */
  close(): void {
    // No cleanup needed for file-based storage
  }
}
