# Phase 1: Core Library - Detailed Roadmap

## Objective
Build the foundational library for reading Cursor's database, extracting sessions, parsing messages, and managing metadata. This is the most critical phase - everything else builds on this.

## Deliverables
- ✅ Working TypeScript/Node.js core library
- ✅ Read Cursor database (read-only, safe)
- ✅ Extract session list with metadata
- ✅ Parse messages (user + assistant)
- ✅ Extract workspace paths from tool results
- ✅ Metadata database for nicknames/tags
- ✅ Unit tests for all core functions

## Technology Stack
- **Language:** TypeScript (for type safety + Node.js ecosystem)
- **Database:** better-sqlite3 (fast, synchronous SQLite)
- **Testing:** Jest or Vitest
- **Build:** tsx for development, tsc for production

---

## Task Breakdown

### 1. Project Setup (5 tasks)

- [ ] **1.1** Initialize Node.js project with TypeScript
  - Create `package.json`
  - Install dependencies: `better-sqlite3`, TypeScript, types
  - Configure `tsconfig.json`
  - Set up directory structure (`src/core/`)
  - **AC:** `npm run build` compiles successfully

- [ ] **1.2** Set up development tooling
  - Install `tsx` for fast dev execution
  - Configure ESLint + Prettier
  - Add `package.json` scripts: `dev`, `build`, `test`
  - **AC:** Can run `npm run dev src/core/test.ts`

- [ ] **1.3** Set up testing framework
  - Install Jest or Vitest
  - Configure test runner
  - Create `tests/` directory structure
  - Add test script to package.json
  - **AC:** `npm test` runs (even with 0 tests)

- [ ] **1.4** Create core module structure
  - `src/core/cursor-db.ts` (placeholder)
  - `src/core/metadata-db.ts` (placeholder)
  - `src/core/message-parser.ts` (placeholder)
  - `src/core/workspace-extractor.ts` (placeholder)
  - `src/core/types.ts` (shared types)
  - **AC:** All files import without errors

- [ ] **1.5** Add platform detection utility
  - Create `src/core/platform.ts`
  - Implement `getCursorDBPath()` for macOS/Windows/Linux
  - Add validation (check if file exists)
  - **AC:** Returns correct path on current platform

---

### 2. Cursor Database Access (8 tasks)

- [ ] **2.1** Implement safe database connection
  - Create `CursorDB` class in `cursor-db.ts`
  - Open database with `readonly: true`
  - Add WAL mode detection
  - Handle SQLITE_BUSY with retry logic (max 3 attempts)
  - **AC:** Can connect to actual Cursor DB without errors

- [ ] **2.2** Add error handling for DB access
  - Custom error types: `DBConnectionError`, `DBLockedError`
  - Try-catch wrapper with meaningful messages
  - Graceful degradation if DB unavailable
  - **AC:** Clean error messages when DB is locked/missing

- [ ] **2.3** Query composer sessions
  - Method: `listComposerIds(limit?: number): string[]`
  - Query: `SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%'`
  - Extract UUID from key
  - Order by key (most recent first)
  - **AC:** Returns list of composer UUIDs

- [ ] **2.4** Fetch composer data
  - Method: `getComposerData(composerId: string): ComposerData | null`
  - Query specific composerData entry
  - Parse JSON value
  - Handle missing/corrupted data
  - **AC:** Returns parsed composer object

- [ ] **2.5** Fetch bubble (message) data
  - Method: `getBubbleData(composerId: string, bubbleId: string): BubbleData | null`
  - Query: `SELECT value FROM cursorDiskKV WHERE key = ?`
  - Key format: `bubbleId:{composerId}:{bubbleId}`
  - Parse JSON value
  - **AC:** Returns parsed bubble object

- [ ] **2.6** Fetch all bubbles for a session
  - Method: `getSessionBubbles(composerId: string): BubbleData[]`
  - Get bubbleIds from composer conversation/fullConversationHeadersOnly
  - Fetch each bubble
  - Maintain order
  - **AC:** Returns array of all messages in order

- [ ] **2.7** Add connection pooling/caching
  - Singleton pattern for DB connection
  - Cache frequently accessed sessions
  - LRU cache with size limit (50 sessions max)
  - **AC:** Same session fetched twice = cache hit

