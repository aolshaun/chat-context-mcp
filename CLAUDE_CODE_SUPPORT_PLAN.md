# Claude Code Support Implementation Plan

**Project**: chat-context-mcp
**Goal**: Add support for reading and syncing Claude Code chat sessions alongside Cursor sessions
**Status**: Planning Phase
**Estimated Effort**: 6-8 hours for professional implementation

---

## Executive Summary

Currently, the MCP server only reads chat sessions from Cursor's SQLite database. We want to extend it to also read sessions from Claude Code's JSONL files, allowing users to search, nickname, and sync chats from both editors in one unified system.

**Key Principle**: Keep data sources separate and traceable. Never mix formats or lose origin information.

---

## Current Architecture

### What We Have
```
┌─────────────┐
│ Cursor DB   │ ──→ CursorDB ──→ API ──→ MCP Tools ──→ User
│ (SQLite)    │
└─────────────┘
```

### Storage Structure
- **Cursor**: `~/.cursor/User/workspaceStorage/*/state.vscdb` (SQLite)
- **Metadata**: `~/.cursor-context/metadata.db` (SQLite)
- **Format**: Complex nested bubbles with `toolFormerData`

---

## Target Architecture

### What We'll Build
```
┌─────────────┐
│ Cursor DB   │ ──→ CursorDB ────┐
│ (SQLite)    │                  │
└─────────────┘                  ├──→ UnifiedAPI ──→ MCP Tools ──→ User
                                 │
┌─────────────┐                  │
│ Claude Code │ ──→ ClaudeCodeDB ┘
│ (.jsonl)    │
└─────────────┘
```

### New Storage Locations
- **Claude Code Sessions**: `~/.claude/projects/[project-path]/[session-id].jsonl`
- **Metadata DB**: Enhanced with `source` column to track origin

---

## Data Format Comparison

### Cursor Format
```json
{
  "bubbleId": "uuid",
  "type": 1,  // 1=user, 2=assistant
  "text": "message content",
  "toolFormerData": {
    "name": "mcp_cursor-context_sync_sessions",
    "params": "{...}",
    "result": "{...}"
  }
}
```

### Claude Code Format
```json
{
  "sessionId": "uuid",
  "cwd": "/path/to/project",
  "timestamp": "ISO-8601",
  "type": "user" | "assistant",
  "message": {
    "role": "user" | "assistant",
    "content": [
      {"type": "text", "text": "..."},
      {"type": "tool_use", "id": "...", "name": "...", "input": {...}}
    ]
  }
}
```

### Key Differences
| Feature | Cursor | Claude Code |
|---------|--------|-------------|
| **Storage** | SQLite DB | JSONL files |
| **Project Path** | Must extract from tool calls/context | Built-in `cwd` field |
| **Tool Format** | `toolFormerData.params` | `message.content[].input` |
| **Message Structure** | Bubbles | Standard JSON lines |

---

## Database Schema Changes

### Add `source` Column
```sql
ALTER TABLE session_metadata ADD COLUMN source TEXT DEFAULT 'cursor';
```

### Updated Schema
```typescript
interface SessionMetadata {
  session_id: string;           // Primary key (prefixed: cursor:{uuid} or claude:{uuid})
  source: 'cursor' | 'claude';  // ✅ NEW: Track origin
  nickname?: string;
  project_path?: string;
  project_name?: string;
  has_project: boolean;
  created_at?: number;
  last_accessed?: number;
  last_synced_at?: number;
  first_message_preview?: string;
  message_count?: number;
}
```

### Session ID Format
- **Cursor**: `cursor:{original-uuid}`
- **Claude**: `claude:{original-uuid}`
- Prevents collisions while preserving source info

---

## Implementation Tasks

### Phase 1: Core Infrastructure (2-3 hours)

#### Task 1.1: Create ClaudeCodeDB Module
**File**: `src/core/claude-code-db.ts`

**Responsibilities**:
- Find all `.jsonl` files in `~/.claude/projects/`
- Read and parse JSONL format
- Extract session metadata (ID, project, timestamps, message count)
- Return sessions in a format compatible with existing API

**Key Methods**:
```typescript
class ClaudeCodeDB {
  constructor(claudeProjectsPath?: string);
  getAllSessions(): ClaudeCodeSession[];
  getSessionMessages(sessionId: string): ClaudeCodeMessage[];
  getSessionTimestamps(limit?: number): Map<string, number>;
  close(): void;
}
```

