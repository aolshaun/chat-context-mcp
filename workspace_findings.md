# Workspace/Project Information in Cursor Database

## Investigation Date
October 26, 2025

## Key Findings

### ✅ **YES - Sessions CAN be categorized by project!**

However, it's **not stored directly** in the `composerData` table. The workspace path must be **extracted** from bubble (message) data.

## Where to Find Workspace/Project Paths

### Option 1: Tool Results (Most Reliable) ⭐

When the AI uses tools (like `grep`, `read_file`, `codebase_search`), the results contain a `workspaceResults` field with the **absolute workspace path**:

```json
{
  "toolFormerData": {
    "tool": 41,
    "name": "grep",
    "result": "{\"success\":{\"workspaceResults\":{\"/Users/macbook/play/tapjot--project/tapjot\":{...}}}}"
  }
}
```

**Extraction Strategy:**
1. Iterate through conversation bubbles (messages)
2. Look for bubbles with `toolFormerData` field
3. Parse the `result` JSON
4. Extract workspace path from `workspaceResults` keys
5. Cache this as the session's project path

### Option 2: File Selections (Relative Paths Only)

The `context.fileSelections` field contains files, but only with **relative paths**:

```json
{
  "context": {
    "fileSelections": [
      {
        "relativeWorkspacePath": "src/components/Header.tsx"
      }
    ]
  }
}
```

**Limitation:** No absolute path, so can't determine which project without additional context.

### Option 3: Attached Files in Bubbles

User messages contain `attachedFileCodeChunksMetadataOnly` with relative paths:

```json
{
  "attachedFileCodeChunksMetadataOnly": [
    {
      "relativeWorkspacePath": "src/components/Header.tsx"
    }
  ]
}
```

**Same limitation:** Relative paths only.

## Recommended Implementation Strategy

### Phase 1: Extract Workspace from Tool Results

```python
def extract_workspace_path(composer_id, db_connection):
    """
    Extract workspace path from first tool result in conversation
    """
    # Get all bubbles for this composer
    bubbles = get_bubbles_for_composer(composer_id, db_connection)
    
    for bubble in bubbles:
        if 'toolFormerData' in bubble and bubble['toolFormerData']:
            tool_data = bubble['toolFormerData']
            if 'result' in tool_data:
                result = json.loads(tool_data['result'])
                if 'success' in result and 'workspaceResults' in result['success']:
                    # Get first workspace path
                    workspace_paths = list(result['success']['workspaceResults'].keys())
                    if workspace_paths:
                        return workspace_paths[0]
    
    return None  # No workspace found (could be a non-project chat)
```

### Phase 2: Cache in Metadata DB

Once extracted, store in our metadata database:

```sql
INSERT INTO session_metadata (
  session_id,
  project_path,
  ...
) VALUES (
  'abc-123-def',
  '/Users/macbook/play/my-project',
  ...
);
```

### Phase 3: Project-Scoped Search

```python
def search_sessions(query, project='current'):
    """
    Search sessions filtered by project
    """
    if project == 'current':
        current_workspace = get_current_workspace()  # From active Cursor window
        return search_in_metadata_db(
            query=query, 
            project_path=current_workspace
        )
    elif project == 'all':
        return search_in_metadata_db(query=query, project_path=None)
    else:
        return search_in_metadata_db(query=query, project_path=project)
```

## Important Notes

### 1. Not All Sessions Have Projects
Some chat sessions might not have any tool calls or file references. These would be:
- General conversation (no code context)
- Sessions started but abandoned before any tool use
- Pure Q&A sessions

**Handling:** Tag these as `project_path=NULL` in metadata DB, or label as "General"

### 2. Multi-Workspace Sessions
Theoretically a session could span multiple workspaces if user switches projects mid-conversation.

**Handling:** 
- Use the **first** workspace found (most common case)
- Or: Store multiple workspace paths (comma-separated or JSON array)
- Or: Link session to "primary" workspace (where most activity occurred)

### 3. Workspace Detection Timing

- **Eager extraction:** Parse all sessions on first run to populate metadata DB
- **Lazy extraction:** Extract workspace only when session is first accessed
- **Hybrid:** Background job to gradually index older sessions

**Recommendation:** Lazy extraction for responsiveness, with optional background indexing.

## Updated Database Schema

```sql
CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,
  nickname TEXT UNIQUE,
  tags TEXT,  -- JSON array
  project_path TEXT,  -- ⭐ Extracted from tool results
  project_name TEXT,  -- Derived from last folder in path
  created_at INTEGER,
  last_accessed INTEGER,
  first_message_preview TEXT,
  message_count INTEGER,
  has_project BOOLEAN DEFAULT 1  -- 0 for general chats
);

CREATE INDEX idx_project_path ON session_metadata(project_path);
CREATE INDEX idx_project_name ON session_metadata(project_name);
```

## Conclusion

✅ **Project-based filtering is totally feasible!**

**Impact on Performance:**
- Dramatically reduces search space (100+ sessions → ~10-20 per project)
- Makes nickname/tagging system practical
- Enables cross-project discovery when needed

**Next Steps:**
1. Implement `extract_workspace_path()` function in core library
2. Add project path extraction to metadata sync process
3. Update all search/list functions to accept project filter
4. Add project name display in CLI/MCP output

