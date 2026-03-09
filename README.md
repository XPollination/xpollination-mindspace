# XPollination MCP Server

MCP server providing two systems: a **content pipeline** (trend discovery → draft → publish) and a **project management tool** (multi-agent workflow with PDSA methodology).

## Systems

### Content Pipeline
Tools for Claude to orchestrate content generation:
- **Frame Management** — define topic frames for trend monitoring
- **Trend Crawling** — RSS feeds and trend matching
- **Content Generation** — propose topics, write drafts, iterate
- **Fact Checking** — verify claims with evidence
- **Publishing** — commit to site

### Project Management
Multi-agent workflow engine (WORKFLOW.md v16):
- **Task lifecycle** — pending → ready → active → review → complete
- **Role-based transitions** — PDSA, QA, Dev, Liaison
- **Quality gates** — coded acceptance criteria per transition
- **Visualization** — `node viz/server.js 8080` serves dashboard at http://10.33.33.1:8080

## Architecture

```
4 Claude Agents (Liaison, PDSA, Dev, QA)
    │
    ▼
┌─────────────────────────────────────┐
│   XPollination MCP Server           │
│                                     │
│   Content Tools:                    │
│   • create_frame, list_frames       │
│   • crawl_trends, propose_topic     │
│   • write_draft, fact_check         │
│   • improve_draft, publish_post     │
│                                     │
│   PM Tools:                         │
│   • create, get, list, transition   │
│   • update-dna                      │
│                                     │
│   State: SQLite (data/)             │
│   Workflow: tracks/process/context/  │
│     workflow/v0.0.16/WORKFLOW.md    │
└─────────────────────────────────────┘
    │
    ▼
xpollination.earth
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/db/interface-cli.js` | CLI for all database operations (agents use this) |
| `src/db/workflow-engine.js` | Transition rules and validation |
| `src/db/schema.sql` | Database schema |
| `tracks/process/context/workflow/v0.0.16/WORKFLOW.md` | Workflow source of truth (v16) |
| `viz/server.js` | Visualization dashboard |
| `viz/agent-monitor.cjs` | Agent polling monitor |

## Development

```bash
source ~/.nvm/nvm.sh
npm install
npm run build
npm start
```

## Related Projects

| Project | What |
|---------|------|
| **HomePage** | Website source + deployment. See `HomePage/docs/Knowledge Management/deployment.md` |
| **HomeAssistant** | Infrastructure scripts (tmux sessions, server setup) |

## License

MIT
