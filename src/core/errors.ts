/**
 * Custom Error Types
 */

/**
 * Base error for Cursor Context operations
 */
export class CursorContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CursorContextError';
  }
}

/**
 * Error connecting to database
 */
export class DBConnectionError extends CursorContextError {
  constructor(message: string, public readonly dbPath: string) {
    super(message);
    this.name = 'DBConnectionError';
  }
}

/**
 * Database is locked (SQLITE_BUSY)
 */
export class DBLockedError extends CursorContextError {
  constructor(message: string = 'Database is locked by another process (likely Cursor)') {
    super(message);
    this.name = 'DBLockedError';
  }
}

/**
 * Session not found
 */
export class SessionNotFoundError extends CursorContextError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Invalid or corrupted data
 */
export class DataCorruptionError extends CursorContextError {
  constructor(message: string) {
    super(`Data corruption: ${message}`);
    this.name = 'DataCorruptionError';
  }
}

