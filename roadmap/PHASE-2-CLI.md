# Phase 2: CLI Tool

Build a command-line interface for the Cursor Context library.

## Goals

- Provide easy access to session management from terminal
- Support both interactive and non-interactive workflows
- Beautiful, colored output
- Configuration management
- Shell completion (future)

## Commands

### Session Retrieval

- [x] `list` - List sessions with filters
- [x] `get <id|nickname>` - Get session details
- [x] `search <query>` - Search sessions

### Session Management

- [x] `nickname <session> <name>` - Set session nickname
- [x] `tag add <session> <tag>` - Add tag
- [x] `tag remove <session> <tag>` - Remove tag
- [x] `tags` - List all tags

### Data Management

- [x] `sync` - Sync sessions from Cursor DB
- [x] `stats` - Show statistics
- [x] `projects` - List projects

### Configuration

- [x] `config show` - Show configuration
- [x] `config set <key> <value>` - Set config value
- [x] `config reset` - Reset to defaults

## Output Formats

- `--format json|markdown|table|compact` - Output format
- `--no-color` - Disable colors
- `--limit N` - Limit results

## Dependencies

- `commander` - CLI framework
- `chalk` - Terminal colors
- `cli-table3` - Formatted tables
- `ora` - Spinners/progress indicators
- `prompts` - Interactive prompts

## File Structure

```
src/cli/
├── index.ts           # Main CLI entry point
├── commands/
│   ├── list.ts       # List command
│   ├── get.ts        # Get command
│   ├── search.ts     # Search command
│   ├── tag.ts        # Tag commands
│   ├── nickname.ts   # Nickname command
│   ├── sync.ts       # Sync command
│   ├── stats.ts      # Stats command
│   ├── projects.ts   # Projects command
│   └── config.ts     # Config commands
├── utils/
│   ├── output.ts     # Output formatters
│   ├── config.ts     # Config management
│   └── spinner.ts    # Progress indicators
└── types.ts          # CLI-specific types
```

## Usage Examples

```bash
# List recent sessions
cursor-context list --limit 10 --sort newest

# Search for sessions
cursor-context search "authentication" --project /my/project

# Get session by nickname
cursor-context get auth-impl --format markdown

# Set nickname
cursor-context nickname abc-123-def my-session

# Add tags
cursor-context tag add abc-123-def feature backend

# Sync sessions
cursor-context sync --limit 50

# Show stats
cursor-context stats

# Configuration
cursor-context config set defaultFormat markdown
cursor-context config show
```

