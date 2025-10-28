/**
 * Core API - Main Interface
 * 
 * High-level API that orchestrates all core modules
 */

import { CursorDB } from './cursor-db.js';
import { ClaudeCodeDB } from './claude-code-db.js';
import { MetadataDB } from './metadata-db.js';
import { getCursorDBPath, getMetadataDBPath } from './platform.js';
import { parseBubbles, type ParseOptions } from './message-parser.js';
import { getWorkspaceInfo, extractWorkspaceFromComposerData, getProjectName, isEmptySession } from './workspace-extractor.js';
import { getClaudeWorkspaceInfo } from './claude-workspace-extractor.js';
import { claudeToUnified } from './format-adapters.js';
import { SessionNotFoundError } from './errors.js';
import type { 
  SessionMetadata, 
  SessionWithMessages, 
  ParsedMessage,
  ProjectInfo
} from './types.js';

/**
 * Options for listing sessions
 */
export interface ListSessionsOptions {
  /** Filter by project path */
  projectPath?: string;
  /** Only include sessions with tags */
  taggedOnly?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Filter by specific tag */
  tag?: string;
  /** Sort order (newest first by default) */
  sortBy?: 'newest' | 'oldest' | 'most_messages';
  /** Force sync before listing (default: auto-sync if >5min stale) */
  syncFirst?: boolean;
  /** Filter by source (cursor, claude, or all) */
  source?: 'cursor' | 'claude' | 'all';
}

/**
 * Options for searching sessions
 */
export interface SearchSessionsOptions {
  /** Search query (searches in first message preview) */
  query: string;
  /** Limit to specific project */
  projectPath?: string;
  /** Only search sessions with tags */
  taggedOnly?: boolean;
  /** Maximum results */
  limit?: number;
  /** Case sensitive search */
  caseSensitive?: boolean;
}

/**
 * Options for getting a session
 */
export interface GetSessionOptions {
  /** Parse options for messages */
  parseOptions?: ParseOptions;
  /** Load full messages or just metadata */
  includeMessages?: boolean;
}

/**
 * Main API for Cursor Context Retrieval
 *
 * High-level interface that orchestrates CursorDB, ClaudeCodeDB and MetadataDB
 */
export class CursorContext {
  private cursorDB: CursorDB;
  private claudeCodeDB: ClaudeCodeDB;
  private metadataDB: MetadataDB;
  private autoSync: boolean;
  private autoSyncLimit: number;
  private lastSyncTime: number = 0;
  private readonly STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a new CursorContext instance
   *
   * @param cursorDBPath - Path to Cursor's database (default: auto-detect)
   * @param metadataDBPath - Path to metadata database (default: ~/.cursor-context/metadata.db)
   * @param autoSync - Automatically sync metadata when accessing sessions (default: true)
   * @param autoSyncLimit - Maximum number of sessions to check during auto-sync (default: 100000)
   * @param claudeProjectsPath - Path to Claude Code projects (default: ~/.claude/projects)
   */
  constructor(
    cursorDBPath?: string,
    metadataDBPath?: string,
    autoSync = true,
    autoSyncLimit = 100000,
    claudeProjectsPath?: string
  ) {
    this.cursorDB = new CursorDB(cursorDBPath || getCursorDBPath());
    this.claudeCodeDB = new ClaudeCodeDB(claudeProjectsPath);
    this.metadataDB = new MetadataDB(metadataDBPath || getMetadataDBPath());
    this.autoSync = autoSync;
    this.autoSyncLimit = autoSyncLimit;
  }

  /**
   * Check if metadata is stale (older than 5 minutes)
   */
  private isStale(): boolean {
    return Date.now() - this.lastSyncTime > this.STALE_THRESHOLD_MS;
  }

