# Cursor Cross-Session Context Retrieval

> **Unlock the power of your Cursor chat history** – Search, organize, and retrieve context from past conversations to enhance your AI-assisted development workflow.

[![Tests](https://img.shields.io/badge/tests-169%20passing-brightgreen)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 The Problem

Every Cursor Composer session is isolated – when you start a new chat, the AI has no memory of your previous conversations. This leads to:

- ❌ Repeating context and explanations
- ❌ Lost architectural decisions and discussions
- ❌ Manual copy-pasting from old chats
- ❌ Difficulty finding specific conversations
- ❌ No organization or categorization of chat history

## ✨ The Solution

This library gives you **programmatic access to your entire Cursor chat history** with powerful organization and retrieval features:

- ✅ **Nickname sessions** – Give chats memorable names instead of UUIDs
- ✅ **Tag & organize** – Categorize sessions by feature, bug, topic, etc.
- ✅ **Project-scoped search** – Automatically filters chats by project
- ✅ **Full-text search** – Search across nicknames, tags, messages, and projects
- ✅ **Rich formatting** – Export sessions as Markdown, JSON, or compact previews
- ✅ **Type-safe API** – Fully typed TypeScript interface

## 🚀 Quick Start

### Installation

```bash
npm install cursor-context-core
```

### CLI Tool

The package includes a powerful command-line interface:

```bash
# Show statistics
cursor-context stats

# List sessions
cursor-context list --limit 10

# Search for sessions
cursor-context search "authentication"

# Get session details
cursor-context get my-nickname --format markdown

# Set nickname and tags
cursor-context nickname abc-123 my-important-chat
cursor-context tag add abc-123 feature backend
```

See [CLI.md](CLI.md) for complete CLI documentation.

### MCP Server

Let AI automatically search and retrieve past chat sessions:

**Setup:**
1. Build the project: `npm run build`
2. Configure Cursor (see [MCP-SETUP.md](MCP-SETUP.md))
3. Restart Cursor

**Usage in Chat:**
```
You: "How did I implement authentication in that project?"

AI: *Automatically calls search_sessions tool*
    "I found your session 'auth-implementation' from 5 days ago..."

You: "Load that session"

AI: *Calls get_session tool*
    [Shows full conversation]
```

The AI decides when to search based on your conversation. See [MCP-SETUP.md](MCP-SETUP.md) for setup instructions.

### Library Usage

```typescript
import { CursorContext } from 'cursor-context-core';

// Create API instance (auto-detects Cursor DB path)
const api = new CursorContext();

// Sync recent sessions
await api.syncSessions(50);

// Give a session a nickname
await api.setNickname('session-id', 'auth-implementation');
await api.addTag('session-id', 'feature');

// Retrieve by nickname
const session = await api.getSession('auth-implementation');
console.log(session.messages);

// Search across all sessions
const results = await api.searchSessions({ 
  query: 'authentication',
  projectPath: '/path/to/project'
});

// Clean up
api.close();
```

## 📚 Core Features

### 1. Session Management

```typescript
// List sessions with filtering
const sessions = await api.listSessions({
  projectPath: '/path/to/project',  // Filter by project
  sortBy: 'newest',                 // newest, oldest, most_messages
  limit: 10,                        // Limit results
  tag: 'feature',                   // Filter by tag
  taggedOnly: true                  // Only tagged sessions
});

// Get a specific session
const session = await api.getSession('nickname-or-id', {
  includeMessages: true,           // Load full messages
  parseOptions: {
    excludeTools: false,           // Include tool calls
    maxContentLength: 10000        // Truncate long messages
  }
});
```

### 2. Organization

```typescript
// Set nicknames
await api.setNickname('session-id', 'database-migration');

// Add tags
await api.addTag('session-id', 'backend');
await api.addTag('session-id', 'database');

// Remove tags
await api.removeTag('session-id', 'backend');

// List all tags
const tags = api.getTags();
// [{ tag: 'backend', count: 15 }, { tag: 'frontend', count: 8 }, ...]
```

### 3. Search

```typescript
// Simple search
const results = await api.searchSessions({ 
  query: 'authentication' 
});

// Advanced search
const results = await api.searchSessions({
  query: 'API endpoints',
  projectPath: '/my/project',      // Scope to project
  taggedOnly: true,                // Only tagged sessions
  limit: 20,                       // Limit results
  caseSensitive: false             // Case sensitivity
});
```

### 4. Project Management

```typescript
// List all projects
const projects = api.getProjects();
// [
//   { path: '/path/to/project', name: 'my-app', session_count: 42 },
//   ...
// ]

// Get sessions for a specific project
const projectSessions = await api.listSessions({
  projectPath: '/path/to/project'
});
```

### 5. Formatting

```typescript
import { 
  formatSessionMarkdown, 
  formatSessionJSON,
  formatSessionPreview,
  formatSessionList
} from 'cursor-context-core';

// Markdown format (great for AI context)
const markdown = formatSessionMarkdown(session, {
  maxMessages: 10,          // Limit messages
  includeTools: true,       // Include tool calls
  includeMetadata: true     // Include header
});

// JSON format
const json = formatSessionJSON(session);

// Compact preview
const preview = formatSessionPreview(session.metadata);
// "📝 auth-implementation • 📁 my-app • 💬 42 • 📅 2 days ago"

// List of sessions
const list = formatSessionList(sessions);
```

### 6. Statistics

```typescript
const stats = api.getStats();
console.log(stats);
// {
//   totalSessionsInCursor: 560,
//   totalSessionsWithMetadata: 50,
//   sessionsWithNicknames: 12,
//   sessionsWithTags: 25,
//   sessionsWithProjects: 35,
//   totalTags: 15,
//   totalProjects: 8
// }
```

## 🏗️ Architecture

### Core Modules

```
src/core/
├── api.ts              # Main CursorContext API
├── cursor-db.ts        # Read-only access to Cursor's SQLite DB
├── metadata-db.ts      # Separate DB for nicknames/tags
├── message-parser.ts   # Parse Lexical richText format
├── workspace-extractor.ts  # Extract project paths from tool results
├── formatter.ts        # Format sessions for output
├── platform.ts         # Platform detection (macOS/Linux/Windows)
├── errors.ts          # Custom error types
└── types.ts           # TypeScript interfaces
```

### How It Works

1. **Read-only Access** – Safely reads Cursor's internal SQLite database
2. **Separate Metadata** – Stores your nicknames/tags in `~/.cursor-context/metadata.db`
3. **Auto-sync** – Automatically syncs sessions on first access
4. **Project Detection** – Extracts workspace paths from tool results in messages
5. **Smart Parsing** – Handles Cursor's complex Lexical richText format

## 📖 Advanced Usage

### Custom Database Paths

```typescript
const api = new CursorContext(
  '/custom/path/to/cursor.db',
  '/custom/path/to/metadata.db',
  true  // Enable auto-sync
);
```

### Direct Database Access

```typescript
// Access underlying databases for advanced operations
const cursorDB = api.getCursorDB();
const metadataDB = api.getMetadataDB();

// List all composer IDs
const allIds = cursorDB.listComposerIds(1000);

// Get raw composer data
const composerData = cursorDB.getComposerData('session-id');
```

### Batch Operations

```typescript
// Sync many sessions
const synced = await api.syncSessions(100);
console.log(`Synced ${synced} new sessions`);

// Bulk tagging
const sessions = await api.listSessions({ limit: 50 });
for (const session of sessions) {
  if (session.has_project) {
    await api.addTag(session.session_id, `project:${session.project_name}`);
  }
}
```

## 🧪 Testing

The library includes 169 comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suite
npm test tests/core/api.test.ts

# Watch mode
npm run test:watch

# Build
npm run build
```

Test coverage includes:
- ✅ Unit tests for each module
- ✅ Integration tests for the API
- ✅ End-to-end workflow tests
- ✅ Error handling and edge cases

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run examples
npm run dev examples/test-api.ts

# Run tests
npm test
```

## 📋 Database Schema

### Cursor's Database (`state.vscdb`)

```sql
-- Key-value store
cursorDiskKV (
  key TEXT PRIMARY KEY,     -- e.g., "composerData:{uuid}"
  value TEXT                -- JSON data
)
```

### Metadata Database (`~/.cursor-context/metadata.db`)

```sql
session_metadata (
  session_id TEXT PRIMARY KEY,
  nickname TEXT UNIQUE,
  tags TEXT,                    -- Comma-separated
  project_path TEXT,
  project_name TEXT,
  has_project INTEGER,
  created_at INTEGER,
  last_accessed INTEGER,
  first_message_preview TEXT,
  message_count INTEGER
)
```

## 🔒 Security & Privacy

- ✅ **Read-only** access to Cursor's database
- ✅ **Local-only** – No data sent to external servers
- ✅ **Separate metadata** – Your organization data is stored separately
- ✅ **Retry logic** – Handles database locks gracefully
- ✅ **No modifications** – Never writes to Cursor's internal database

## 🎯 Use Cases

### 1. MCP Server (Recommended)
Integrate with Cursor's Model Context Protocol to let AI automatically fetch context:

```typescript
// MCP tool: list_sessions
const sessions = await api.listSessions({ limit: 10 });

// MCP tool: fetch_session_by_nickname
const session = await api.getSession('auth-implementation');
return formatSessionMarkdown(session);
```

### 2. CLI Tool
Build a command-line interface:

```bash
cursor-context list --project /path/to/project
cursor-context get auth-implementation --format markdown
cursor-context search "authentication" --limit 5
cursor-context tag session-id feature backend
```

### 3. VS Code Extension
Create a sidebar that shows session history with search and filters.

### 4. Custom Integrations
- Export sessions to Notion/Obsidian
- Generate documentation from chat history
- Analyze development patterns
- Create knowledge bases

## 🗺️ Roadmap

### Phase 1: Core Library ✅ (Complete!)
- ✅ Database access
- ✅ Message parsing
- ✅ Metadata management
- ✅ Full API with search, tagging, formatting
- ✅ 169 comprehensive tests

### Phase 2: CLI Tool ✅ (Complete!)
- ✅ List, get, search commands
- ✅ Nickname and tag management
- ✅ Stats and projects views
- ✅ Configuration management
- ✅ Multiple output formats (table, json, markdown, compact)
- ✅ Color support
- [ ] Interactive TUI mode (future)
- [ ] Shell completion (future)

### Phase 3: MCP Server ✅ (Complete!)
- ✅ MCP protocol implementation
- ✅ 9 tool definitions with clear descriptions
- ✅ AI-invoked session search and retrieval
- ✅ Session management (tag, nickname)
- ✅ Universal (works in Cursor, VSCode, Claude Desktop)
- ✅ Stdio-based communication
- ✅ Integration with core library

### Phase 4: VSCode/Cursor Extension (Future)
- [ ] Slash commands (`/chat`, `/chat search`, etc.)
- [ ] Session browser UI (sidebar panel)
- [ ] Quick pick menus for explicit control
- [ ] Status bar integration
- [ ] Right-click context menus
- [ ] User-invoked actions (vs AI-invoked in MCP)

### Phase 5: Advanced Features
- [ ] Full-text search with SQLite FTS5
- [ ] Session similarity matching (vector embeddings)
- [ ] Automatic tagging with AI
- [ ] Multi-workspace support
- [ ] Session analytics and insights

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [Cursor](https://cursor.sh/) AI code editor
- Uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for database access
- Tested with [Vitest](https://vitest.dev/)

---

**Made with ❤️ for developers who want to unlock their Cursor chat history**

For detailed technical documentation, see [CURSOR-CROSS-SESSION-CONTEXT.md](CURSOR-CROSS-SESSION-CONTEXT.md)
