# Cursor Cross-Session Context Retrieval

## The Problem

When working in Cursor AI, you often have multiple chat sessions for different features, bugs, or parts of your project. But **conversations are isolated** - you can't reference or pull in context from other sessions.

### Common Frustrations

- "We discussed the authentication flow in another chat, but I can't remember the details"
- "I need to reference that database schema we designed yesterday"
- "What was the solution to that bug we fixed in a different session?"
- Currently you have to: manually find the old session, scroll through hundreds of messages, copy/paste relevant parts

### What If You Could Just Ask?

```
You: "Pull in the context from when we worked on the authentication system"

AI: [Fetches session, reads the conversation, now has full context]
    "Based on our previous discussion about authentication (Session ID: abc123), 
     we decided to use JWT tokens with refresh tokens stored in httpOnly cookies..."
```

## The Solution

**A tool/MCP server that reads Cursor's conversation database, allows you to nickname and organize sessions, and injects context from other sessions into your current chat.**

### Key Features

1. **Session Nicknames** - Tag sessions with memorable names ("auth-design", "payment-bug-fix")
2. **Project-Scoped Search** - Automatically limit searches to current project
3. **Quick Reference** - Load any tagged session instantly by nickname
4. **Cross-Session Context** - Pull in full conversation history from previous chats
5. **Smart Discovery** - List and search sessions with previews

## How It Works

### The Discovery

Cursor stores all conversations locally in a SQLite database:
```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
```

This database contains:
- All your composer sessions (conversations)
- Every message (user + assistant)
- Full text content in parseable format

Since we can **read this database**, we can:
1. List all available sessions
2. Search sessions by content
3. Extract specific conversations
4. Format them as context
5. Inject into current session

### Two Implementation Approaches

## Approach 1: MCP Server (Recommended)

**Model Context Protocol (MCP)** is a standard that lets AI assistants call tools. Cursor supports MCP natively.

### Key Understanding: AI-Invoked Tools

**Important**: MCP tools are **invoked by the AI**, not directly by the user. The AI in your current chat session decides when to call these tools based on your conversation.

- The AI already has the **current chat in its context window**
- These tools search **PAST/OTHER sessions** (not the current conversation)
- Tool descriptions explicitly tell the AI when to invoke them
- The AI pattern-matches your questions to tool capabilities

Example flow:
```
User: "How did I implement authentication in that other project?"
AI: *Recognizes request for PAST work*
    *Sees tool: search_sessions - "Use for past conversations"*
    *Calls: search_sessions({ query: "authentication" })*
    *Returns: "I found 3 past sessions about auth..."*
```

### How It Would Work

```typescript
// MCP Tool Definition
{
  "tools": [
    {
      "name": "list_sessions",
      "description": "List PAST Cursor chat sessions (not the current conversation). Use when user asks 'what have I been working on?' or wants to see recent previous sessions.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "Number of sessions to list (default: 20)"
          },
          "project": {
            "type": "string",
            "description": "Filter by project: 'current' (default), 'all', or project path"
          },
          "tagged_only": {
            "type": "boolean",
            "description": "Show only sessions with nicknames (default: false)"
          }
        }
      }
    },
    {
      "name": "fetch_session_by_nickname",
      "description": "Load context from a PREVIOUS session by its nickname. Use when user references a named past session. The current chat is already in your context.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "description": "Session nickname (e.g., 'auth-design')"
          },
          "message_limit": {
            "type": "number",
            "description": "Max messages to return (default: 50)"
          }
        },
        "required": ["nickname"]
      }
    },
    {
      "name": "fetch_session_by_id",
      "description": "Fetch context from a PAST Cursor conversation by UUID. Use when user provides a specific session ID from another conversation.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "session_id": {
            "type": "string",
            "description": "Composer session ID (UUID)"
          },
          "message_limit": {
            "type": "number",
            "description": "Max messages to return (default: 50)"
          }
        },
        "required": ["session_id"]
      }
    },
    {
      "name": "search_sessions",
      "description": "Search across PAST/OTHER sessions (not current chat). Use when user asks about previous work: 'I remember discussing...', 'how did I implement...', 'we talked about... before'.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search term"
          },
          "project": {
            "type": "string",
            "description": "Filter by project: 'current' (default), 'all', or project path"
          },
          "context_window": {
            "type": "number",
            "description": "Messages before/after match to include (default: 5)"
          }
        },
        "required": ["query"]
      }
    },
    {
      "name": "tag_current_session",
      "description": "Add a nickname and/or tags to the current chat session",
      "inputSchema": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "description": "Memorable nickname for this session"
          },
          "tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Optional tags for categorization"
          }
        }
      }
    },
    {
      "name": "find_sessions_by_tag",
      "description": "Find all sessions with a specific tag",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tag": {
            "type": "string",
            "description": "Tag to search for"
          }
        },
        "required": ["tag"]
      }
    }
  ]
}
```