#### Task 1.2: Update Database Schema
**File**: `src/core/metadata-db.ts`

**Changes**:
- Add `source` column to `session_metadata` table
- Update `upsertSessionMetadata()` to handle source
- Update queries to filter/group by source
- Add migration logic for existing data (default to 'cursor')

#### Task 1.3: Create Workspace Extractor for Claude Code
**File**: `src/core/claude-workspace-extractor.ts`

**Responsibilities**:
- Extract project path from `cwd` field (already present!)
- Extract nickname from `nickname_current_session` tool calls
- Parse Claude Code tool format: `message.content[].type === 'tool_use'`
- Handle `input` params vs Cursor's `params` format

### Phase 2: API Integration (2-3 hours)

#### Task 2.1: Update Core API
**File**: `src/core/api.ts`

**Changes**:
```typescript
class CursorContext {
  private cursorDB: CursorDB;
  private claudeCodeDB: ClaudeCodeDB;  // ✅ NEW
  private metadataDB: MetadataDB;

  // Add source parameter to sync
  async syncSessions(limit?: number, source?: 'cursor' | 'claude' | 'all'): Promise<number>;

  // Add source filtering to list
  async listSessions(options: ListSessionsOptions & { source?: string }): Promise<SessionMetadata[]>;
}
```

#### Task 2.2: Unified Session Format
**File**: `src/core/types.ts`

**Add**:
```typescript
interface UnifiedMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  toolData?: ToolInfo;
  source: 'cursor' | 'claude';  // Track per message
}
```

#### Task 2.3: Format Adapters
**File**: `src/core/format-adapters.ts`

**Create**:
```typescript
function cursorToUnified(bubbles: BubbleData[]): UnifiedMessage[];
function claudeToUnified(messages: ClaudeCodeMessage[]): UnifiedMessage[];
```

### Phase 3: Tool Updates (1-2 hours)

#### Task 3.1: Update MCP Tools
**File**: `src/mcp-server/index.ts`

**Changes**:
- Add `source` parameter to `sync_sessions` tool
- Add `source` parameter to `list_sessions` tool
- Update tool descriptions to mention multi-source support

#### Task 3.2: Update CLI Commands
**File**: `src/cli/commands/*.ts`

**Changes**:
- Add `--source cursor|claude|all` flag to sync command
- Add `--source` filter to list command
- Display source in output tables

#### Task 3.3: Update Workspace Extractor
**File**: `src/core/workspace-extractor.ts`

**Changes**:
- Add logic to detect tool call format (Cursor vs Claude)
- Extract params from both `toolFormerData.params` AND `message.content[].input`
- Handle both nested formats for project/nickname extraction

### Phase 4: Testing & Polish (1 hour)

#### Task 4.1: Test Data Integrity
- Verify Cursor sessions still sync correctly
- Verify Claude Code sessions sync correctly
- Verify no data mixing or corruption
- Verify source filtering works

#### Task 4.2: Test Workspace Extraction
- Test project path extraction from both sources
- Test nickname extraction from both tool formats
- Test tool parameter extraction (project, etc.)

#### Task 4.3: Documentation
- Update README with Claude Code support info
- Document new `--source` flags
- Add examples for both sources

---

## File Structure

```
src/
├── core/
│   ├── cursor-db.ts                    # Existing
│   ├── claude-code-db.ts               # ✅ NEW
│   ├── metadata-db.ts                  # ✅ MODIFY (add source column)
│   ├── api.ts                          # ✅ MODIFY (integrate both DBs)
│   ├── workspace-extractor.ts          # ✅ MODIFY (handle both formats)
│   ├── claude-workspace-extractor.ts   # ✅ NEW
│   ├── format-adapters.ts              # ✅ NEW
│   └── types.ts                        # ✅ MODIFY (add source field)
├── mcp-server/
│   ├── index.ts                        # ✅ MODIFY (add source param)
│   └── tools.ts                        # ✅ MODIFY (pass source through)
└── cli/
    └── commands/
        ├── sync.ts                     # ✅ MODIFY (add --source flag)
        └── list.ts                     # ✅ MODIFY (add --source filter)
```

---

## Migration Strategy

### For Existing Users

1. **Automatic Migration**: On first run after update:
   ```sql
   ALTER TABLE session_metadata ADD COLUMN source TEXT DEFAULT 'cursor';
   UPDATE session_metadata SET source = 'cursor' WHERE source IS NULL;
   ```

