# Cursor Context MCP Server - AI Instructions

## Purpose
This MCP server provides access to the user's **PAST/SAVED Cursor chat sessions** stored in their local database. It does NOT provide information about the current chat or project code.

## When to Use These Tools

### ✅ USE MCP TOOLS When User Asks About:
- **Past chat sessions**: "Show my past chats", "List my previous conversations"
- **Searching old sessions**: "Find a conversation where we discussed [X]", "I remember talking about [Y]"
- **Session management**: "What tags do I have?", "Show my chat history", "What projects have I chatted about?"
- **Loading specific sessions**: "Load my 'auth-design' session", "Show me session [ID]"

### ❌ DO NOT Use MCP Tools For:
- Understanding the current conversation (the AI already has this in context)
- Explaining project code or architecture (use codebase tools instead)
- Reading files in the current project (use file reading tools instead)
- Questions about "how this project works" (the user is asking about code, not past chats)

## Clear Trigger Examples

**User says**: "Show my past chat sessions"  
**Action**: ✅ Call `list_sessions` MCP tool

**User says**: "Find a conversation where we discussed authentication"  
**Action**: ✅ Call `search_sessions` with query="authentication"

**User says**: "List my recent chat sessions"  
**Action**: ⚠️ AMBIGUOUS - but likely means PAST sessions, so call `list_sessions`

**User says**: "How does this authentication system work?"  
**Action**: ❌ DO NOT call MCP tools - read the project code instead

**User says**: "I remember discussing database migrations last week, find that chat"  
**Action**: ✅ Call `search_sessions` with query="database migrations"

## Available MCP Tools

1. **list_sessions** - Lists past chat sessions with filtering options
2. **search_sessions** - Searches past chats by content/topic
3. **get_session** - Retrieves full conversation of a specific past session
4. **set_nickname** - Assigns a memorable name to a session
5. **add_tag** - Tags a session for organization
6. **remove_tag** - Removes tags from a session
7. **list_tags** - Shows all available tags
8. **list_projects** - Shows all projects with saved sessions
9. **get_current_session_id** - Placeholder for future extension

## Important Notes

- The current chat is ALREADY in your context - you don't need tools to reference it
- These tools search the user's **saved chat history database**, not the codebase
- If ambiguous, ask the user: "Are you asking about this current chat, or do you want me to search your past chat sessions?"
- When in doubt about whether to use MCP tools, prefer NOT using them unless the user explicitly mentions "past", "previous", "find", or "search" in relation to chats/sessions