### Usage in Chat

**Scenario 1: Tag Current Session**
```
You: "Tag this session as 'auth-design'"

[Cursor calls: tag_current_session(nickname="auth-design", tags=["authentication", "api"])]

AI: "Tagged this session as 'auth-design' with tags: authentication, api"
```

**Scenario 2: Load by Nickname**
```
You: "Load context from auth-design"

[Cursor calls: fetch_session_by_nickname(nickname="auth-design")]
[Returns full conversation from that session]

AI: "Loaded 'auth-design' session. In that conversation, you were working on 
     JWT authentication and decided to use refresh tokens in httpOnly cookies..."
```

**Scenario 3: Search Within Current Project**
```
You: "Find sessions where we discussed database migrations"

[Cursor calls: search_sessions(query="database migrations", project="current")]
[Returns matching sessions from current project only]

AI: "Found 2 sessions in this project:
     1. 'db-schema-v2' - Discussed Prisma migrations (3 days ago)
     2. (no nickname) - Bug fix for migration rollback (last week)
     
     Which would you like me to load?"
```

**Scenario 4: Browse Recent Work**
```
You: "What did I work on yesterday?"

[Cursor calls: list_sessions(limit=10, project="current")]

AI: "Here are your recent sessions from this project:
     1. 'auth-design' - JWT authentication (50 messages, 1 day ago)
     2. 'payment-bug-fix' - Stripe webhook issue (12 messages, 1 day ago)
     3. 'db-schema-v2' - Database redesign (80 messages, 3 days ago)
     
     Which one would you like to reference?"
```

**Scenario 5: Cross-Project Reference**
```
You: "How did we handle authentication in my other project?"

[Cursor calls: search_sessions(query="authentication", project="all")]

AI: "Found authentication discussions across 3 projects:
     - Current project: 'auth-design' session
     - my-api-project: 'oauth-setup' session
     - mobile-app: 'biometric-auth' session
     
     Would you like me to load any of these?"
```

### MCP Server Architecture

```
┌─────────────────────┐
│  Cursor AI Session  │
│   (Current Chat)    │
└──────────┬──────────┘
           │ MCP Protocol
           ▼
┌─────────────────────┐
│   MCP Server        │
│  (Node.js/Python)   │
│                     │
│  - fetch_session    │
│  - list_sessions    │
│  - search_messages  │
└──────────┬──────────┘
           │ SQLite
           ▼
┌─────────────────────┐
│   Cursor Database   │
│   state.vscdb       │
│                     │
│  - composerData:*   │
│  - bubbleId:*       │
└─────────────────────┘
```

### Benefits
- ✅ **Native integration** - Works seamlessly in Cursor
- ✅ **Tool use** - AI can call it automatically when needed
- ✅ **No manual steps** - Just ask in natural language
- ✅ **Intelligent** - AI decides when to fetch context

### Drawbacks
- ⚠️ Requires MCP server setup
- ⚠️ More complex implementation

## Approach 2: CLI Tool + Manual Copy/Paste

A simpler command-line tool that outputs formatted context.

### How It Would Work

```bash
# List sessions
cursor-context list

# Fetch specific session
cursor-context fetch abc123-def456

# Search across sessions
cursor-context search "authentication flow"

# Get session by date
cursor-context recent --days 2
```

**Output Example:**
```
$ cursor-context fetch abc123-def456 --limit 20

═══════════════════════════════════════════════
Session: API Authentication Design
Date: Oct 24, 2025
Messages: 20 / 150 (showing most recent)
═══════════════════════════════════════════════

[USER] How should we handle JWT refresh tokens?

[ASSISTANT] For refresh tokens, we should:
1. Store them in httpOnly cookies (prevents XSS)
2. Set a 7-day expiration
3. Implement token rotation on each refresh
...

[USER] What about the database schema?

[ASSISTANT] Here's the schema we designed:
- users table: id, email, password_hash
- sessions table: user_id, refresh_token_hash, expires_at
...

═══════════════════════════════════════════════
```

