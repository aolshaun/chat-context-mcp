# Cursor Context Retrieval - Project Roadmap

## Project Status: 🟢 Phase 1 - In Progress

---

## Overview

Building a tool to retrieve and reference context from previous Cursor AI chat sessions. Enables cross-session context, session nicknames/tagging, and project-scoped search.

**See:** `CURSOR-CROSS-SESSION-CONTEXT.md` for full project specification

---

## Phase Status

### ✅ Phase 0: Research & Planning (COMPLETE)
- [x] Discover Cursor database structure
- [x] Reverse engineer composerData format
- [x] Confirm workspace path extraction feasibility
- [x] Design nickname/tagging system
- [x] Write technical specification
- [x] Create detailed Phase 1 roadmap

**Duration:** ~1 week | **Completed:** Oct 26, 2025

---

### 🟡 Phase 1: Core Library (IN PROGRESS)
**Goal:** Build foundational TypeScript library for reading Cursor DB, parsing messages, extracting workspace paths, and managing metadata.

**Detailed Roadmap:** `roadmap/PHASE-1-CORE.md` (58 tasks)

**Key Deliverables:**
- Read Cursor database (safe, read-only)
- Parse user/assistant messages
- Extract workspace paths from tool results
- Metadata database (nicknames, tags, projects)
- Core API: list, fetch, search sessions
- Unit tests + integration tests

**Status:** 0/58 tasks complete (0%)

**Estimated Duration:** 2-3 weeks

**Start Date:** Oct 27, 2025

---

### ⚪ Phase 2: CLI Tool (PLANNED)
**Goal:** Build command-line tool for manual session retrieval and management.

**Detailed Roadmap:** `roadmap/PHASE-2-CLI.md` (to be created)

**Key Commands:**
```bash
cursor-context list                    # List sessions
cursor-context fetch <id|nickname>     # Fetch session
cursor-context search "query"          # Search sessions
cursor-context tag <id> "nickname"     # Tag session
cursor-context export <id>             # Export to markdown
```

**Status:** Not started

**Estimated Duration:** 1-2 weeks

**Prerequisites:** Phase 1 complete

---

### ⚪ Phase 3: MCP Server (PLANNED)
**Goal:** Implement Model Context Protocol server for native Cursor integration.

**Detailed Roadmap:** `roadmap/PHASE-3-MCP.md` (to be created)

**Key Tools:**
- `list_sessions` - List with project filter
- `fetch_session_by_nickname` - Quick reference
- `fetch_session_by_id` - Fetch by UUID
- `search_sessions` - Full-text search
- `find_sessions_by_tag` - Find by tag

**Note:** Tools to tag/nickname the current session are not included because the MCP server cannot access Cursor's runtime context to determine which session is currently active. Users can tag/nickname sessions after they're created using the CLI or by referencing them by ID in future sessions.

**Status:** Not started

**Estimated Duration:** 2-3 weeks

**Prerequisites:** Phase 1 complete (Phase 2 validates core logic)

---

### ⚪ Phase 4: Advanced Features (FUTURE)
**Goal:** Polish and enhance with advanced capabilities.

**Detailed Roadmap:** `roadmap/PHASE-4-ADVANCED.md` (to be created)

**Planned Features:**
- Auto-suggest nicknames from first message
- Session summarization for long chats
- Semantic search (embeddings)
- Cross-project session discovery
- Rich text preservation in output
- Session analytics
- Export to HTML/PDF

**Status:** Not started

**Estimated Duration:** Ongoing

**Prerequisites:** Phases 1-3 complete, user feedback

---

## Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| ✅ Research & Planning Complete | Oct 26, 2025 | ✅ DONE |
| 🎯 Phase 1: Core Library | ~Nov 15, 2025 | 🟡 In Progress |
| 🎯 Phase 2: CLI Tool | ~Nov 29, 2025 | ⚪ Planned |
| 🎯 Phase 3: MCP Server | ~Dec 20, 2025 | ⚪ Planned |
| 🎯 v1.0 Release | ~Dec 31, 2025 | ⚪ Planned |

---

## Current Focus

### Active Work: Phase 1 - Core Library

**Next Up:** Task 1.1 - Initialize Node.js project

**Today's Goal:** Complete project setup (Tasks 1.1-1.5)

**This Week's Goal:** 
- ✅ Project setup and tooling
- ✅ Database connection working
- ✅ Basic session listing

---

## Success Metrics

### Phase 1 Success:
- [ ] Can list 1000+ sessions in <1 second
- [ ] Can fetch and parse any session
- [ ] Workspace extraction works on 90%+ of sessions
- [ ] All tests passing with >80% coverage
- [ ] Documentation clear and complete

### Overall Project Success:
- [ ] CLI tool usable for daily workflow
- [ ] MCP server works seamlessly in Cursor
- [ ] Community adoption (GitHub stars, feedback)
- [ ] Survives Cursor updates (schema changes handled)

---

## Risk Management

### High Risks 🔴
1. **Cursor schema changes** - Database format could change in updates
   - *Mitigation:* Version detection, graceful degradation
   
2. **Performance with large DBs** - 3GB+ databases could be slow
   - *Mitigation:* Project-scoped search, caching, indexing

### Medium Risks 🟡
3. **Rich text parsing complexity** - Lexical format has many node types
   - *Mitigation:* Start simple (plain text), enhance iteratively
   
4. **Database locking** - Cursor might hold exclusive locks
   - *Mitigation:* Read-only mode, retry logic, clear errors

### Low Risks 🟢
5. **Platform compatibility** - Windows/Linux paths different
   - *Mitigation:* Already planned in Phase 1

---

## Resources

- **Main Spec:** `CURSOR-CROSS-SESSION-CONTEXT.md`
- **Phase 1 Tasks:** `roadmap/PHASE-1-CORE.md`
- **Research:** `workspace_findings.md`
- **Repository:** (to be created on GitHub)

---

## Communication

**Updates:** Update this file weekly with progress
**Blockers:** Document in phase-specific roadmaps
**Decisions:** Log major decisions in main spec

---

Last Updated: October 27, 2025

