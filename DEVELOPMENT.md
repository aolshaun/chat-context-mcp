# Development Guide

## Project Structure

```
chat-context-mcp/
├── src/core/               # Core library (shared)
│   ├── api.ts             # Main CursorContext API
│   ├── cursor-db.ts       # Read-only Cursor DB access
│   ├── metadata-db.ts     # Metadata management
│   ├── message-parser.ts  # Parse Lexical richText
│   ├── workspace-extractor.ts  # Extract workspace paths
│   ├── formatter.ts       # Format sessions for output
│   ├── platform.ts        # Platform detection
│   ├── errors.ts          # Custom error types
│   ├── types.ts           # TypeScript interfaces
│   └── index.ts           # Public API exports
├── tests/
│   ├── core/              # Unit tests for each module
│   └── integration/       # E2E workflow tests
├── examples/              # Example scripts
├── roadmap/               # Phase documentation
└── docs/                  # Additional documentation

Future structure:
├── src/cli/               # CLI tool (Phase 2)
└── src/mcp-server/        # MCP server (Phase 3)
```

## Testing

### Test Categories

1. **Unit Tests** (tests/core/) - 162 tests
   - Individual module functionality
   - Edge cases and error handling
   - Mock data where appropriate

2. **Integration Tests** (tests/core/api.test.ts) - 40 tests
   - Full API interactions
   - Real database access
   - Multi-module workflows

3. **E2E Tests** (tests/integration/) - 7 tests
   - Complete user workflows
   - Real-world scenarios
   - Error recovery

**Total: 169 tests passing**

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test tests/core/api.test.ts

# Watch mode
npm run test:watch

# With coverage (future)
npm run test:coverage
```

### Writing Tests

Follow existing patterns:
- Use `describe` blocks for logical grouping
- Use `beforeEach`/`afterAll` for setup/cleanup
- Clean up temporary resources
- Test both success and error paths
- Use meaningful test names

Example:
```typescript
describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  });
  
  afterAll(() => {
    // Cleanup
  });
  
  it('should do something specific', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Building

```bash
# Build TypeScript
npm run build

# Output goes to dist/
```

## Code Style

### TypeScript

- **Strict mode enabled** - All strict type checking
- **ESM modules** - Use `.js` extensions in imports
- **Explicit types** - Avoid `any`, use proper types
- **JSDoc comments** - Document all public APIs

### Naming Conventions

- **Classes**: PascalCase (`CursorContext`, `MetadataDB`)
- **Interfaces**: PascalCase (`SessionMetadata`, `ParseOptions`)
- **Functions**: camelCase (`listSessions`, `formatSessionMarkdown`)
- **Constants**: UPPER_SNAKE_CASE (when truly constant)
- **Files**: kebab-case (`cursor-db.ts`, `message-parser.ts`)

### Error Handling

Use custom error types:
```typescript
throw new SessionNotFoundError(sessionId);
throw new DBConnectionError(message, dbPath);
throw new DBLockedError(message);
throw new DataCorruptionError(message, data);
```

## Database Schema

### Cursor's Database

Located at: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

```sql
CREATE TABLE cursorDiskKV (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Keys:
-- composerData:{uuid} - Session metadata
-- bubbleId:{composer}:{bubble} - Message data
```

### Metadata Database

Located at: `~/.cursor-context/metadata.db`

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,
  nickname TEXT UNIQUE,
  tags TEXT,
  project_path TEXT,
  project_name TEXT,
  has_project INTEGER DEFAULT 0,
  created_at INTEGER,
  last_accessed INTEGER,
  first_message_preview TEXT,
  message_count INTEGER
);

CREATE INDEX idx_nickname ON session_metadata(nickname);
CREATE INDEX idx_project ON session_metadata(project_path);
CREATE INDEX idx_has_project ON session_metadata(has_project);
```

## Key Design Patterns

### 1. Read-Only Access
- Never write to Cursor's database
- All modifications go to separate metadata DB
- Use retry logic for locked databases

### 2. Lazy Loading
- Connect to DB only when needed
- Auto-sync on first access (if enabled)
- Close connections properly

### 3. Type Safety
- All database rows mapped to TypeScript interfaces
- Explicit error types
- Optional fields properly handled

### 4. Separation of Concerns
```
CursorContext (API)
    ↓
