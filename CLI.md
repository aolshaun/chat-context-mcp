# Cursor Context CLI

Command-line interface for managing Cursor chat session history.

## Installation

```bash
# Install globally (after publishing to npm)
npm install -g cursor-context-core

# Or use locally
npm run cli -- <command>
```

## Quick Start

```bash
# Show statistics
cursor-context stats

# Sync recent sessions
cursor-context sync --limit 50

# List sessions
cursor-context list --limit 10

# Search for sessions
cursor-context search "authentication"

# Get session details
cursor-context get my-nickname --format markdown
```

## Commands

### `list` - List Sessions

List sessions with optional filtering and sorting.

```bash
cursor-context list [options]

Options:
  -p, --project <path>     Filter by project path
  -t, --tag <tag>          Filter by specific tag
  --tagged-only            Only show sessions with tags
  -s, --sort <type>        Sort order (newest, oldest, most_messages)
  -l, --limit <number>     Limit number of results
  -f, --format <type>      Output format (table, compact, json)
  --no-color               Disable colors

Examples:
  cursor-context list
  cursor-context list --limit 20 --sort newest
  cursor-context list --project /my/project
  cursor-context list --tag feature --format json
  cursor-context list --tagged-only
```

### `get` - Get Session Details

Retrieve a specific session by ID or nickname.

```bash
cursor-context get <id-or-nickname> [options]

Options:
  -f, --format <type>         Output format (markdown, json, table, compact)
  --messages-only             Show only messages (no metadata)
  --max-messages <number>     Maximum number of messages to show
  --no-tools                  Exclude tool calls from output
  --no-color                  Disable colors

Examples:
  cursor-context get abc-123-def
  cursor-context get my-session --format markdown
  cursor-context get my-session --messages-only --max-messages 10
  cursor-context get my-session --no-tools
```

### `search` - Search Sessions

Search sessions by content (nicknames, tags, messages, projects).

```bash
cursor-context search <query> [options]

Options:
  -p, --project <path>     Limit to specific project
  --tagged-only            Only search tagged sessions
  --case-sensitive         Case sensitive search
  -l, --limit <number>     Limit number of results
  -f, --format <type>      Output format (table, compact, json)
  --no-color               Disable colors

Examples:
  cursor-context search "authentication"
  cursor-context search "API" --project /my/project
  cursor-context search "bug" --tagged-only --limit 5
  cursor-context search "Test" --case-sensitive
```

### `nickname` - Set Session Nickname

Give a session a memorable name.

```bash
cursor-context nickname <session-id> <nickname>

Examples:
  cursor-context nickname abc-123-def auth-implementation
  cursor-context nickname abc-123-def "My Important Chat"
```

### `tag` - Manage Tags

Add, remove, or list tags.

#### Add Tags

```bash
cursor-context tag add <session-id> <tags...>

Examples:
  cursor-context tag add abc-123-def feature
  cursor-context tag add abc-123-def feature backend authentication
  cursor-context tag add my-nickname bugfix critical
```

#### Remove Tags

```bash
cursor-context tag remove <session-id> <tags...>

Examples:
  cursor-context tag remove abc-123-def feature
  cursor-context tag remove my-nickname bugfix critical
```

#### List All Tags

```bash
cursor-context tag list

# Shows all tags with usage counts
```

### `sync` - Sync Sessions

Sync sessions from Cursor's database to metadata database.

```bash
cursor-context sync [options]

Options:
  -l, --limit <number>     Maximum number of sessions to sync (default: 50)

Examples:
  cursor-context sync
  cursor-context sync --limit 100
```

### `stats` - Show Statistics

Display database statistics.

```bash
cursor-context stats [options]

Options:
  -f, --format <type>      Output format (table, json)

Examples:
  cursor-context stats
  cursor-context stats --format json
```

### `projects` - List Projects

List all projects with session counts.

```bash
cursor-context projects [options]

Options:
  -f, --format <type>      Output format (table, json)

Examples:
  cursor-context projects
  cursor-context projects --format json
```

### `config` - Manage Configuration

View and modify CLI configuration.

#### Show Configuration

```bash
cursor-context config show [options]

Options:
  -f, --format <type>      Output format (table, json)

Examples:
  cursor-context config show
  cursor-context config show --format json
```

#### Set Configuration Value