- [ ] **2.8** Write tests for database access
  - Mock SQLite database for tests
  - Test connection success/failure
  - Test query methods
  - Test error handling
  - **AC:** All DB tests pass

---

### 3. TypeScript Types & Interfaces (4 tasks)

- [ ] **3.1** Define core types
  - Create `src/core/types.ts`
  - `ComposerData` interface (based on actual schema)
  - `BubbleData` interface (type 1 vs type 2)
  - `ConversationHeader` interface
  - **AC:** Types match actual Cursor DB structure

- [ ] **3.2** Define metadata types
  - `SessionMetadata` interface
  - `SessionWithMessages` interface (full session)
  - `MessageParsed` interface (user/assistant/tool)
  - **AC:** Types support all planned features

- [ ] **3.3** Define search/filter types
  - `SearchOptions` interface (query, project filter, limit)
  - `ListOptions` interface (project, tagged_only, limit)
  - `ProjectFilter` type: `'current' | 'all' | string`
  - **AC:** All API functions use these types

- [ ] **3.4** Add JSDoc documentation
  - Document all public interfaces
  - Add examples to key types
  - Explain non-obvious fields
  - **AC:** Hover in IDE shows helpful docs

---

### 4. Workspace Path Extraction (6 tasks)

- [ ] **4.1** Implement tool result parser
  - Function: `parseToolResult(bubble: BubbleData): WorkspaceResult | null`
  - Check for `toolFormerData` field
  - Parse `result` JSON string
  - Extract `workspaceResults` keys
  - **AC:** Extracts workspace path from grep/read_file results

- [ ] **4.2** Implement workspace extractor
  - Function: `extractWorkspacePath(composerId: string): string | null`
  - Iterate through session bubbles
  - Find first tool result with workspace
  - Return absolute path
  - **AC:** Returns `/Users/...` path or null

- [ ] **4.3** Derive project name from path
  - Function: `getProjectName(workspacePath: string): string`
  - Extract last folder name
  - Handle edge cases (root, trailing slash)
  - **AC:** `/Users/me/projects/my-app` → `my-app`

- [ ] **4.4** Handle multi-workspace sessions
  - Track all unique workspace paths in session
  - Return primary (first/most frequent)
  - Store others in metadata (optional)
  - **AC:** Sessions with multiple workspaces handled

- [ ] **4.5** Detect sessions without projects
  - Sessions with no tool results = no workspace
  - Flag as `has_project = false`
  - Label as "General" conversation
  - **AC:** Correctly identifies project-less sessions

- [ ] **4.6** Write tests for workspace extraction
  - Mock bubbles with tool results
  - Test various tool types (grep, read_file, etc.)
  - Test missing workspace
  - Test multi-workspace
  - **AC:** All workspace extraction tests pass

---

### 5. Message Parsing (10 tasks)

- [ ] **5.1** Parse user messages (type 1)
  - Extract `richText` field
  - Parse Lexical JSON format
  - Extract plain text content
  - **AC:** User message text extracted correctly

- [ ] **5.2** Parse assistant messages (type 2)
  - Extract `text` field (plain text)
  - Handle empty text (tool-only responses)
  - Preserve formatting
  - **AC:** Assistant message text extracted

- [ ] **5.3** Parse Lexical richText format
  - Function: `parseLexicalText(richTextJson: string): string`
  - Traverse nested `children` nodes
  - Extract text from each node
  - Handle all node types (paragraph, text, code)
  - **AC:** Converts rich text to plain text

- [ ] **5.4** Handle code blocks in messages
  - Detect code nodes in richText
  - Extract language and content
  - Preserve formatting in output
  - **AC:** Code blocks preserved or marked

- [ ] **5.5** Handle mentions (@file, @folder)
  - Detect mention nodes
  - Extract referenced files/folders
  - Include in parsed output metadata
  - **AC:** Mentions tracked separately

- [ ] **5.6** Parse tool calls and results
  - Extract `toolFormerData` from bubbles
  - Parse tool name, params, result
  - Format for display (optional: hide by default)
  - **AC:** Tool info available in parsed message

- [ ] **5.7** Create unified message format
  - Type: `ParsedMessage` with fields:
    - `role: 'user' | 'assistant' | 'tool'`
    - `content: string`
    - `bubbleId: string`
    - `timestamp?: string`
    - `toolData?: ToolInfo`
  - **AC:** All messages use this format