2. **Backward Compatibility**:
   - Default behavior unchanged (sync Cursor only)
   - Must explicitly opt-in to Claude Code sync: `--source all` or `--source claude`

3. **No Data Loss**:
   - Existing Cursor sessions retain all data
   - Session IDs prefixed with source to prevent conflicts

---

## User Experience

### CLI Examples

```bash
# Sync only Cursor sessions (default, backward compatible)
cursor-context sync

# Sync only Claude Code sessions
cursor-context sync --source claude

# Sync both
cursor-context sync --source all

# List all sessions
cursor-context list --source all

# List only Claude Code sessions
cursor-context list --source claude

# Filter by project AND source
cursor-context list --project /path/to/project --source claude
```

### MCP Tool Examples

```typescript
// Sync both sources
mcp_cursor-context_sync_sessions({ source: 'all' })

// List only Cursor sessions
mcp_cursor-context_list_sessions({ source: 'cursor', limit: 10 })

// Filter works across both sources
mcp_cursor-context_list_sessions({
  project: '/Users/me/my-project',
  source: 'all'  // Shows sessions from both Cursor and Claude Code
})
```

---

## Quality Assurance Checklist

### Data Integrity
- [ ] Cursor sessions sync without changes to existing behavior
- [ ] Claude Code sessions sync correctly
- [ ] No session ID collisions between sources
- [ ] Source column accurately tracks origin
- [ ] Session metadata preserved from both sources

### Functionality
- [ ] Project path extraction works for both sources
- [ ] Nickname extraction works from both tool formats
- [ ] Tool parameter extraction handles both formats
- [ ] Filtering by source works correctly
- [ ] Syncing specific source works correctly

### User Experience
- [ ] CLI help text updated
- [ ] Error messages are clear
- [ ] Default behavior unchanged (backward compatible)
- [ ] Output clearly shows source for each session

### Code Quality
- [ ] Type safety maintained
- [ ] No code duplication
- [ ] Consistent error handling
- [ ] Clean separation of concerns (adapters, extractors)
- [ ] Tests added for new functionality

---

## Risks & Mitigation

### Risk 1: Data Corruption
**Mitigation**:
- Prefix session IDs with source
- Add source column to track origin
- Never modify original source files (Cursor DB or Claude JSONL)

### Risk 2: Format Changes in Claude Code
**Mitigation**:
- Version detection in JSONL parser
- Graceful degradation for unknown formats
- Clear error messages for unsupported versions

### Risk 3: Performance with Many Sessions
**Mitigation**:
- Lazy loading of JSONL files
- Cache parsed sessions
- Limit parameter for sync operations

### Risk 4: Breaking Changes for Existing Users
**Mitigation**:
- Automatic schema migration
- Default to Cursor-only (existing behavior)
- Explicit opt-in for Claude Code support

---

## Success Criteria

### Must Have
✅ Can sync Claude Code sessions without breaking Cursor sync
✅ Can filter sessions by source (cursor/claude/all)
✅ Project paths extracted correctly from both sources
✅ Nicknames work for both sources
✅ No data loss or corruption

### Nice to Have
🎯 Performance optimizations for large session counts
🎯 Real-time file watching for Claude Code sessions
🎯 Cross-reference between same project in both editors

### Out of Scope (Future)
⏭️ Merging sessions from both sources into one view
⏭️ Converting sessions between formats
⏭️ Two-way sync (writing back to Claude Code)

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1**: Core Infrastructure | ClaudeCodeDB, Schema, Extractors | 2-3 hours |
| **Phase 2**: API Integration | Unified API, Adapters | 2-3 hours |
| **Phase 3**: Tool Updates | MCP Tools, CLI | 1-2 hours |
| **Phase 4**: Testing & Polish | QA, Documentation | 1 hour |
| **Total** | | **6-9 hours** |

---

## Next Steps

1. **Review this plan** - Ensure it aligns with project goals
2. **Create task list** - Break down into actionable todos
3. **Set up branch** - Create `feature/claude-code-support` branch
4. **Start Phase 1** - Begin with ClaudeCodeDB implementation
5. **Test incrementally** - Verify each phase before moving forward
6. **Document as we go** - Update docs with each change

---

## Notes

- This plan prioritizes **professional architecture** over quick implementation
- Focus is on **clean separation of concerns** and **data integrity**
- All changes are **backward compatible** with existing Cursor-only setup
- Design allows for **future expansion** to other editors (VS Code, etc.)