  /**
   * List sessions with optional filtering
   * Auto-syncs if data is stale (>5 min) or if syncFirst is true
   */
  async listSessions(options: ListSessionsOptions = {}): Promise<SessionMetadata[]> {
    const {
      projectPath,
      taggedOnly = false,
      limit,
      tag,
      sortBy = 'newest',
      syncFirst = false,
      source = 'all'
    } = options;

    // Auto-sync if requested OR if data is stale
    if (this.autoSync && (syncFirst || this.isStale())) {
      await this.syncSessions(this.autoSyncLimit, source);
    }

    // If filtering by tag, use tag-based query
    if (tag) {
      const sessions = this.metadataDB.findByTag(tag);

      // Apply additional filters
      let filtered = sessions;
      if (projectPath) {
        filtered = filtered.filter(s => s.project_path === projectPath);
      }
      if (source !== 'all') {
        filtered = filtered.filter(s => s.source === source);
      }

      return this.sortAndLimit(filtered, sortBy, limit);
    }

    // If filtering by project, use project-based query
    if (projectPath) {
      const sessions = this.metadataDB.listSessionsByProject(projectPath);

      let filtered = sessions;
      if (taggedOnly) {
        filtered = filtered.filter(s => s.tags && s.tags.length > 0);
      }
      if (source !== 'all') {
        filtered = filtered.filter(s => s.source === source);
      }

      return this.sortAndLimit(filtered, sortBy, limit);
    }

    // General listing with optional filters
    const sessions = this.metadataDB.listSessions({
      tagged_only: taggedOnly,
      limit
    });

    // Filter by source if needed
    let filtered = sessions;
    if (source !== 'all') {
      filtered = filtered.filter(s => s.source === source);
    }

    return this.sortAndLimit(filtered, sortBy, limit);
  }

  /**
   * Get a single session by ID or nickname
   */
  async getSession(
    idOrNickname: string,
    options: GetSessionOptions = {}
  ): Promise<SessionWithMessages> {
    const {
      parseOptions,
      includeMessages = true
    } = options;

    // Try to get by nickname first
    let metadata = this.metadataDB.getSessionByNickname(idOrNickname);

    // If not found, try by exact ID (with prefix)
    if (!metadata) {
      metadata = this.metadataDB.getSessionMetadata(idOrNickname);
    }

    // If not found, try by ID prefix (like git does with commit hashes)
    if (!metadata) {
      metadata = this.metadataDB.findSessionByIdPrefix(idOrNickname);
    }

    // If not found, try adding cursor: prefix
    if (!metadata && !idOrNickname.includes(':')) {
      metadata = this.metadataDB.getSessionMetadata(`cursor:${idOrNickname}`);
    }

    // If still not found and autoSync is enabled, try to fetch from Cursor DB
    if (!metadata && this.autoSync && !idOrNickname.includes(':')) {
      metadata = await this.syncCursorSession(idOrNickname);
    }

    // If still not found, throw error
    if (!metadata) {
      throw new SessionNotFoundError(idOrNickname);
    }

    // Load messages if requested
    let messages: ParsedMessage[] = [];

    if (includeMessages) {
      // Strip prefix to get raw session ID
      const parts = metadata.session_id.split(':');
      const source = parts[0];
      const rawId = parts[1];

      if (!rawId) {
        throw new Error(`Invalid session ID format: ${metadata.session_id}`);
      }

      if (source === 'cursor') {
        const bubbles = this.cursorDB.getSessionBubbles(rawId);
        messages = parseBubbles(bubbles, parseOptions);
      } else if (source === 'claude') {
        const claudeMessages = this.claudeCodeDB.getSessionMessages(rawId);
        messages = claudeToUnified(claudeMessages);
      }
    }

    return {
      metadata,
      messages
    };
  }