- [ ] **5.8** Handle edge cases
  - Empty messages
  - Corrupted JSON in richText
  - Unknown bubble types
  - Missing fields
  - **AC:** Graceful degradation, no crashes

- [ ] **5.9** Add message filtering options
  - Filter out tool results (for cleaner context)
  - Include only user/assistant exchanges
  - Configurable in parse options
  - **AC:** Can get "clean" conversation

- [ ] **5.10** Write tests for message parsing
  - Test user message parsing
  - Test assistant message parsing
  - Test richText parsing
  - Test code blocks, mentions
  - Test edge cases
  - **AC:** All parsing tests pass (>90% coverage)

---

### 6. Metadata Database (9 tasks)

- [ ] **6.1** Design metadata schema
  - Review schema in main doc
  - Finalize fields needed for Phase 1
  - Plan indexes for performance
  - **AC:** Schema documented and agreed

- [ ] **6.2** Create metadata database
  - Create `MetadataDB` class in `metadata-db.ts`
  - Initialize SQLite DB at `~/.cursor-context/metadata.db`
  - Create tables with schema
  - Add indexes
  - **AC:** DB created on first run

- [ ] **6.3** Implement session metadata CRUD
  - `upsertSessionMetadata(metadata: SessionMetadata): void`
  - `getSessionMetadata(sessionId: string): SessionMetadata | null`
  - `deleteSessionMetadata(sessionId: string): void`
  - **AC:** Can create, read, update, delete metadata

- [ ] **6.4** Implement nickname operations
  - `setNickname(sessionId: string, nickname: string): void`
  - `getSessionByNickname(nickname: string): SessionMetadata | null`
  - `listNicknames(): string[]`
  - Enforce unique nicknames
  - **AC:** Nickname lookups work, uniqueness enforced

- [ ] **6.5** Implement tag operations
  - `addTag(sessionId: string, tag: string): void`
  - `removeTag(sessionId: string, tag: string): void`
  - `findByTag(tag: string): SessionMetadata[]`
  - `listAllTags(): string[]`
  - Store tags as JSON array
  - **AC:** Tag queries work correctly

- [ ] **6.6** Implement project filtering
  - `listSessionsByProject(projectPath: string): SessionMetadata[]`
  - `listProjects(): ProjectInfo[]` (with session counts)
  - Filter by project in list/search
  - **AC:** Can list all sessions for a project

- [ ] **6.7** Auto-populate metadata on first access
  - When session fetched, check if metadata exists
  - If not, extract: project, first message preview, created date
  - Store in metadata DB
  - **AC:** Metadata auto-created lazily

- [ ] **6.8** Add migration support
  - Version metadata DB schema
  - Add version check on startup
  - Plan for future schema changes
  - **AC:** DB version tracked, ready for migrations

- [ ] **6.9** Write tests for metadata DB
  - Test CRUD operations
  - Test nickname uniqueness
  - Test tag operations
  - Test project filtering
  - Test auto-population
  - **AC:** All metadata tests pass

---

### 7. Session Formatting (4 tasks)

- [ ] **7.1** Implement Markdown formatter
  - Function: `formatSessionMarkdown(session: SessionWithMessages): string`
  - Format: header with metadata, then messages
  - User messages prefixed with `[USER]`
  - Assistant messages prefixed with `[ASSISTANT]`
  - **AC:** Readable markdown output

- [ ] **7.2** Implement JSON formatter
  - Function: `formatSessionJSON(session: SessionWithMessages): string`
  - Pretty-printed JSON
  - Include all metadata
  - **AC:** Valid, parseable JSON

- [ ] **7.3** Implement compact preview format
  - For list views: `sessionId | nickname | project | preview (50 chars) | date`
  - Function: `formatSessionPreview(metadata: SessionMetadata): string`
  - **AC:** One-line summaries for lists

- [ ] **7.4** Add formatting options
  - Include/exclude tool calls
  - Include/exclude timestamps
  - Max messages limit
  - Message range (e.g., messages 10-20)
  - **AC:** Configurable output

---

### 8. Core API Interface (5 tasks)

- [ ] **8.1** Create main `CursorContext` class
  - High-level API that combines all modules
  - Constructor: initialize both DBs
  - Clean, simple interface for CLI/MCP to use
  - **AC:** Single entry point for all operations

