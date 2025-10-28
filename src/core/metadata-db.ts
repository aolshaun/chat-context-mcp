/**
 * Metadata Database
 * 
 * Manages session metadata (nicknames, tags, project paths) in a separate SQLite database.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { SessionMetadata, ProjectInfo } from './types.js';

const SCHEMA_VERSION = 2;

export class MetadataDB {
  private dbPath: string;
  private db: Database.Database | null = null;
  
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }
  
  /**
   * Connect to database (lazy initialization)
   */
  private connect(): Database.Database {
    if (this.db) {
      return this.db;
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Open database
    this.db = new Database(this.dbPath);
    
    // Initialize schema
    this.initialize();
    
    return this.db;
  }
  
  /**
   * Initialize database and create tables
   */
  private initialize(): void {
    if (!this.db) {
      return;
    }
    
    // Create schema version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);
    
    // Check current version
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
    const currentVersion = versionRow?.version || 0;
    
    if (currentVersion === 0) {
      // First time setup
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS session_metadata (
          session_id TEXT PRIMARY KEY,
          source TEXT DEFAULT 'cursor',
          nickname TEXT UNIQUE,
          tags TEXT,
          project_path TEXT,
          project_name TEXT,
          has_project INTEGER DEFAULT 0,
          created_at INTEGER,
          last_accessed INTEGER,
          last_synced_at INTEGER,
          first_message_preview TEXT,
          message_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_source ON session_metadata(source);
        CREATE INDEX IF NOT EXISTS idx_nickname ON session_metadata(nickname);
        CREATE INDEX IF NOT EXISTS idx_project_path ON session_metadata(project_path);
        CREATE INDEX IF NOT EXISTS idx_project_name ON session_metadata(project_name);
        CREATE INDEX IF NOT EXISTS idx_has_project ON session_metadata(has_project);
        CREATE INDEX IF NOT EXISTS idx_created_at ON session_metadata(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_last_synced_at ON session_metadata(last_synced_at DESC);

        INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
      `);
    }

    // Migration from version 1 to version 2: add source column
    if (currentVersion < 2) {
      const columns = this.db.pragma('table_info(session_metadata)') as Array<{ name: string }>;

      // Add last_synced_at if missing (version 1 migration)
      const hasLastSyncedAt = columns.some(col => col.name === 'last_synced_at');
      if (!hasLastSyncedAt) {
        this.db.exec(`
          ALTER TABLE session_metadata ADD COLUMN last_synced_at INTEGER;
          CREATE INDEX IF NOT EXISTS idx_last_synced_at ON session_metadata(last_synced_at DESC);
        `);
      }

      // Add source column (version 2 migration)
      const hasSource = columns.some(col => col.name === 'source');
      if (!hasSource) {
        this.db.exec(`
          ALTER TABLE session_metadata ADD COLUMN source TEXT DEFAULT 'cursor';
          CREATE INDEX IF NOT EXISTS idx_source ON session_metadata(source);
          UPDATE session_metadata SET source = 'cursor' WHERE source IS NULL;
        `);
      }

      // Update schema version
      this.db.exec(`UPDATE schema_version SET version = ${SCHEMA_VERSION}`);
    }
  }
  
  /**
   * Upsert session metadata
   */
  upsertSessionMetadata(metadata: SessionMetadata): void {
    const db = this.connect();

    const stmt = db.prepare(`
      INSERT INTO session_metadata (
        session_id, nickname, tags, project_path, project_name, has_project,
        created_at, last_accessed, last_synced_at, first_message_preview, message_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        nickname = excluded.nickname,
        tags = excluded.tags,
        project_path = excluded.project_path,
        project_name = excluded.project_name,
        has_project = excluded.has_project,
        last_accessed = excluded.last_accessed,
        last_synced_at = excluded.last_synced_at,
        first_message_preview = excluded.first_message_preview,
        message_count = excluded.message_count
    `);

    stmt.run(
      metadata.session_id,
      metadata.nickname || null,
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      metadata.project_path || null,
      metadata.project_name || null,
      metadata.has_project ? 1 : 0,
      metadata.created_at || Date.now(),
      metadata.last_accessed || Date.now(),
      metadata.last_synced_at || Date.now(),
      metadata.first_message_preview || null,
      metadata.message_count || 0
    );
  }
  
  /**
   * Get session metadata by ID
   */
  getSessionMetadata(sessionId: string): SessionMetadata | null {
    const db = this.connect();
    
    const row = db.prepare('SELECT * FROM session_metadata WHERE session_id = ?')
      .get(sessionId) as any;
    
    if (!row) {
      return null;
    }
    
    return this.rowToMetadata(row);
  }
  
  /**
   * Convert database row to SessionMetadata
   */
  private rowToMetadata(row: any): SessionMetadata {
    return {
      session_id: row.session_id,
      nickname: row.nickname || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      project_path: row.project_path || undefined,
      project_name: row.project_name || undefined,
      has_project: Boolean(row.has_project),
      created_at: row.created_at || undefined,
      last_accessed: row.last_accessed || undefined,
      last_synced_at: row.last_synced_at || undefined,
      first_message_preview: row.first_message_preview || undefined,
      message_count: row.message_count || undefined
    };
  }
  
  /**
   * Set nickname for a session
   */
  setNickname(sessionId: string, nickname: string): void {
    const db = this.connect();
    
    // Check if nickname already exists for a different session
    const existing = this.getSessionByNickname(nickname);
    if (existing && existing.session_id !== sessionId) {
      throw new Error(`Nickname '${nickname}' is already in use by session ${existing.session_id}`);
    }
    
    const stmt = db.prepare('UPDATE session_metadata SET nickname = ? WHERE session_id = ?');
    const result = stmt.run(nickname, sessionId);
    
    if (result.changes === 0) {
      // Session doesn't exist, create it
      this.upsertSessionMetadata({
        session_id: sessionId,
        nickname,
        has_project: false
      });
    }
  }
  
  /**
   * Get session by nickname
   */
  getSessionByNickname(nickname: string): SessionMetadata | null {
    const db = this.connect();

    const row = db.prepare('SELECT * FROM session_metadata WHERE nickname = ?')
      .get(nickname) as any;

    if (!row) {
      return null;
    }

    return this.rowToMetadata(row);
  }

  /**
   * Find session by ID prefix (supports partial UUIDs like git does)
   */
  findSessionByIdPrefix(prefix: string): SessionMetadata | null {
    const db = this.connect();

    // Match session IDs that start with the prefix
    const rows = db.prepare('SELECT * FROM session_metadata WHERE session_id LIKE ?')
      .all(`${prefix}%`) as any[];

    if (rows.length === 0) {
      return null;
    }

    // If multiple matches, return null (ambiguous prefix)
    if (rows.length > 1) {
      throw new Error(`Ambiguous session ID prefix '${prefix}' matches ${rows.length} sessions. Please provide more characters.`);
    }

    return this.rowToMetadata(rows[0]);
  }
  
  /**
   * List all nicknames
   */
  listNicknames(): string[] {
    const db = this.connect();
    
    const rows = db.prepare('SELECT nickname FROM session_metadata WHERE nickname IS NOT NULL ORDER BY nickname')
      .all() as { nickname: string }[];
    
    return rows.map(row => row.nickname);
  }
  
  /**
   * Add tag to session
   */
  addTag(sessionId: string, tag: string): void {
    this.connect(); // Ensure DB is initialized
    
    const metadata = this.getSessionMetadata(sessionId);
    
    if (!metadata) {
      // Create metadata with tag
      this.upsertSessionMetadata({
        session_id: sessionId,
        tags: [tag],
        has_project: false
      });
      return;
    }
    
    const tags = metadata.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      metadata.tags = tags;
      this.upsertSessionMetadata(metadata);
    }
  }
  
  /**
   * Remove tag from session
   */
  removeTag(sessionId: string, tag: string): void {
    const metadata = this.getSessionMetadata(sessionId);
    
    if (!metadata || !metadata.tags) {
      return;
    }
    
    metadata.tags = metadata.tags.filter(t => t !== tag);
    this.upsertSessionMetadata(metadata);
  }
  
  /**
   * Find sessions by tag
   */
  findByTag(tag: string): SessionMetadata[] {
    const db = this.connect();
    
    const rows = db.prepare('SELECT * FROM session_metadata WHERE tags IS NOT NULL')
      .all() as any[];
    
    return rows
      .map(row => this.rowToMetadata(row))
      .filter(metadata => metadata.tags?.includes(tag));
  }
  
  /**
   * List all tags with counts
   */
  listAllTags(): { tag: string; count: number }[] {
    const db = this.connect();
    
    const rows = db.prepare('SELECT tags FROM session_metadata WHERE tags IS NOT NULL')
      .all() as { tags: string }[];
    
    const tagCounts = new Map<string, number>();
    
    for (const row of rows) {
      const tags = JSON.parse(row.tags) as string[];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }
  
  /**
   * List sessions by project
   */
  listSessionsByProject(projectPath: string): SessionMetadata[] {
    const db = this.connect();
    
    const rows = db.prepare('SELECT * FROM session_metadata WHERE project_path = ? ORDER BY created_at DESC')
      .all(projectPath) as any[];
    
    return rows.map(row => this.rowToMetadata(row));
  }
  
  /**
   * List all projects with session counts
   */
  listProjects(): ProjectInfo[] {
    const db = this.connect();
    
    const rows = db.prepare(`
      SELECT project_path, project_name, COUNT(*) as session_count
      FROM session_metadata
      WHERE project_path IS NOT NULL
      GROUP BY project_path
      ORDER BY session_count DESC
    `).all() as any[];
    
    return rows.map(row => ({
      path: row.project_path,
      name: row.project_name || 'unknown',
      session_count: row.session_count
    }));
  }
  
  /**
   * List all sessions with optional filters
   */
  listSessions(options: {
    project?: string;
    tagged_only?: boolean;
    limit?: number;
  } = {}): SessionMetadata[] {
    const db = this.connect();
    
    let query = 'SELECT * FROM session_metadata WHERE 1=1';
    const params: any[] = [];
    
    if (options.project) {
      query += ' AND project_path = ?';
      params.push(options.project);
    }
    
    if (options.tagged_only) {
      query += ' AND nickname IS NOT NULL';
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    
    return rows.map(row => this.rowToMetadata(row));
  }
  
  /**
   * Delete session metadata
   */
  deleteSessionMetadata(sessionId: string): void {
    const db = this.connect();
    db.prepare('DELETE FROM session_metadata WHERE session_id = ?').run(sessionId);
  }
  
  /**
   * Get database statistics
   */
  getStats(): {
    total_sessions: number;
    sessions_with_nicknames: number;
    sessions_with_tags: number;
    sessions_with_projects: number;
    total_projects: number;
    total_tags: number;
  } {
    const db = this.connect();
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        COALESCE(SUM(CASE WHEN nickname IS NOT NULL THEN 1 ELSE 0 END), 0) as sessions_with_nicknames,
        COALESCE(SUM(CASE WHEN tags IS NOT NULL AND tags != '' THEN 1 ELSE 0 END), 0) as sessions_with_tags,
        COALESCE(SUM(CASE WHEN has_project = 1 THEN 1 ELSE 0 END), 0) as sessions_with_projects,
        COUNT(DISTINCT CASE WHEN project_path IS NOT NULL THEN project_path END) as total_projects
      FROM session_metadata
    `).get() as any;
    
    // Count total unique tags using listAllTags method
    const allTags = this.listAllTags();
    const totalTags = allTags.length;
    
    return {
      total_sessions: stats.total_sessions,
      sessions_with_nicknames: stats.sessions_with_nicknames,
      sessions_with_tags: stats.sessions_with_tags,
      sessions_with_projects: stats.sessions_with_projects,
      total_projects: stats.total_projects,
      total_tags: totalTags
    };
  }
  
  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }
  
  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        // Ignore errors on close
      }
      this.db = null;
    }
  }
}