  /**
   * Search sessions by content
   */
  async searchSessions(options: SearchSessionsOptions): Promise<SessionMetadata[]> {
    const { 
      query, 
      projectPath, 
      taggedOnly = false, 
      limit,
      caseSensitive = false
    } = options;

    // Get all sessions based on filters
    const sessions = await this.listSessions({ 
      projectPath, 
      taggedOnly,
      limit: undefined // Get all first, then filter
    });

    // Prepare search query
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    // Filter by content
    const matches = sessions.filter(session => {
      // Search in nickname
      if (session.nickname) {
        const nickname = caseSensitive ? session.nickname : session.nickname.toLowerCase();
        if (nickname.includes(searchQuery)) {
          return true;
        }
      }

      // Search in first message preview
      if (session.first_message_preview) {
        const preview = caseSensitive 
          ? session.first_message_preview 
          : session.first_message_preview.toLowerCase();
        if (preview.includes(searchQuery)) {
          return true;
        }
      }

      // Search in tags
      if (session.tags) {
        for (const tag of session.tags) {
          const tagText = caseSensitive ? tag : tag.toLowerCase();
          if (tagText.includes(searchQuery)) {
            return true;
          }
        }
      }

      // Search in project name
      if (session.project_name) {
        const projectName = caseSensitive 
          ? session.project_name 
          : session.project_name.toLowerCase();
        if (projectName.includes(searchQuery)) {
          return true;
        }
      }

      return false;
    });

    // Apply limit
    return limit ? matches.slice(0, limit) : matches;
  }

  /**
   * Set a nickname for a session
   */
  async setNickname(sessionId: string, nickname: string): Promise<void> {
    let prefixedId: string;
    let rawId: string;
    let source: 'cursor' | 'claude';

    if (sessionId.includes(':')) {
      // Session ID has prefix
      [source, rawId] = sessionId.split(':') as ['cursor' | 'claude', string];
      prefixedId = sessionId;
    } else {
      // No prefix - try to find the session in either source
      // Check Cursor first
      const cursorData = this.cursorDB.getComposerData(sessionId);
      const claudeMessages = this.claudeCodeDB.getSessionMessages(sessionId);

      if (cursorData && (!claudeMessages || claudeMessages.length === 0)) {
        // Found in Cursor only
        source = 'cursor';
        rawId = sessionId;
        prefixedId = `cursor:${sessionId}`;
      } else if (claudeMessages && claudeMessages.length > 0 && !cursorData) {
        // Found in Claude only
        source = 'claude';
        rawId = sessionId;
        prefixedId = `claude:${sessionId}`;
      } else if (cursorData && claudeMessages && claudeMessages.length > 0) {
        // Found in both - this is a collision, require explicit prefix
        throw new Error(`Session ID ${sessionId} exists in both Cursor and Claude Code. Please specify the source using prefix: cursor:${sessionId} or claude:${sessionId}`);
      } else {
        // Not found in either
        throw new SessionNotFoundError(sessionId);
      }
    }

    // If autoSync and no metadata exists, sync first
    if (this.autoSync) {
      const existing = this.metadataDB.getSessionMetadata(prefixedId);
      if (!existing) {
        if (source === 'cursor') {
          await this.syncCursorSession(rawId);
        } else {
          await this.syncClaudeSession(rawId);
        }
      }
    }

    // Set the nickname (use prefixed ID)
    this.metadataDB.setNickname(prefixedId, nickname);
  }

  /**
   * Add a tag to a session
   */
  async addTag(sessionId: string, tag: string): Promise<void> {
    let prefixedId: string;
    let rawId: string;
    let source: 'cursor' | 'claude';

    if (sessionId.includes(':')) {
      // Session ID has prefix
      [source, rawId] = sessionId.split(':') as ['cursor' | 'claude', string];
      prefixedId = sessionId;
    } else {
      // No prefix - try to find the session in either source
      const cursorData = this.cursorDB.getComposerData(sessionId);
      const claudeMessages = this.claudeCodeDB.getSessionMessages(sessionId);

      if (cursorData && (!claudeMessages || claudeMessages.length === 0)) {
        // Found in Cursor only
        source = 'cursor';
        rawId = sessionId;
        prefixedId = `cursor:${sessionId}`;
      } else if (claudeMessages && claudeMessages.length > 0 && !cursorData) {
        // Found in Claude only
        source = 'claude';
        rawId = sessionId;
        prefixedId = `claude:${sessionId}`;
      } else if (cursorData && claudeMessages && claudeMessages.length > 0) {
        // Found in both - this is a collision, require explicit prefix
        throw new Error(`Session ID ${sessionId} exists in both Cursor and Claude Code. Please specify the source using prefix: cursor:${sessionId} or claude:${sessionId}`);
      } else {
        // Not found in either
        throw new SessionNotFoundError(sessionId);
      }
    }

    // If autoSync and no metadata exists, sync first
    if (this.autoSync) {
      const existing = this.metadataDB.getSessionMetadata(prefixedId);
      if (!existing) {
        if (source === 'cursor') {
          await this.syncCursorSession(rawId);
        } else {
          await this.syncClaudeSession(rawId);
        }
      }
    }

    this.metadataDB.addTag(prefixedId, tag);
  }