Then you copy this output and paste into your current Cursor chat.

### Benefits
- ✅ **Simple to build** - Just a Python/Node script
- ✅ **No setup required** - Runs standalone
- ✅ **Full control** - You decide what to paste

### Drawbacks
- ⚠️ Manual copy/paste required
- ⚠️ Not integrated into Cursor's workflow
- ⚠️ AI doesn't know when to fetch context

## Technical Implementation

### Metadata Management

To enable nicknames and tagging, we need a separate metadata store (don't modify Cursor's database):

**Storage: Separate SQLite Database**
```
~/.cursor-context/metadata.db
```

**Why Separate Database?**
- ✅ Safe - doesn't risk corrupting Cursor's data
- ✅ Persistent - survives Cursor updates
- ✅ Fast - indexed lookups for nicknames
- ✅ Portable - can backup/sync independently

**Syncing Strategy:**
1. When fetching a session, check if metadata exists
2. If not, auto-populate: project path, first message, timestamp
3. User can add nickname/tags at any time
4. Metadata updates don't touch Cursor DB

### Project/Workspace Detection ⭐

**Good News:** Sessions CAN be categorized by project!

**Discovery:** While `composerData` doesn't store workspace paths directly, they can be reliably extracted from tool results in bubble (message) data.

**How It Works:**
```typescript
function extractWorkspacePath(composerId: string): string | null {
  // Get all bubbles (messages) for this session
  const bubbles = getBubbles(composerId);
  
  // Find first bubble with tool results
  for (const bubble of bubbles) {
    if (bubble.toolFormerData?.result) {
      const result = JSON.parse(bubble.toolFormerData.result);
      
      // Tool results contain workspaceResults with absolute paths
      if (result.success?.workspaceResults) {
        const workspacePaths = Object.keys(result.success.workspaceResults);
        return workspacePaths[0]; // e.g., "/Users/you/projects/my-app"
      }
    }
  }
  
  return null; // No project (general conversation)
}
```

**Example Tool Result:**
```json
{
  "toolFormerData": {
    "name": "grep",
    "result": "{
      \"success\": {
        \"workspaceResults\": {
          \"/Users/macbook/play/my-project\": {
            \"content\": {...}
          }
        }
      }
    }"
  }
}
```

**Implications:**
- ✅ **Project-scoped search is totally feasible!**
- ✅ Dramatically reduces search space (100+ sessions → 10-20 per project)
- ✅ Can detect project name from path (`my-project` from `/Users/you/my-project`)
- ⚠️ Sessions without tool calls won't have project info (mark as "General")
- ⚠️ Extract on first access, cache in metadata DB

**Updated Metadata Schema:**
```sql
CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,
  nickname TEXT UNIQUE,
  tags TEXT,
  project_path TEXT,      -- ← Extracted from tool results!
  project_name TEXT,      -- ← Last folder name
  has_project BOOLEAN,    -- ← FALSE for general chats
  created_at INTEGER,
  last_accessed INTEGER,
  first_message_preview TEXT,
  message_count INTEGER
);

CREATE INDEX idx_project_path ON session_metadata(project_path);
```

### Database Schema (Discovered)

**Table: `cursorDiskKV`**

Keys:
```
composerData:{uuid}          → Session metadata
bubbleId:{composer}:{bubble} → Individual messages
```

**Composer Data Structure:**
```json
{
  "composerId": "abc123-def456-...",
  "fullConversationHeadersOnly": [
    {"bubbleId": "msg1", "type": 1},  // type 1 = user
    {"bubbleId": "msg2", "type": 2}   // type 2 = assistant
  ]
}
```

**Bubble Data Structure:**
```json
// User message (type 1)
{
  "type": 1,
  "bubbleId": "msg1",
  "richText": "{\"root\":{\"children\":[...]}}"
}

// Assistant message (type 2)
{
  "type": 2,
  "bubbleId": "msg2",
  "text": "Here's my response..."
}
```

### Core Functions Needed