- [ ] **8.2** Implement list sessions API
  - Method: `listSessions(options: ListOptions): SessionMetadata[]`
  - Options: project, limit, tagged_only
  - Returns sorted by date (recent first)
  - **AC:** List works with all filter options

- [ ] **8.3** Implement fetch session API
  - Method: `fetchSessionById(sessionId: string, options?: FetchOptions): SessionWithMessages`
  - Method: `fetchSessionByNickname(nickname: string, options?: FetchOptions): SessionWithMessages`
  - Options: message_limit, include_tools
  - **AC:** Fetch returns full session with messages

- [ ] **8.4** Implement search API
  - Method: `searchSessions(query: string, options: SearchOptions): SearchResult[]`
  - Full-text search across message content
  - Project filtering
  - Return matches with context (surrounding messages)
  - **AC:** Search finds relevant sessions

- [ ] **8.5** Implement tagging API
  - Method: `tagSession(sessionId: string, nickname?: string, tags?: string[]): void`
  - Method: `getSessionId(nickname: string): string | null`
  - Method: `listTags(): TagInfo[]` (tag + count)
  - **AC:** Tagging works from core API

---

### 9. Testing & Validation (4 tasks)

- [ ] **9.1** Create test fixtures
  - Mock Cursor DB with sample data
  - Sample sessions with various formats
  - Edge cases: empty sessions, corrupted data
  - **AC:** Reusable test data for all tests

- [ ] **9.2** Integration tests
  - Test full workflow: connect → list → fetch → parse
  - Test with real Cursor DB (read-only)
  - Verify performance (1000+ sessions)
  - **AC:** Integration tests pass

- [ ] **9.3** Error handling tests
  - Test DB locked scenario
  - Test corrupted data
  - Test missing sessions
  - Test invalid inputs
  - **AC:** All error paths tested

- [ ] **9.4** Performance benchmarks
  - Measure parse time for large session (500+ messages)
  - Measure search time across 1000+ sessions
  - Ensure <100ms for common operations
  - **AC:** Performance is acceptable

---

### 10. Documentation (3 tasks)

- [ ] **10.1** Write API documentation
  - JSDoc for all public methods
  - Examples for each main function
  - **AC:** Auto-generated docs look good

- [ ] **10.2** Create usage examples
  - `examples/list-sessions.ts`
  - `examples/fetch-session.ts`
  - `examples/search.ts`
  - **AC:** Examples run and demonstrate features

- [ ] **10.3** Update README
  - Core library overview
  - Installation instructions
  - Quick start guide
  - **AC:** Someone can use the library

---

## Acceptance Criteria for Phase 1 Complete

✅ Can list all Cursor sessions with metadata
✅ Can fetch any session by ID with full messages
✅ Messages are parsed to plain text (user + assistant)
✅ Workspace paths extracted and stored in metadata
✅ Nickname/tag system works
✅ Project filtering works
✅ Search finds sessions by content
✅ All tests pass (>80% coverage)
✅ Performance is acceptable (<100ms for most ops)
✅ Documentation exists and examples work

---

## Dependencies & Blockers

**External Dependencies:**
- Access to Cursor database (user must have Cursor installed)
- Node.js 18+ (for modern TypeScript features)

**Internal Dependencies:**
- Task 2.x blocks 4.x (need DB access for workspace extraction)
- Task 5.x blocks 8.x (need parsing for fetch API)
- Task 6.x blocks 8.x (need metadata for list/search API)

**No Blockers:** Can start immediately with task 1.1

---

## Estimated Timeline

- **Setup (Section 1, 3):** 1-2 days
- **DB Access (Section 2):** 2-3 days
- **Workspace Extraction (Section 4):** 1-2 days
- **Message Parsing (Section 5):** 3-4 days (most complex)
- **Metadata DB (Section 6):** 2-3 days
- **Formatting & API (Section 7, 8):** 2-3 days
- **Testing & Docs (Section 9, 10):** 2-3 days

**Total: ~2-3 weeks of focused work**

---

## Next Steps

1. ✅ Create this roadmap
2. **Start with Task 1.1** - Initialize project
3. Work through tasks sequentially
4. Mark tasks complete as we go
5. Adjust roadmap based on learnings

Let's build this! 🚀

