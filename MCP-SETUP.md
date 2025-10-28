# MCP Server Setup Guide

## What is MCP?

**Model Context Protocol (MCP)** is a standard that lets AI assistants call tools. The Cursor Context MCP server exposes your chat history as tools that the AI can invoke automatically.

## How It Works

```
You: "How did I implement authentication in that project?"

AI: *Recognizes you're asking about past work*
    *Calls MCP tool: search_sessions("authentication")*
    *Gets results from your chat history*
    
    "I found 3 past sessions about authentication..."
```

The AI decides when to search your past chats based on your conversation.

## Installation

### Step 1: Build the Project

```bash
cd /Users/macbook/play/chat-context-mcp
npm install
npm run build
```

This creates the MCP server executable at `dist/mcp-server/index.js`.

### Step 2: Configure Cursor

Cursor reads MCP server configuration from:
```
~/.cursor/mcp.json
```

**Create or edit this file** and add:

```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "node",
      "args": [
        "/Users/macbook/play/chat-context-mcp/dist/mcp-server/index.js"
      ],
      "env": {}
    }
  }
}
```

**Important**: Replace `/Users/macbook/play/chat-context-mcp` with your actual project path!

### Step 3: Restart Cursor

**Completely quit Cursor** (Cmd+Q on macOS, not just close the window) and reopen it for the MCP configuration to load.

### Step 4: Approve the MCP Server

When Cursor reopens, it should prompt you to **approve the "cursor-context" MCP server**. **You must click "Approve"** for the tools to be available.

If you don't see a prompt:
1. Open Cursor Settings (Cmd+, on macOS)
2. Search for "MCP" or "Model Context Protocol"
3. Find the "cursor-context" server in the list
4. Click "Approve" next to it

**Without approval, the MCP tools won't be available to the AI!**

### Step 5: Verify It's Working

In a new Cursor chat, try:

```
You: "List my recent chat sessions"
```

The AI should call the `list_sessions` tool and show you your past sessions!

## Available MCP Tools

The AI can use these tools automatically:

### 1. `list_sessions`
Lists past sessions with filters.

**When AI uses it:**
- "What have I been working on?"
- "Show me recent chats"
- "List my past sessions"

### 2. `search_sessions`
Searches past chats by content.

**When AI uses it:**
- "I remember discussing authentication..."
- "How did I implement X before?"
- "Find that conversation about Y"

### 3. `get_session`
Gets full details of a specific session.

**When AI uses it:**
- "Load my 'auth-design' session"
- "Show me that chat about database migrations"

### 4. `set_nickname`
Names a session for easy reference.

**When AI uses it:**
- "Call this session 'bug-fix-cors'"
- "Name this chat 'auth-implementation'"

### 5. `add_tag`
Tags sessions for organization.

**When AI uses it:**
- "Tag this as 'feature' and 'backend'"
- "Add 'bugfix' tag to this chat"

### 6. `list_tags`
Shows all available tags.

### 7. `list_projects`
Shows all projects with session counts.

## Example Conversations

### Search Past Work

```
You: "I think we discussed API rate limiting last week,
     can you find that conversation?"

AI: *Calls search_sessions("API rate limiting")*
    
    "I found a session from 5 days ago where you discussed 
     API rate limiting. Here's what you decided..."
```

### Reference Named Session

```
You: "Load the 'auth-implementation' session"

AI: *Calls get_session("auth-implementation")*
    
    "Here's your auth-implementation session:
     [Shows full conversation]"
```

### Organize Past Sessions

```
You: "Tag my 'auth-implementation' session as 'feature' and 'backend'"

AI: *Calls add_tag("auth-implementation", ["feature", "backend"])*
    
    "✓ Tagged session with 'feature' and 'backend'"
```

## Configuration Options

### Custom Database Paths

If your Cursor database is in a non-standard location, you can specify it:

```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "node",
      "args": [
        "/path/to/cursor-context-mcp/dist/mcp-server/index.js"
      ],
      "env": {
        "CURSOR_DB_PATH": "/custom/path/to/state.vscdb",
        "METADATA_DB_PATH": "/custom/path/to/metadata.db"
      }
    }
  }
}
```

### Using npm Global Install (Future)

After publishing to npm:

```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "cursor-context-mcp"
    }
  }
}
```

## Troubleshooting

### MCP Server Not Found

**Error**: "Failed to start MCP server"

**Solution**: Check that the path in `mcp.json` is correct:
```bash
ls /Users/macbook/play/chat-context-mcp/dist/mcp-server/index.js
```

### No Tools Available

**Symptom**: AI doesn't seem to know about the tools

**Solutions**:
1. **Approve the MCP server** in Cursor Settings → MCP
2. Restart Cursor completely (Cmd+Q)
3. Check MCP configuration path: `~/.cursor/mcp.json`
4. Verify JSON is valid (no syntax errors)

### Database Locked

**Error**: "Database is locked"

**Solution**: Cursor is writing to the database. Wait a moment and try again. The MCP server uses read-only access with retry logic.

### Session Not Found

**Error**: "Session not found"

**Solution**: Sync sessions first with the CLI:
```bash
cursor-context sync --limit 100
```

### Check MCP Server Logs

MCP server logs to stderr. You can test it manually:

```bash
node dist/mcp-server/index.js
```

It should output: `Cursor Context MCP Server started`

## Testing the MCP Server

### Manual Test

You can test the MCP server manually using the MCP Inspector:

```bash
npm install -g @modelcontextprotocol/inspector
mcp-inspector node dist/mcp-server/index.js
```

This opens a web UI where you can call tools directly.

### Test in Cursor

Try these prompts in a new chat:

1. **List sessions**: "Show me my recent chat sessions"
2. **Search**: "Find conversations about authentication"
3. **Show tags**: "What tags do I have?"
4. **Show projects**: "List my projects"
5. **Tag a session**: "Tag my 'auth-implementation' session as 'feature'"

## Advanced: Development Mode

For development, you can run the MCP server with tsx:

```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/cursor-context-mcp/src/mcp-server/index.ts"
      ]
    }
  }
}
```

This runs the TypeScript directly without building.

## Understanding AI Tool Invocation

### The AI Already Has Current Chat

The AI doesn't need MCP tools to reference the current conversation - it's already in the AI's context window!

**MCP tools are for searching OTHER/PAST sessions.**

### Tool Descriptions Guide the AI

Each tool has a detailed description that tells the AI when to use it. For example:

```
"Search across PAST/OTHER Cursor chat sessions (not current chat).
Use when user asks about previous work: 'I remember discussing...'"
```

The AI reads these descriptions and matches them to your question.

### Ambiguity Handling

If your question is ambiguous, the AI might:
1. Ask for clarification: "Are you asking about this chat or a previous one?"
2. Search proactively: "I searched past sessions and found..."
3. Check current chat first, then search if not found

This is documented in the tool descriptions!

## Next Steps

- **Try it out**: Start a new Cursor chat and ask about past work
- **Sync sessions**: Run `cursor-context sync` to index your chats
- **Add nicknames**: Name important sessions for easy reference
- **Tag chats**: Organize with tags like "feature", "bugfix", etc.

## See Also

- [README.md](README.md) - Main documentation
- [CLI.md](CLI.md) - CLI usage
- [MCP-VS-EXTENSION.md](docs/MCP-VS-EXTENSION.md) - MCP vs Extension comparison
- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP docs

