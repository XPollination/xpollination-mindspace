# XPollination MCP Server

MCP (Model Context Protocol) server for the XPollination content pipeline.

## Purpose

This server exposes tools that Claude uses to orchestrate the content generation pipeline:

1. **Frame Management** - Define and manage topic frames for trend monitoring
2. **Trend Crawling** - Monitor RSS feeds and Google Trends for relevant content
3. **Content Generation** - Propose topics, write drafts, iterate
4. **Fact Checking** - Verify claims with evidence
5. **Publishing** - Commit approved content to Hugo site

## Architecture

```
Claude (Orchestrator)
    │
    ▼
┌─────────────────────────────────┐
│   XPollination MCP Server       │
│                                 │
│   Tools:                        │
│   • create_frame, list_frames   │
│   • crawl_trends                │
│   • propose_topic, write_draft  │
│   • fact_check, improve_draft   │
│   • publish_post                │
│                                 │
│   State: SQLite                 │
└─────────────────────────────────┘
    │
    ▼
Hugo Site → xpollination.earth
```

## Documentation

Planning and PDCA documentation is in the separate repository:
- **HomeAssistant** → `systems/hetzner-cx22-ubuntu/pdca/xpollination-homepage/`

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## License

MIT
