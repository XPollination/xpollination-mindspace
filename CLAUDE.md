# XPollination MCP Server - Development Guide

## Project Overview

MCP (Model Context Protocol) server that powers the XPollination content generation pipeline. Claude acts as the orchestrator, calling MCP tools in sequence to discover trends, generate content, verify facts, and publish to a Hugo blog.

## Agent Task Monitoring (ALL AGENTS)

**Every agent must use this skill to receive tasks from the PM system.**

### Start Monitor (once per agent session)
```bash
source ~/.nvm/nvm.sh
# PDSA+QA agent:
nohup node viz/agent-monitor.cjs pdsa qa > /tmp/agent-monitor-pdsa.log 2>&1 &

# Dev agent:
nohup node viz/agent-monitor.cjs dev > /tmp/agent-monitor-dev.log 2>&1 &
```

### Check for Work (minimal tokens)
```bash
# PDSA/QA agent checks:
stat -c%s /tmp/agent-work-pdsa.json 2>/dev/null || echo 0
stat -c%s /tmp/agent-work-qa.json 2>/dev/null || echo 0

# Dev agent checks:
stat -c%s /tmp/agent-work-dev.json 2>/dev/null || echo 0
```
- Returns `0` = no work
- Returns `>0` = work found, read the file: `cat /tmp/agent-work-{role}.json`

### When Work is Found
1. Read the work file to get task ID and details
2. Get full task DNA: `node src/db/interface-cli.js get <slug>`
3. Claim task: `node src/db/interface-cli.js transition <slug> active <actor>`
4. Do the work
5. **CRITICAL: Write findings to DNA before completing**
   - `node src/db/interface-cli.js update-dna <slug> '{"findings":"..."}' <actor>`
   - `dna.findings` = what you discovered
   - `dna.proposed_design` = your proposal (for design tasks)
   - `dna.implementation` = what you built (for dev tasks)
6. Complete task: `node src/db/interface-cli.js transition <slug> review <actor>`

### Database Interface CLI (Regulated Access)
All agents use `src/db/interface-cli.js` for database operations:
```bash
# Get node details
node src/db/interface-cli.js get <id|slug>

# List nodes with filters
node src/db/interface-cli.js list --status=ready --role=dev

# Claim task (transition to active)
node src/db/interface-cli.js transition <slug> active dev

# Update DNA (findings, implementation, etc.)
node src/db/interface-cli.js update-dna <slug> '{"key":"value"}' dev

# Complete work (dev sends to review, QA can mark complete)
node src/db/interface-cli.js transition <slug> review dev

# Create new node (pdsa, liaison, system only)
node src/db/interface-cli.js create task my-slug '{"title":"...","role":"dev"}' pdsa
```

**Actors:** dev, pdsa, qa, liaison, orchestrator, system
**Direct SQL access is DENIED** - use interface-cli.js for all operations

### Self-Contained Objects (CRITICAL)
**All communication MUST be in the task DNA.** Objects must be readable standalone.
- NO relying on external links
- NO "see PDSA doc at..." without also embedding the content
- If someone reads only the task DNA, they should understand everything

### Status Values (CRITICAL)
Use ONLY these values - others break visualization:
- `pending`, `ready`, `active`, `approval`, `approved`, `testing`, `review`, `rework`, `complete`, `blocked`, `cancelled`
- **Use `complete` NOT `completed`** (no 'd')

### Task Workflow (Role-Based Transitions)

**PDSA Design Path:**
```
pending → ready(pdsa) → active(pdsa) → approval(human) → approved → testing(qa) → ready(dev) → active(dev) → review(qa) → complete
                                                                                              ↓
                                                                                         rework(dev) ↺
```

**LIAISON Content Path:**
```
pending → ready(liaison) → active(liaison) → review(qa) → complete
```

**Key Principles:**
- Role assigned at creation is PRESERVED unless explicitly transitioned
- `ready->active`: Only the matching role can claim (dev claims dev tasks, pdsa claims pdsa tasks)
- `rework->active`: Original role reclaims their rework (pdsa fixes pdsa rework, dev fixes dev rework)
- `review->rework`: Sets role back to dev (or original implementer)
- `approval->approved`: Human gate, sets role to liaison for monitoring