```bash
cursor-context config set <key> <value>

Valid Keys:
  defaultFormat        Default output format (table, compact, json, markdown)
  defaultLimit         Default result limit (number)
  defaultSort          Default sort order (newest, oldest, most_messages)
  useColors            Use colors in output (true, false)
  cursorDBPath         Path to Cursor's database
  metadataDBPath       Path to metadata database

Examples:
  cursor-context config set defaultFormat markdown
  cursor-context config set defaultLimit 50
  cursor-context config set defaultSort most_messages
  cursor-context config set useColors false
```

#### Reset Configuration

```bash
cursor-context config reset

# Resets all configuration to defaults
```

## Output Formats

### Table Format (default)

Pretty-printed tables with borders and columns.

```
┌─────────────┬─────────┬─────────┬──────┬─────────┐
│ Nickname/ID │ Project │ Messages│ Tags │ Created │
├─────────────┼─────────┼─────────┼──────┼─────────┤
│ my-session  │ my-app  │ 42      │ feat │ 2d ago  │
└─────────────┴─────────┴─────────┴──────┴─────────┘
```

### Compact Format

One-line per session, easier to scan.

```
1. my-session [my-app] 42 msgs {feature, backend}
2. another-one [other] 15 msgs {bugfix}
```

### JSON Format

Machine-readable JSON output.

```json
[
  {
    "session_id": "abc-123-def",
    "nickname": "my-session",
    "project_name": "my-app",
    "message_count": 42,
    "tags": ["feature", "backend"]
  }
]
```

### Markdown Format

Formatted markdown (for `get` command).

```markdown
# Cursor Session

**Nickname:** my-session
**Project:** my-app
**Messages:** 42

---

## 👤 User

Hello, how are you?

---

## 🤖 Assistant

I am doing well!
```

## Configuration

Configuration is stored in `~/.cursor-context/config.json`.

### Default Configuration

```json
{
  "defaultFormat": "table",
  "defaultLimit": 20,
  "defaultSort": "newest",
  "useColors": true
}
```

### Custom Configuration

Override defaults:

```bash
cursor-context config set defaultFormat compact
cursor-context config set defaultLimit 50
```

## Workflows

### Organize a Project

```bash
# Sync all sessions
cursor-context sync --limit 100

# Find sessions for a project
cursor-context list --project /path/to/project

# Tag them
cursor-context tag add session-1 project:myapp feature
cursor-context tag add session-2 project:myapp bugfix

# Give important ones nicknames
cursor-context nickname session-1 "Auth Implementation"
cursor-context nickname session-2 "Bug Fix #123"

# Search later
cursor-context search "authentication" --project /path/to/project
```

### Review Recent Work

```bash
# List recent sessions
cursor-context list --limit 10 --sort newest

# Get details of interesting one
cursor-context get abc-123 --format markdown > session.md

# Add tags for organization
cursor-context tag add abc-123 reviewed important
```

### Find Specific Discussions

```bash
# Search by keyword
cursor-context search "database migration"

# Filter by project
cursor-context search "API" --project /my/project

# Get the session
cursor-context get result-id --format markdown
```

## Tips

- **Use nicknames** for important sessions you'll reference often
- **Tag everything** - it makes searching much easier later
- **Sync regularly** to keep metadata up to date
- **Use compact format** for quick scans, table for detailed views
- **Pipe to files** for archiving: `cursor-context get my-session > backup.md`
- **Set defaults** that match your workflow with `config set`

## Troubleshooting

### Database Locked

If you get "database is locked" errors, Cursor is actively writing to its database. Wait a moment and try again.

### Session Not Found

If a session ID isn't found, try syncing first:

```bash
cursor-context sync --limit 100
```

### No Colors

If colors aren't working, check your terminal supports ANSI colors. To disable:

```bash
cursor-context config set useColors false
# Or use --no-color flag
cursor-context list --no-color
```

### Configuration Issues

Reset configuration to defaults:

```bash
cursor-context config reset
```

## Shell Completion (Future)

Shell completion will be added in a future release:

```bash
# Bash
cursor-context completion bash > /etc/bash_completion.d/cursor-context

# Zsh
cursor-context completion zsh > ~/.zsh/completions/_cursor-context

# Fish
cursor-context completion fish > ~/.config/fish/completions/cursor-context.fish
```

## See Also

- [README.md](README.md) - Library usage and API
- [DEVELOPMENT.md](DEVELOPMENT.md) - Contributing guide
- [CURSOR-CROSS-SESSION-CONTEXT.md](CURSOR-CROSS-SESSION-CONTEXT.md) - Technical details