  /**
   * Remove a tag from a session
   */
  async removeTag(sessionId: string, tag: string): Promise<void> {
    this.metadataDB.removeTag(sessionId, tag);
  }

  /**
   * Get all available projects
   */
  getProjects(): ProjectInfo[] {
    return this.metadataDB.listProjects();
  }

  /**
   * Get all available tags
   */
  getTags(): Array<{ tag: string; count: number }> {
    return this.metadataDB.listAllTags();
  }

  /**
   * Get statistics about the database
   */
  getStats() {
    const metadataStats = this.metadataDB.getStats();
    const cursorSessions = this.cursorDB.listComposerIds(1000);
    
    return {
      totalSessionsInCursor: cursorSessions.length,
      totalSessionsWithMetadata: metadataStats.total_sessions,
      sessionsWithNicknames: metadataStats.sessions_with_nicknames,
      sessionsWithTags: metadataStats.sessions_with_tags,
      sessionsWithProjects: metadataStats.sessions_with_projects,
      totalTags: metadataStats.total_tags,
      totalProjects: metadataStats.total_projects
    };
  }

  /**
   * Sync a Cursor session from Cursor DB to Metadata DB
   *
   * @internal
   */
  private async syncCursorSession(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const composerData = this.cursorDB.getComposerData(sessionId);
      if (!composerData) {
        return null;
      }

      // Skip empty sessions (no messages)
      if (isEmptySession(composerData)) {
        return null;
      }

      const bubbles = this.cursorDB.getSessionBubbles(sessionId);
      const messages = parseBubbles(bubbles);
      const workspaceInfo = getWorkspaceInfo(bubbles);

      // If workspace not found in bubbles, check composerData fields
      let workspacePath: string | undefined = workspaceInfo.primaryPath || undefined;
      if (!workspacePath) {
        const pathFromComposer = extractWorkspaceFromComposerData(composerData);
        workspacePath = pathFromComposer || undefined;
      }

      const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';

      const metadata: SessionMetadata = {
        session_id: `cursor:${sessionId}`,
        source: 'cursor',
        nickname: workspaceInfo.nickname || undefined,
        project_path: workspacePath,
        project_name: workspacePath ? getProjectName(workspacePath) : undefined,
        has_project: !!workspacePath,
        first_message_preview: firstUserMsg.substring(0, 200),
        message_count: messages.length,
        created_at: composerData.createdAt ? Date.parse(composerData.createdAt) : undefined,
        last_synced_at: Date.now()
      };

      this.metadataDB.upsertSessionMetadata(metadata);
      return metadata;
    } catch (error) {
      // Sync failed, return null
      return null;
    }
  }

  /**
   * Sync a Claude Code session to Metadata DB
   *
   * @internal
   */
  private async syncClaudeSession(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const messages = this.claudeCodeDB.getSessionMessages(sessionId);
      if (!messages || messages.length === 0) {
        return null;
      }

      // Extract workspace and nickname
      const workspaceInfo = getClaudeWorkspaceInfo(messages);
      const unified = claudeToUnified(messages);

      const firstUserMsg = unified.find(m => m.role === 'user')?.content || '';

      // Get created timestamp from first message
      const createdAt = messages[0]?.timestamp
        ? new Date(messages[0].timestamp).getTime()
        : undefined;

      const metadata: SessionMetadata = {
        session_id: `claude:${sessionId}`,
        source: 'claude',
        nickname: workspaceInfo.nickname || undefined,
        project_path: workspaceInfo.primaryPath || undefined,
        project_name: workspaceInfo.primaryPath ? getProjectName(workspaceInfo.primaryPath) : undefined,
        has_project: !!workspaceInfo.primaryPath,
        first_message_preview: firstUserMsg.substring(0, 200),
        message_count: unified.length,
        created_at: createdAt,
        last_synced_at: Date.now()
      };

      this.metadataDB.upsertSessionMetadata(metadata);
      return metadata;
    } catch (error) {
      // Sync failed, return null
      return null;
    }
  }

  /**
   * Sync multiple sessions from Cursor DB to Metadata DB
   * Only syncs sessions that are new or have been updated since last sync
   */
  async syncSessions(limit?: number, source: 'cursor' | 'claude' | 'all' = 'cursor'): Promise<number> {
    let synced = 0;

    // Sync Cursor sessions
    if (source === 'cursor' || source === 'all') {
      synced += await this.syncCursorSessions(limit);
    }

    // Sync Claude Code sessions
    if (source === 'claude' || source === 'all') {
      synced += await this.syncClaudeSessions(limit);
    }

    // Update last sync time
    this.lastSyncTime = Date.now();

    return synced;
  }

  /**
   * Sync Cursor sessions only
   */
  private async syncCursorSessions(limit?: number): Promise<number> {
    const cursorTimestamps = this.cursorDB.getAllSessionTimestamps(limit);
    let synced = 0;

    for (const [sessionId, lastUpdatedAt] of cursorTimestamps.entries()) {
      const prefixedId = `cursor:${sessionId}`;
      const existing = this.metadataDB.getSessionMetadata(prefixedId);

      const needsSync = !existing ||
                       !existing.last_synced_at ||
                       lastUpdatedAt > existing.last_synced_at;

      if (needsSync) {
        const metadata = await this.syncCursorSession(sessionId);
        if (metadata) {
          synced++;
        }
      }
    }

    return synced;
  }

  /**
   * Sync Claude Code sessions only
   */
  private async syncClaudeSessions(limit?: number): Promise<number> {
    const claudeTimestamps = this.claudeCodeDB.getSessionTimestamps(limit);
    let synced = 0;

    for (const [sessionId, lastAccessedAt] of claudeTimestamps.entries()) {
      const prefixedId = `claude:${sessionId}`;
      const existing = this.metadataDB.getSessionMetadata(prefixedId);

      const needsSync = !existing ||
                       !existing.last_synced_at ||
                       lastAccessedAt > existing.last_synced_at;

      if (needsSync) {
        const metadata = await this.syncClaudeSession(sessionId);
        if (metadata) {
          synced++;
        }
      }
    }

    return synced;
  }

  /**
   * Close database connections
   */
  close(): void {
    this.cursorDB.close();
    this.metadataDB.close();
  }

  /**
   * Get the underlying CursorDB instance (for advanced use)
   */
  getCursorDB(): CursorDB {
    return this.cursorDB;
  }

  /**
   * Get the underlying MetadataDB instance (for advanced use)
   */
  getMetadataDB(): MetadataDB {
    return this.metadataDB;
  }

  /**
   * Helper to sort and limit sessions
   */
  private sortAndLimit(
    sessions: SessionMetadata[], 
    sortBy: 'newest' | 'oldest' | 'most_messages',
    limit?: number
  ): SessionMetadata[] {
    // Sort
    let sorted = [...sessions];
    
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return b.created_at - a.created_at;
        });
        break;
      
      case 'oldest':
        sorted.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return a.created_at - b.created_at;
        });
        break;
      
      case 'most_messages':
        sorted.sort((a, b) => {
          const aCount = a.message_count || 0;
          const bCount = b.message_count || 0;
          return bCount - aCount;
        });
        break;
    }

    // Limit
    return limit ? sorted.slice(0, limit) : sorted;
  }
}