### Multi-Project Support
Monitor covers: xpollination-mcp-server, HomePage (and any project with data/xpollination.db)

---

## Quick Start

```bash
# Load Node.js (nvm required - no sudo available)
source ~/.nvm/nvm.sh

# Install dependencies
npm install

# Build
npm run build

# Start server
npm start
```

## Git Protocol

**CRITICAL - Follow these rules strictly:**

1. **Specific file staging** - Never use `git add .` or `git add -A`
   ```bash
   git add src/specific/file.ts
   ```

2. **Atomic commands** - Never chain with `&&`
   ```bash
   git add file.ts
   git commit -m "message"
   git push
   ```

3. **One-liner commits** - Short, descriptive messages
   ```bash
   git commit -m "feat: add crawl_trends tool"
   ```

4. **Immediate push** - Push right after commit

5. **Ask before destructive operations** - Never force push, reset --hard, etc.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 XPollination MCP Server                      │
├─────────────────────────────────────────────────────────────┤
│  TOOLS:                                                      │
│  ├── Frame Management: create_frame, list_frames            │
│  ├── Crawling: crawl_trends                                 │
│  ├── Content: propose_topic, write_draft                    │
│  ├── Verification: fact_check, improve_draft                │
│  └── Publishing: publish_post                               │
│                                                              │
│  RESOURCES:                                                  │
│  ├── content://frames, content://frames/{id}                │
│  ├── content://drafts, content://drafts/{id}                │
│  └── content://queue                                        │
│                                                              │
│  DATABASE: SQLite (data/xpollination.db)                    │
│  ├── frames, drafts, trends                                 │
│  ├── fact_checks, draft_versions                            │
│  └── workflow_state, workflow_history, published_posts      │
└─────────────────────────────────────────────────────────────┘
```

## Content Pipeline Workflow

```
1. crawl_trends(frames) → trending_topics
2. propose_topic(trending_topics) → proposals
3. [USER GATE: select topic, add framing]
4. write_draft(approved_proposal) → draft
5. fact_check(draft) → verification_report
6. IF fail: improve_draft(draft, issues) → goto 5
7. [USER GATE: approve/reject]
8. publish_post(final_draft) → deployed
```

## Directory Structure

```
xpollination-mcp-server/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/
│   │   ├── index.ts                # Tool registry
│   │   ├── frames/
│   │   │   ├── createFrame.ts      # Create content frame
│   │   │   └── listFrames.ts       # List frames
│   │   ├── crawler/
│   │   │   └── crawlTrends.ts      # RSS crawling + matching
│   │   ├── content/
│   │   │   ├── proposeTopic.ts     # Generate proposals
│   │   │   └── writeDraft.ts       # Create drafts
│   │   ├── verification/
│   │   │   ├── factCheck.ts        # Verify claims
│   │   │   └── improveDraft.ts     # Fix issues
│   │   └── publishing/
│   │       └── publishPost.ts      # Git commit + deploy
│   ├── resources/
│   │   └── index.ts                # MCP resources
│   ├── services/
│   │   ├── rss/
│   │   │   └── RssParser.ts        # RSS feed parsing
│   │   ├── trends/
│   │   │   └── TrendMatcher.ts     # Keyword matching
│   │   ├── git/
│   │   │   └── GitPublisher.ts     # Hugo repo integration
│   │   └── search/                 # (not implemented)
│   ├── db/
│   │   ├── client.ts               # Database initialization
│   │   ├── schema.sql              # SQLite schema
│   │   └── repositories/
│   │       ├── FrameRepository.ts
│   │       └── DraftRepository.ts
│   ├── workflow/
│   │   ├── WorkflowEngine.ts       # State machine engine
│   │   ├── states.ts               # Workflow states enum
│   │   ├── transitions.ts          # State transitions
│   │   └── processes/
│   │       └── ContentPipeline.ts  # Pipeline process
│   └── utils/
│       └── logger.ts               # Logging utility
├── data/
│   └── xpollination.db             # SQLite database (created at runtime)
├── dist/                           # Compiled output
├── package.json
├── tsconfig.json
└── CLAUDE.md                       # This file
```

## Environment

- **Platform:** Ubuntu 24.04.3 LTS on Hetzner CX22
- **Node.js:** 22.22.0 (via nvm)
- **Database:** SQLite with WAL mode
- **No sudo access** - use nvm for Node.js

## GitHub Repository

- **URL:** https://github.com/PichlerThomas/xpollination-mcp-server
- **Visibility:** Private
- **Auth:** PAT stored in HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md

## Current Implementation Status

### ✅ Completed
- [x] MCP server setup with @modelcontextprotocol/sdk
- [x] SQLite database with schema
- [x] Frame management tools (create_frame, list_frames)
- [x] RSS parser service
- [x] Trend matcher service
- [x] crawl_trends tool
- [x] propose_topic tool
- [x] write_draft tool
- [x] fact_check tool
- [x] improve_draft tool
- [x] publish_post tool
- [x] Git publisher service
- [x] MCP resources (frames, drafts, queue)
- [x] FrameRepository
- [x] DraftRepository
- [x] Logger utility
- [x] Build script with schema copy

### 🚧 TODO: Unit Tests

**Individual Component Tests:**
- [ ] `RssParser.test.ts` - Feed parsing, date filtering, HTML entity decoding
- [ ] `TrendMatcher.test.ts` - Keyword matching, scoring, exclusions
- [ ] `FrameRepository.test.ts` - CRUD operations, status filtering
- [ ] `DraftRepository.test.ts` - CRUD operations, version tracking
- [ ] `GitPublisher.test.ts` - Frontmatter generation, slug creation
- [ ] `createFrame.test.ts` - Input validation, frame creation
- [ ] `listFrames.test.ts` - Active/inactive filtering
- [ ] `crawlTrends.test.ts` - Feed fetching, matching, deduplication
- [ ] `proposeTopic.test.ts` - Proposal generation from trends
- [ ] `writeDraft.test.ts` - Draft creation, claim extraction
- [ ] `factCheck.test.ts` - Claim verification workflow
- [ ] `improveDraft.test.ts` - Version incrementing, content update
- [ ] `publishPost.test.ts` - Git operations, URL generation

**End-to-End Tests:**
- [ ] `pipeline.e2e.test.ts` - Full content pipeline flow:
  1. Create frame with keywords
  2. Crawl trends (mock RSS)
  3. Propose topics
  4. Write draft
  5. Fact check (mock verification)
  6. Improve if needed
  7. Publish (mock git)
  8. Verify database state at each step

### 🔮 Future Work
- [ ] Google Trends API integration
- [ ] Web search service for fact-checking
- [ ] Hugo site setup on Hetzner
- [ ] GitHub Actions for deployment
- [ ] First frame: "Fourth Temple" (Christianity, Freikirche, spiritual transformation)
- [ ] TrendRepository implementation
- [ ] WorkflowRepository implementation

## First Content Frame (Planned)

**Frame ID:** `fourth-temple`

**Concept:**
- 1st Temple → Solomon's Temple
- 2nd Temple → Herod's Temple
- 3rd Temple → We humans (body as temple)
- 4th Temple → Collective temple Christians must build

**Keywords:** Christianity, Freikirche, free church, spiritual transformation, 3rd temple, 4th temple, body of Christ, servant leadership, collective unity, ecclesia, metanoia

**Audience:** Christians interested in deeper ecclesiology, leaders seeking faith-integrated leadership

**Tone:** Thoughtful, scripturally grounded, accessible, bridge-building

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/rss/RssParser.test.ts

# Run with coverage
npm test -- --coverage

# Run e2e tests only
npm test -- src/__tests__/e2e/
```

## Debugging

```bash
# Check server logs (stderr)
npm start 2>&1 | tee server.log

# Check database
sqlite3 data/xpollination.db ".tables"
sqlite3 data/xpollination.db "SELECT * FROM frames;"

# Verify build
npm run build && ls -la dist/
```

## Related Documentation

- **Plan file:** `~/.claude/plans/sequential-hugging-pebble.md`
- **Credentials:** `~/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md`
- **MCP SDK:** https://github.com/modelcontextprotocol/sdk