```python
def connect_to_cursor_db():
    """Connect to Cursor's SQLite database"""
    return sqlite3.connect(CURSOR_DB_PATH)

def list_sessions(limit=20):
    """List recent composer sessions with previews"""
    # Query: SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'
    pass

def get_session_messages(composer_id, limit=None):
    """Extract all messages from a session"""
    # 1. Get composer data to find bubbleIds
    # 2. For each bubble, fetch bubble data
    # 3. Parse based on type (1=user, 2=assistant)
    # 4. Return list of {role, content, timestamp}
    pass

def search_across_sessions(query):
    """Full-text search across all messages"""
    # 1. Get all sessions
    # 2. For each session, search message content
    # 3. Return matches with context
    pass

def format_session_context(messages, format="markdown"):
    """Format messages for injection into chat"""
    # Options: markdown, json, plain text
    pass
```

### MCP Server Implementation

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import Database from 'better-sqlite3';

const CURSOR_DB = `${process.env.HOME}/Library/Application Support/Cursor/User/globalStorage/state.vscdb`;

class CursorContextServer {
  private db: Database.Database;
  
  constructor() {
    this.db = new Database(CURSOR_DB, { readonly: true });
  }
  
  async listSessions(limit = 20) {
    const stmt = this.db.prepare(`
      SELECT key, value 
      FROM cursorDiskKV 
      WHERE key LIKE 'composerData:%'
      ORDER BY key DESC 
      LIMIT ?
    `);
    // Parse and return sessions
  }
  
  async fetchSession(sessionId: string) {
    // Implementation similar to cursor-to-claude-converter.py
  }
  
  async searchMessages(query: string) {
    // Full-text search implementation
  }
}