CursorDB (read) + MetadataDB (read/write)
    ↓
Parsers + Extractors + Formatters
```

## Adding New Features

### 1. Add to Core Library

1. Create module in `src/core/`
2. Add TypeScript types to `types.ts`
3. Export from `index.ts`
4. Write unit tests in `tests/core/`

### 2. Extend API

1. Add methods to `CursorContext` class
2. Update interface types
3. Add integration tests in `tests/core/api.test.ts`
4. Update README with examples

### 3. Add Formatter

1. Add function to `formatter.ts`
2. Export from `index.ts`
3. Add tests in `tests/core/formatter.test.ts`
4. Document in README

## Performance Considerations

### Database Access

- **Limit queries** - Use `limit` parameter
- **Batch operations** - Sync multiple sessions at once
- **Prepared statements** - Reused for repeated queries
- **Indexes** - On frequently queried columns

### Memory Management

- **Close connections** - Always call `.close()`
- **Limit message size** - Use `maxContentLength` option
- **Stream large results** - For future bulk exports

### Caching

Currently minimal caching. Future improvements:
- Cache frequently accessed sessions
- Cache project/tag lists
- Invalidate on metadata changes

## Debugging

### Enable Verbose Logging

```typescript
// Add to modules as needed
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Debug info:', data);
}
```

### Inspect Databases

```bash
# Cursor's DB
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb

# Metadata DB
sqlite3 ~/.cursor-context/metadata.db

# Useful queries
SELECT * FROM cursorDiskKV WHERE key LIKE 'composerData:%' LIMIT 5;
SELECT * FROM session_metadata ORDER BY created_at DESC LIMIT 10;
```

### Common Issues

**Database Locked**
- Cursor is writing to DB
- Solution: Retry with exponential backoff (already implemented)

**Session Not Found**
- Session has no messages
- Solution: Auto-sync or manual sync

**Parsing Errors**
- Rich text format changed
- Solution: Graceful degradation, return plain text

## Release Process

### Version Bumping

```bash
# Patch (bug fixes)
npm version patch

# Minor (new features)
npm version minor

# Major (breaking changes)
npm version major
```

### Pre-release Checklist

- [ ] All tests passing (`npm test`)
- [ ] Build successful (`npm run build`)
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Examples working
- [ ] No console.logs in production code

### Publishing

```bash
# Build and test
npm run build
npm test

# Publish to npm (future)
npm publish
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes
4. Add tests
5. Ensure tests pass
6. Update documentation
7. Commit changes (`git commit -m 'Add amazing feature'`)
8. Push to branch (`git push origin feature/amazing-feature`)
9. Open Pull Request

### Code Review

PRs will be reviewed for:
- ✅ Tests pass
- ✅ Code follows style guide
- ✅ Documentation updated
- ✅ No breaking changes (or properly versioned)
- ✅ Performance considerations
- ✅ Security implications

## Future Phases

### Phase 2: CLI Tool
- Interactive TUI with session browser
- Command-line operations
- Configuration management
- Bulk import/export

### Phase 3: MCP Server
- Model Context Protocol implementation
- Native Cursor integration
- Real-time session tracking
- AI-driven context injection

### Phase 4: Advanced Features
- Full-text search with SQLite FTS5
- Session similarity matching (vector embeddings)
- Automatic tagging with AI
- Multi-workspace support
- Analytics and insights

## Resources

- [Cursor Editor](https://cursor.sh/)
- [better-sqlite3 Docs](https://github.com/WiseLibs/better-sqlite3/wiki)
- [Vitest Docs](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Questions?

- Check [README.md](README.md) for usage
- Check [CURSOR-CROSS-SESSION-CONTEXT.md](CURSOR-CROSS-SESSION-CONTEXT.md) for technical details
- Open an issue on GitHub