// MCP Server setup
const server = new Server({
  name: "cursor-context",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fetch_session_context",
      description: "Fetch context from another Cursor conversation",
      inputSchema: { /* ... */ }
    },
    // ... other tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Handle tool calls
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Use Cases

### 1. Feature Development
```
You: "Pull in the context from when we designed the user profile system"
→ Loads that conversation
→ Continue building on those decisions
```

### 2. Bug Fixing
```
You: "What was the solution to the CORS issue we fixed last week?"
→ Searches for "CORS" in recent sessions
→ Finds and loads relevant discussion
```

### 3. Code Review
```
You: "Why did we implement it this way? Check the session about architecture"
→ Loads architecture discussion
→ Provides context for current code review
```

### 4. Team Handoffs
```
You: "Load the session about the payment integration for my teammate"
→ Export session to markdown
→ Share with team member
→ They have full context
```

### 5. Documentation
```
You: "Generate docs based on our API design discussion"
→ Loads session about API design
→ Creates documentation from decisions made
```

## Project Structure

```
cursor-context-retrieval/
├── README.md
├── TECHNICAL.md                 # This file (more detailed)
├── package.json                 # or requirements.txt
├── src/
│   ├── core/                   # ← Shared library (build this first!)
│   │   ├── cursor-db.ts        # Cursor DB access (read-only)
│   │   ├── metadata-db.ts      # Nickname/tag metadata storage
│   │   ├── message-parser.ts   # Parse richText and plain messages
│   │   ├── search.ts           # Search with project scoping
│   │   ├── formatter.ts        # Format output (markdown, JSON)
│   │   └── platform.ts         # Cross-platform DB path detection
│   ├── cli/                    # ← Build second (validates core)
│   │   ├── index.ts            # CLI entry point
│   │   └── commands/
│   │       ├── list.ts         # List sessions (with project filter)
│   │       ├── fetch.ts        # Fetch by ID or nickname
│   │       ├── search.ts       # Search sessions
│   │       ├── tag.ts          # Tag/nickname management
│   │       └── export.ts       # Export to markdown/JSON
│   └── mcp-server/             # ← Build third (wraps core)
│       ├── server.ts           # MCP server implementation
│       ├── tools.ts            # Tool definitions
│       └── handlers.ts         # Tool request handlers
├── examples/
│   └── mcp-config.json         # Example MCP configuration for Cursor
├── tests/
│   ├── core/
│   ├── cli/
│   └── mcp/
└── .cursor-context/            # Created at runtime
    └── metadata.db             # User's session metadata (gitignored)
```

**Build Order:**
1. **Core library** - Database access, parsing, search (fully testable)
2. **CLI tool** - Validates core logic, easier to debug
3. **MCP server** - Thin wrapper around validated core

## Roadmap

### Phase 1: Core Functionality
- [x] Discover Cursor's database structure
- [x] **Confirmed:** Project paths can be extracted from tool results in bubbles ✅
- [ ] Implement workspace path extraction from tool results
- [ ] Build session extraction logic
- [ ] Implement message parsing (handle richText format)
- [ ] Create formatting utilities
- [ ] Set up metadata database for nicknames/tags

### Phase 2: CLI Tool (Build First)
- [ ] List sessions command (with project filter)
- [ ] Fetch session by ID command
- [ ] Search across sessions (project-scoped)
- [ ] Tag/nickname management commands
- [ ] Pretty formatting for output
- [ ] Export to markdown/JSON

**Rationale:** CLI validates core DB logic before MCP complexity

### Phase 3: MCP Server
- [ ] Implement MCP protocol wrapper around CLI core
- [ ] Tool: list_sessions (with project/nickname filters)
- [ ] Tool: fetch_session_by_nickname
- [ ] Tool: fetch_session_by_id
- [ ] Tool: search_sessions (project-scoped)
- [ ] Tool: find_sessions_by_tag
- [ ] Register tools with Cursor
- [ ] Test tool calling workflows
- [ ] Handle errors gracefully (DB locks, missing sessions, etc.)

### Phase 4: Advanced Features
- [ ] Auto-suggest nicknames based on first message
- [ ] Smart context windowing (relevant message excerpts)
- [ ] Session summarization for long conversations
- [ ] Semantic search (embeddings)
- [ ] Auto-suggest relevant sessions based on current context
- [ ] Export to various formats (HTML, PDF)
- [ ] Cross-project session discovery
- [ ] Tag autocomplete/suggestions
- [ ] Session analytics (most referenced, longest, etc.)

### Phase 5: Polish & Robustness
- [ ] Platform support: Windows, Linux path detection
- [ ] Database version detection (handle Cursor updates)
- [ ] Comprehensive error handling (DB locks, parsing failures)
- [ ] Performance: Search indexing, caching strategy
- [ ] Rich text parser (handle all Lexical node types)
- [ ] Documentation
- [ ] Tests (unit + integration)
- [ ] Publish as package

## Why This Is Valuable

### For Individual Developers
- **No more context loss** between sessions
- **Faster problem solving** - reference previous solutions
- **Better continuity** - pick up where you left off days ago

### For Teams
- **Knowledge sharing** - export sessions for teammates
- **Onboarding** - new devs can read decision history
- **Documentation** - sessions become living documentation

### For Projects
- **Decision tracking** - why was X built this way?
- **Pattern reuse** - find similar problems solved before
- **Consistency** - ensure new code follows established patterns

## Competition/Alternatives

**Current Solutions:**
- Manually scroll through old sessions (tedious)
- Take notes in separate docs (extra work)
- Try to remember (unreliable)
- Start fresh every time (wasteful)

**This Tool:**
- Automatic context retrieval
- No extra work required
- Native Cursor integration
- Cross-session memory

## Technical Challenges & Solutions

### 1. Database Format Changes ⚠️ HIGH RISK
**Risk:** Cursor might update their schema without notice
**Mitigations:**
- Detect database schema version on startup
- Document tested Cursor version (store in metadata)
- Graceful degradation with clear error messages
- Version-specific parsers if schema changes
- Monitor Cursor updates and test against beta releases
- Consider reaching out to Cursor team about stable export API

### 2. Database Locking / Concurrent Access
**Risk:** Cursor is actively writing to the database
**Solutions:**
- Open with `readonly: true` flag
- Check for WAL (Write-Ahead Logging) mode
- Implement retry logic for SQLITE_BUSY errors
- Set explicit timeout (5-10 seconds)
- Warn if Cursor might have exclusive lock

### 3. Performance & Search Strategy
**Challenge:** Database is 3GB+ with thousands of sessions
**Solutions:**
- ✅ **Project-scoped search by default** (dramatically reduces search space)
- Build separate FTS (Full-Text Search) index in metadata DB
- Cache parsed sessions for frequently accessed ones
- Implement pagination/streaming for large result sets
- Limit search to recent N sessions by default
- Background indexing on first run

### 4. Rich Text Parsing Complexity
**Challenge:** User messages use Lexical editor format (deeply nested JSON)
**Considerations:**
- Multiple node types: text, code blocks, links, mentions, file references
- Formatting metadata (bold, italic, etc.)
- Embedded images/files
- Need robust parser that handles all variants
**Solution:** Start with simple text extraction, enhance iteratively

### 5. Context Size Management
**Challenge:** Long sessions (150+ messages) = 50K+ tokens
**Solutions:**
- Intelligent context windowing (messages around search matches)
- Progressive loading ("show first 10, want more?")
- Summarization option for very long sessions
- Skip tool outputs and focus on key exchanges
- Let user specify message range

### 6. Privacy/Security
- Database contains sensitive conversations
- MCP server has read access to all chat history
- Metadata DB stores project paths
**Mitigations:**
- Read-only access to Cursor DB
- Metadata stays local (never uploaded)
- Clear documentation about data access
- Optional: encryption for metadata DB

### 7. Platform Support
**Current:** macOS only in examples
**Need:**
```typescript
function getCursorDBPath() {
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library/Application Support/Cursor/User/globalStorage/state.vscdb');
    case 'win32':
      return path.join(home, 'AppData/Roaming/Cursor/User/globalStorage/state.vscdb');
    case 'linux':
      return path.join(home, '.config/Cursor/User/globalStorage/state.vscdb');
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
```

### 8. Session Discovery UX
**Challenge:** How do users remember session IDs?
**Solution:** ✅ **Nickname system solves this!**
- Tag sessions as you work: "auth-design", "bug-fix-cors"
- List shows nicknames + first message preview
- Search by nickname, tag, or content
- Auto-suggest nicknames from first user message

### 9. AI Tool Invocation Ambiguity
**Challenge:** How does AI know when to search past sessions vs use current chat context?
**Solution:**
- AI already has current chat in its context window - no tool needed for that
- Tool descriptions explicitly state: "Search PAST/OTHER sessions (not current chat)"
- Use trigger phrases: "I remember...", "we discussed before...", "in another chat..."
- If ambiguous, AI can ask: "Are you asking about this chat or a previous one?"
- Calling the tool "too much" is fine - searching is fast (milliseconds) and helpful

**Trade-off**: Slight ambiguity for convenience. Alternative is explicit user-invoked commands (see Approach 2).

## Approach 2: VSCode/Cursor Extension (User-Invoked)

For users who prefer **explicit control** over when to search past sessions, a VSCode/Cursor extension provides:

### Slash Commands & UI

```typescript
// User explicitly invokes commands
/chat                      → Opens session browser UI
/chat search <query>       → Searches past sessions
/chat recent               → Lists recent sessions
/chat load <nickname>      → Loads session into current chat
/chat nickname <id> <name> → Sets nickname
/chat tag <id> <tags>      → Adds tags
```

### Features
- ✅ **No ambiguity** - User explicitly triggers actions
- ✅ **Rich UI** - Quick pick menus, dropdowns, sidebar panels
- ✅ **Status bar** - Show current session info
- ✅ **Context menus** - Right-click to tag/nickname
- ✅ **Keybindings** - Shortcuts for common actions

### Trade-offs
- ❌ **Not universal** - Separate extension for Cursor vs VSCode
- ❌ **Less proactive** - AI can't automatically help
- ❌ **More complex** - Different codebase than MCP

### Implementation Plan
Both MCP and Extension use the **same core library** (Phase 1). They're parallel interfaces:

```
Core Library (Phase 1) ✅
    ↓
    ├─→ CLI (Phase 2) ✅
    ├─→ MCP Server (Phase 3) ← AI-invoked, universal
    └─→ Extension (Phase 4) ← User-invoked, rich UI
```

## Future Vision

**With MCP + Extension:**
- **AI automatically** fetches context when it detects relevance
- **User can explicitly** search with `/chat` when they want control
- Best of both worlds: proactive AI + user control

**Imagine:**
- AI: "Based on our previous discussion about auth..." (automatic)
- User: `/chat load auth-design` (explicit)
- Semantic search: "Find sessions about authentication"
- Time-based: "What did I work on last Tuesday?"
- Cross-project: "How did we solve this in Project A?"

**The ultimate goal:** Make Cursor conversations truly searchable, referenceable, and reusable. Turn isolated chats into an interconnected knowledge base.

---

## Get Started

This project deserves its own repository because:
1. ✅ **Standalone utility** - Works independently
2. ✅ **Broad applicability** - Useful for all Cursor users
3. ✅ **Clear scope** - Well-defined problem and solution
4. ✅ **Extensible** - Many possible enhancements
5. ✅ **Open-sourceable** - Others would find this valuable

**Next Steps:**
1. Create new repo: `cursor-context-retrieval`
2. Start with CLI tool (simpler, faster to build)
3. Test and iterate
4. Build MCP server once CLI is solid
5. Share with community

This could genuinely become a popular tool in the Cursor ecosystem!

